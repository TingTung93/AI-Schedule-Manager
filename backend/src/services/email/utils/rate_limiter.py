"""
Email rate limiting utilities.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import redis

logger = logging.getLogger(__name__)


class RateLimiter:
    """Email rate limiting class."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        rate_per_hour: int = 1000,
        rate_per_minute: int = 100,
        rate_per_day: int = 10000,
    ):
        """Initialize rate limiter."""
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.rate_per_hour = rate_per_hour
        self.rate_per_minute = rate_per_minute
        self.rate_per_day = rate_per_day

    async def check_rate_limit(self, identifier: str, limit_type: str = "email") -> bool:
        """Check if request is within rate limits."""
        try:
            current_time = datetime.now(timezone.utc)

            # Check different time windows
            checks = [
                ("minute", 60, self.rate_per_minute),
                ("hour", 3600, self.rate_per_hour),
                ("day", 86400, self.rate_per_day),
            ]

            for window, seconds, limit in checks:
                if not await self._check_window_limit(identifier, limit_type, window, seconds, limit, current_time):
                    logger.warning(f"Rate limit exceeded for {identifier} in {window} window")
                    return False

            return True

        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            # Allow request if rate limiter fails
            return True

    async def _check_window_limit(
        self, identifier: str, limit_type: str, window: str, seconds: int, limit: int, current_time: datetime
    ) -> bool:
        """Check rate limit for specific time window."""
        try:
            # Create Redis key
            window_start = int(current_time.timestamp()) // seconds * seconds
            key = f"rate_limit:{limit_type}:{identifier}:{window}:{window_start}"

            # Get current count
            current_count = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.get, key)

            if current_count is None:
                current_count = 0
            else:
                current_count = int(current_count)

            # Check if within limit
            if current_count >= limit:
                return False

            # Increment counter
            pipe = self.redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, seconds)
            await asyncio.get_event_loop().run_in_executor(None, pipe.execute)

            return True

        except Exception as e:
            logger.error(f"Window limit check error: {e}")
            return True

    async def get_rate_limit_status(self, identifier: str, limit_type: str = "email") -> Dict[str, Any]:
        """Get current rate limit status."""
        try:
            current_time = datetime.now(timezone.utc)
            status = {}

            # Check different time windows
            windows = [
                ("minute", 60, self.rate_per_minute),
                ("hour", 3600, self.rate_per_hour),
                ("day", 86400, self.rate_per_day),
            ]

            for window, seconds, limit in windows:
                window_start = int(current_time.timestamp()) // seconds * seconds
                key = f"rate_limit:{limit_type}:{identifier}:{window}:{window_start}"

                current_count = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.get, key)

                current_count = int(current_count) if current_count else 0

                status[window] = {
                    "current": current_count,
                    "limit": limit,
                    "remaining": max(0, limit - current_count),
                    "reset_at": window_start + seconds,
                }

            return {
                "identifier": identifier,
                "limit_type": limit_type,
                "windows": status,
                "timestamp": current_time.isoformat(),
            }

        except Exception as e:
            logger.error(f"Rate limit status error: {e}")
            return {"error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}

    async def reset_rate_limit(self, identifier: str, limit_type: str = "email", window: Optional[str] = None) -> bool:
        """Reset rate limit for identifier."""
        try:
            current_time = datetime.now(timezone.utc)

            windows_to_reset = []
            if window:
                windows_to_reset.append(window)
            else:
                windows_to_reset = ["minute", "hour", "day"]

            window_configs = {"minute": 60, "hour": 3600, "day": 86400}

            for window_name in windows_to_reset:
                if window_name in window_configs:
                    seconds = window_configs[window_name]
                    window_start = int(current_time.timestamp()) // seconds * seconds
                    key = f"rate_limit:{limit_type}:{identifier}:{window_name}:{window_start}"

                    await asyncio.get_event_loop().run_in_executor(None, self.redis_client.delete, key)

            logger.info(f"Reset rate limits for {identifier} in {windows_to_reset}")
            return True

        except Exception as e:
            logger.error(f"Rate limit reset error: {e}")
            return False

    async def add_rate_limit_exemption(self, identifier: str, expiry_hours: int = 24) -> bool:
        """Add temporary rate limit exemption."""
        try:
            key = f"rate_limit:exemption:{identifier}"
            expiry_seconds = expiry_hours * 3600

            await asyncio.get_event_loop().run_in_executor(None, self.redis_client.setex, key, expiry_seconds, "1")

            logger.info(f"Added rate limit exemption for {identifier} for {expiry_hours} hours")
            return True

        except Exception as e:
            logger.error(f"Rate limit exemption error: {e}")
            return False

    async def is_exempt_from_rate_limit(self, identifier: str) -> bool:
        """Check if identifier is exempt from rate limits."""
        try:
            key = f"rate_limit:exemption:{identifier}"
            result = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.get, key)
            return result is not None

        except Exception as e:
            logger.error(f"Rate limit exemption check error: {e}")
            return False

    async def get_global_rate_stats(self) -> Dict[str, Any]:
        """Get global rate limiting statistics."""
        try:
            current_time = datetime.now(timezone.utc)

            # Get all rate limit keys
            pattern = "rate_limit:email:*"
            keys = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.keys, pattern)

            stats = {
                "total_tracked_identifiers": 0,
                "active_limits": len(keys),
                "window_stats": {
                    "minute": {"total_requests": 0, "unique_identifiers": 0},
                    "hour": {"total_requests": 0, "unique_identifiers": 0},
                    "day": {"total_requests": 0, "unique_identifiers": 0},
                },
                "timestamp": current_time.isoformat(),
            }

            # Analyze keys
            identifiers_by_window = {"minute": set(), "hour": set(), "day": set()}

            for key in keys:
                try:
                    parts = key.split(":")
                    if len(parts) >= 5:
                        identifier = parts[2]
                        window = parts[3]

                        if window in identifiers_by_window:
                            identifiers_by_window[window].add(identifier)

                            # Get request count
                            count = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.get, key)
                            if count:
                                stats["window_stats"][window]["total_requests"] += int(count)

                except Exception as e:
                    logger.debug(f"Error processing key {key}: {e}")

            # Update unique identifier counts
            for window, identifiers in identifiers_by_window.items():
                stats["window_stats"][window]["unique_identifiers"] = len(identifiers)

            stats["total_tracked_identifiers"] = len(set().union(*identifiers_by_window.values()))

            return stats

        except Exception as e:
            logger.error(f"Global rate stats error: {e}")
            return {"error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}

    async def cleanup_expired_keys(self) -> Dict[str, Any]:
        """Clean up expired rate limit keys."""
        try:
            pattern = "rate_limit:*"
            keys = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.keys, pattern)

            cleaned_count = 0
            for key in keys:
                ttl = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.ttl, key)

                # If TTL is -1, key has no expiration set (shouldn't happen)
                if ttl == -1:
                    await asyncio.get_event_loop().run_in_executor(None, self.redis_client.delete, key)
                    cleaned_count += 1

            return {
                "cleaned_keys": cleaned_count,
                "total_keys_checked": len(keys),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"Cleanup error: {e}")
            return {"error": str(e), "timestamp": datetime.now(timezone.utc).isoformat()}

    async def set_custom_limits(
        self,
        identifier: str,
        minute_limit: Optional[int] = None,
        hour_limit: Optional[int] = None,
        day_limit: Optional[int] = None,
    ) -> bool:
        """Set custom rate limits for specific identifier."""
        try:
            limits = {}
            if minute_limit is not None:
                limits["minute"] = minute_limit
            if hour_limit is not None:
                limits["hour"] = hour_limit
            if day_limit is not None:
                limits["day"] = day_limit

            if not limits:
                return False

            key = f"rate_limit:custom:{identifier}"
            await asyncio.get_event_loop().run_in_executor(None, self.redis_client.set, key, json.dumps(limits))

            logger.info(f"Set custom rate limits for {identifier}: {limits}")
            return True

        except Exception as e:
            logger.error(f"Custom limits error: {e}")
            return False

    async def get_custom_limits(self, identifier: str) -> Optional[Dict[str, int]]:
        """Get custom rate limits for identifier."""
        try:
            key = f"rate_limit:custom:{identifier}"
            result = await asyncio.get_event_loop().run_in_executor(None, self.redis_client.get, key)

            if result:
                return json.loads(result)
            return None

        except Exception as e:
            logger.error(f"Get custom limits error: {e}")
            return None
