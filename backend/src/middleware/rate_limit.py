"""
Rate limiting middleware for AI Schedule Manager API.
Implements token bucket algorithm for rate limiting.
"""

import asyncio
import hashlib
import ipaddress
import time
from collections import defaultdict
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.config import settings


class RateLimiter:
    """Token bucket rate limiter implementation."""

    def __init__(
        self, rate: int = 60, burst: int = 10, window: int = 60  # requests per minute  # burst size  # time window in seconds
    ):
        self.rate = rate
        self.burst = burst
        self.window = window
        self.buckets: Dict[str, Tuple[float, float]] = {}
        self.lock = asyncio.Lock()

        # Calculate tokens per second
        self.tokens_per_second = rate / window

    async def is_allowed(self, key: str) -> bool:
        """Check if request is allowed for given key."""
        async with self.lock:
            now = time.time()

            if key not in self.buckets:
                # New bucket with full tokens
                self.buckets[key] = (now, float(self.burst))
                return True

            last_update, tokens = self.buckets[key]

            # Calculate tokens to add based on time passed
            time_passed = now - last_update
            tokens_to_add = time_passed * self.tokens_per_second

            # Update tokens (cap at burst size)
            tokens = min(self.burst, tokens + tokens_to_add)

            if tokens >= 1:
                # Consume one token
                tokens -= 1
                self.buckets[key] = (now, tokens)
                return True
            else:
                # No tokens available
                self.buckets[key] = (now, tokens)
                return False

    async def cleanup_old_buckets(self):
        """Remove old buckets to prevent memory leak."""
        async with self.lock:
            now = time.time()
            cutoff = now - (self.window * 2)  # Keep buckets for 2x window

            keys_to_remove = [key for key, (last_update, _) in self.buckets.items() if last_update < cutoff]

            for key in keys_to_remove:
                del self.buckets[key]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI."""

    def __init__(self, app, **kwargs):
        super().__init__(app)

        # Initialize rate limiters for different tiers
        self.limiters = {
            "default": RateLimiter(
                rate=settings.RATE_LIMIT_REQUESTS_PER_MINUTE, burst=settings.RATE_LIMIT_BURST_SIZE, window=60
            ),
            "strict": RateLimiter(rate=10, burst=2, window=60),  # 10 requests per minute for sensitive endpoints
            "relaxed": RateLimiter(rate=300, burst=50, window=60),  # 300 requests per minute for public endpoints
        }

        # Exempt paths from rate limiting
        self.exempt_paths = {"/health", "/docs", "/redoc", "/openapi.json"}

        # Strict rate limit paths (auth endpoints)
        self.strict_paths = {"/api/auth/login", "/api/auth/register", "/api/auth/reset-password"}

        # Start cleanup task
        asyncio.create_task(self._periodic_cleanup())

    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiter."""

        # Skip rate limiting if disabled
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Check if path is exempt
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        # Get client identifier
        client_id = self._get_client_id(request)

        # Determine which limiter to use
        limiter = self._get_limiter_for_path(request.url.path)

        # Check rate limit
        if not await limiter.is_allowed(client_id):
            return self._rate_limit_exceeded_response(request)

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(limiter.rate)
        response.headers["X-RateLimit-Window"] = str(limiter.window)

        return response

    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier from request."""
        # Try to get authenticated user ID from headers/session
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # Hash the token to use as identifier
            token = auth_header[7:]
            return f"token:{hashlib.sha256(token.encode()).hexdigest()[:16]}"

        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Get first IP from forwarded chain
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "0.0.0.0"

        # Validate and normalize IP
        try:
            ip_obj = ipaddress.ip_address(ip)
            return f"ip:{ip_obj.compressed}"
        except ValueError:
            return f"ip:invalid:{hashlib.sha256(ip.encode()).hexdigest()[:16]}"

    def _get_limiter_for_path(self, path: str) -> RateLimiter:
        """Get appropriate rate limiter for given path."""
        if path in self.strict_paths or path.startswith("/api/auth/"):
            return self.limiters["strict"]
        elif path.startswith("/api/public/"):
            return self.limiters["relaxed"]
        else:
            return self.limiters["default"]

    def _rate_limit_exceeded_response(self, request: Request) -> JSONResponse:
        """Create rate limit exceeded response."""
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please try again later.", "type": "rate_limit_exceeded"},
            headers={
                "Retry-After": "60",  # Suggest retry after 60 seconds
                "X-RateLimit-Limit": str(settings.RATE_LIMIT_REQUESTS_PER_MINUTE),
                "X-RateLimit-Window": "60",
            },
        )

    async def _periodic_cleanup(self):
        """Periodically clean up old rate limit buckets."""
        while True:
            await asyncio.sleep(300)  # Run every 5 minutes
            for limiter in self.limiters.values():
                await limiter.cleanup_old_buckets()


class APIKeyRateLimiter:
    """Rate limiter specifically for API key based authentication."""

    def __init__(self):
        self.limits = defaultdict(lambda: {"daily": 10000, "hourly": 1000, "minute": 100})
        self.usage = defaultdict(lambda: {"daily": [], "hourly": [], "minute": []})

    async def check_limit(self, api_key: str) -> Tuple[bool, Optional[str]]:
        """Check if API key has exceeded rate limits."""
        now = time.time()

        # Clean old entries
        self._cleanup_usage(api_key, now)

        # Check each time window
        for window, limit in self.limits[api_key].items():
            if len(self.usage[api_key][window]) >= limit:
                return False, f"API key rate limit exceeded for {window} window"

        # Record usage
        for window in self.usage[api_key]:
            self.usage[api_key][window].append(now)

        return True, None

    def _cleanup_usage(self, api_key: str, now: float):
        """Remove old usage entries outside time windows."""
        windows = {"minute": 60, "hourly": 3600, "daily": 86400}

        for window, seconds in windows.items():
            cutoff = now - seconds
            self.usage[api_key][window] = [timestamp for timestamp in self.usage[api_key][window] if timestamp > cutoff]

    def set_custom_limits(self, api_key: str, daily: int, hourly: int, minute: int):
        """Set custom rate limits for specific API key."""
        self.limits[api_key] = {"daily": daily, "hourly": hourly, "minute": minute}
