"""
Redis caching layer for AI Schedule Manager

Provides decorator-based caching with TTL strategies for improved performance.
"""

import os
import json
import logging
from functools import wraps
from typing import Optional, Any, Callable
from datetime import timedelta

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)
REDIS_ENABLED = os.getenv('REDIS_ENABLED', 'false').lower() == 'true'

# TTL strategies (in seconds)
TTL_STRATEGIES = {
    'department_analytics': 300,      # 5 minutes - analytics data
    'department_hierarchy': 600,      # 10 minutes - hierarchy rarely changes
    'employee_lists': 120,            # 2 minutes - frequently updated
    'role_permissions': 900,          # 15 minutes - permissions rarely change
    'schedule_summary': 180,          # 3 minutes - schedules change moderately
    'shift_templates': 600,           # 10 minutes - templates rarely change
    'user_settings': 300,             # 5 minutes - settings change occasionally
    'default': 300                    # 5 minutes default
}


class RedisCache:
    """Redis cache manager with connection pooling and error handling"""

    def __init__(self):
        self.client: Optional[redis.Redis] = None
        self.enabled = REDIS_ENABLED and REDIS_AVAILABLE

        if self.enabled:
            try:
                self._connect()
                logger.info(f"Redis cache initialized: {REDIS_HOST}:{REDIS_PORT}")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}. Caching disabled.")
                self.enabled = False
        else:
            if not REDIS_AVAILABLE:
                logger.warning("Redis library not installed. Caching disabled.")
            else:
                logger.info("Redis caching disabled by configuration")

    def _connect(self):
        """Establish Redis connection with connection pooling"""
        self.client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
            max_connections=20
        )
        # Test connection
        self.client.ping()

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.enabled:
            return None

        try:
            value = self.client.get(key)
            if value:
                logger.debug(f"Cache HIT: {key}")
                return json.loads(value)
            logger.debug(f"Cache MISS: {key}")
            return None
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
            return None

    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        if not self.enabled:
            return False

        try:
            serialized = json.dumps(value, default=str)
            self.client.setex(key, ttl, serialized)
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.error(f"Cache set error for {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.enabled:
            return False

        try:
            self.client.delete(key)
            logger.debug(f"Cache DELETE: {key}")
            return True
        except Exception as e:
            logger.error(f"Cache delete error for {key}: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.enabled:
            return 0

        try:
            keys = self.client.keys(pattern)
            if keys:
                count = self.client.delete(*keys)
                logger.debug(f"Cache DELETE pattern: {pattern} ({count} keys)")
                return count
            return 0
        except Exception as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0

    def clear_all(self) -> bool:
        """Clear entire cache (use with caution)"""
        if not self.enabled:
            return False

        try:
            self.client.flushdb()
            logger.warning("Cache CLEARED: All keys deleted")
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False

    def health_check(self) -> dict:
        """Check cache health and return stats"""
        if not self.enabled:
            return {
                "enabled": False,
                "available": False,
                "message": "Redis caching disabled"
            }

        try:
            info = self.client.info()
            return {
                "enabled": True,
                "available": True,
                "connected_clients": info.get('connected_clients', 0),
                "used_memory": info.get('used_memory_human', 'N/A'),
                "total_keys": self.client.dbsize(),
                "uptime_seconds": info.get('uptime_in_seconds', 0)
            }
        except Exception as e:
            return {
                "enabled": True,
                "available": False,
                "error": str(e)
            }


# Global cache instance
cache = RedisCache()


def cache_result(ttl: Optional[int] = None, strategy: str = 'default', key_prefix: str = ''):
    """
    Decorator to cache function results with configurable TTL

    Args:
        ttl: Time to live in seconds (overrides strategy)
        strategy: TTL strategy name from TTL_STRATEGIES
        key_prefix: Prefix for cache key generation

    Usage:
        @cache_result(strategy='department_analytics')
        async def get_department_stats(dept_id: int):
            # Expensive database query
            return stats
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = _generate_cache_key(func, key_prefix, args, kwargs)

            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            cache_ttl = ttl if ttl is not None else TTL_STRATEGIES.get(strategy, TTL_STRATEGIES['default'])
            cache.set(cache_key, result, cache_ttl)

            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = _generate_cache_key(func, key_prefix, args, kwargs)

            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            # Execute function
            result = func(*args, **kwargs)

            # Cache result
            cache_ttl = ttl if ttl is not None else TTL_STRATEGIES.get(strategy, TTL_STRATEGIES['default'])
            cache.set(cache_key, result, cache_ttl)

            return result

        # Return appropriate wrapper based on function type
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def _generate_cache_key(func: Callable, prefix: str, args: tuple, kwargs: dict) -> str:
    """Generate cache key from function and arguments"""
    func_name = f"{func.__module__}.{func.__name__}"

    # Build key parts
    key_parts = [prefix] if prefix else []
    key_parts.append(func_name)

    # Add args (skip 'self' or 'db' session)
    for arg in args:
        if hasattr(arg, '__class__') and 'Session' in arg.__class__.__name__:
            continue  # Skip database session objects
        key_parts.append(str(arg))

    # Add kwargs
    for k, v in sorted(kwargs.items()):
        if k == 'db' or (hasattr(v, '__class__') and 'Session' in v.__class__.__name__):
            continue  # Skip database session
        key_parts.append(f"{k}={v}")

    return ":".join(key_parts)


def invalidate_cache(pattern: str):
    """
    Invalidate cache entries matching pattern

    Usage:
        # Invalidate all department analytics caches
        invalidate_cache("*department_analytics*")

        # Invalidate specific department
        invalidate_cache(f"*get_department_stats*{dept_id}*")
    """
    return cache.delete_pattern(pattern)


# Convenience functions for common cache operations
def cache_department_analytics(ttl: int = None):
    """Cache decorator for department analytics (5 min default)"""
    return cache_result(ttl=ttl, strategy='department_analytics', key_prefix='dept_analytics')


def cache_department_hierarchy(ttl: int = None):
    """Cache decorator for department hierarchy (10 min default)"""
    return cache_result(ttl=ttl, strategy='department_hierarchy', key_prefix='dept_hierarchy')


def cache_employee_lists(ttl: int = None):
    """Cache decorator for employee lists (2 min default)"""
    return cache_result(ttl=ttl, strategy='employee_lists', key_prefix='emp_lists')


def cache_role_permissions(ttl: int = None):
    """Cache decorator for role permissions (15 min default)"""
    return cache_result(ttl=ttl, strategy='role_permissions', key_prefix='role_perms')


# Export commonly used objects
__all__ = [
    'cache',
    'cache_result',
    'invalidate_cache',
    'cache_department_analytics',
    'cache_department_hierarchy',
    'cache_employee_lists',
    'cache_role_permissions',
    'RedisCache',
    'TTL_STRATEGIES'
]
