"""
Middleware for performance monitoring and optimization
"""

import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

# Slow query threshold (in seconds)
SLOW_QUERY_THRESHOLD = float(os.getenv('SLOW_QUERY_THRESHOLD', '1.0'))


class QueryPerformanceMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor and log slow database queries

    Logs requests that exceed the slow query threshold for analysis.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Start timing
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log slow queries
        if duration > SLOW_QUERY_THRESHOLD:
            logger.warning(
                f"SLOW REQUEST: {request.method} {request.url.path} "
                f"took {duration:.2f}s (threshold: {SLOW_QUERY_THRESHOLD}s)",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": str(request.query_params),
                    "duration": duration,
                    "status_code": response.status_code
                }
            )
        else:
            logger.debug(
                f"Request {request.method} {request.url.path} "
                f"completed in {duration:.3f}s"
            )

        # Add performance header
        response.headers["X-Response-Time"] = f"{duration:.3f}s"

        return response


class DatabasePoolMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor database connection pool usage

    Logs warnings when connection pool utilization is high.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        from ..database import engine

        # Get pool stats before request
        pool_size = engine.pool.size()
        checked_out_before = engine.pool.checkedout()

        # Process request
        response = await call_next(request)

        # Get pool stats after request
        checked_out_after = engine.pool.checkedout()
        overflow = engine.pool.overflow()

        # Calculate utilization
        utilization = (checked_out_after / pool_size * 100) if pool_size > 0 else 0

        # Log high utilization
        if utilization > 80:
            logger.warning(
                f"HIGH DB POOL UTILIZATION: {utilization:.1f}% "
                f"({checked_out_after}/{pool_size} connections, overflow: {overflow})",
                extra={
                    "pool_size": pool_size,
                    "checked_out": checked_out_after,
                    "overflow": overflow,
                    "utilization": utilization,
                    "path": request.url.path
                }
            )

        # Add pool stats header (for debugging)
        response.headers["X-DB-Pool-Utilization"] = f"{utilization:.1f}%"

        return response


import os  # Import at top of file for SLOW_QUERY_THRESHOLD


__all__ = [
    'QueryPerformanceMiddleware',
    'DatabasePoolMonitoringMiddleware'
]
