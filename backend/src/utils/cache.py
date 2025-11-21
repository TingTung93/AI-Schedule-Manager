"""
Caching utilities for the application.
Implements in-memory cache with TTL and optional Redis backend.
"""

import json
import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Dict, Optional, TypeVar, Union

from cachetools import TTLCache

from ..config.cache_config import CacheConfig

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CacheManager:
    """
    Centralized cache manager with in-memory caching and optional Redis support.

    Provides:
    - In-memory TTL-based caching using cachetools
    - Optional Redis backend (with automatic fallback)
    - Cache invalidation utilities
    - Cache key generation helpers
    - Statistics tracking
    """

    def __init__(self):
        """Initialize cache manager with in-memory caches."""
        self._enabled = CacheConfig.CACHE_ENABLED

        # Initialize in-memory caches with TTL
        self._employees_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("employees"), ttl=CacheConfig.get_ttl("employee_by_id")
        )
        self._departments_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("departments"), ttl=CacheConfig.get_ttl("department_by_id")
        )
        self._shifts_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("shifts"), ttl=CacheConfig.get_ttl("shift_by_id")
        )
        self._schedules_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("schedules"), ttl=CacheConfig.get_ttl("schedule_by_id")
        )
        self._rules_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("rules"), ttl=CacheConfig.get_ttl("rule_by_id")
        )
        self._notifications_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("notifications"), ttl=CacheConfig.get_ttl("notification_by_id")
        )
        self._general_cache = TTLCache(
            maxsize=CacheConfig.get_max_size("general"), ttl=CacheConfig.DEFAULT_TTL
        )

        # Cache statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "errors": 0,
        }

        # Redis client (optional)
        self._redis_client = None
        if CacheConfig.REDIS_ENABLED:
            self._init_redis()

        logger.info(
            f"Cache manager initialized (enabled={self._enabled}, redis={self._redis_client is not None})"
        )

    def _init_redis(self):
        """Initialize Redis client if enabled."""
        try:
            import redis

            self._redis_client = redis.Redis(
                host=CacheConfig.REDIS_HOST,
                port=CacheConfig.REDIS_PORT,
                db=CacheConfig.REDIS_DB,
                password=CacheConfig.REDIS_PASSWORD,
                decode_responses=CacheConfig.REDIS_DECODE_RESPONSES,
                socket_timeout=2,
                socket_connect_timeout=2,
            )
            # Test connection
            self._redis_client.ping()
            logger.info("Redis cache backend connected successfully")
        except ImportError:
            logger.warning("Redis library not installed, using in-memory cache only")
            self._redis_client = None
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Using in-memory cache only")
            self._redis_client = None

    def _get_cache_for_type(self, cache_type: str) -> TTLCache:
        """Get the appropriate cache based on type."""
        cache_map = {
            "employee": self._employees_cache,
            "department": self._departments_cache,
            "shift": self._shifts_cache,
            "schedule": self._schedules_cache,
            "rule": self._rules_cache,
            "notification": self._notifications_cache,
        }
        return cache_map.get(cache_type, self._general_cache)

    def get(self, cache_type: str, key: str, default: Any = None) -> Any:
        """
        Get value from cache.

        Args:
            cache_type: Type of cache (employee, department, shift, etc.)
            key: Cache key
            default: Default value if key not found

        Returns:
            Cached value or default
        """
        if not self._enabled:
            return default

        try:
            # Try Redis first if available
            if self._redis_client:
                try:
                    redis_key = CacheConfig.get_cache_key(cache_type, key)
                    value = self._redis_client.get(redis_key)
                    if value:
                        self._stats["hits"] += 1
                        return json.loads(value)
                except Exception as e:
                    logger.debug(f"Redis get error: {e}")

            # Fallback to in-memory cache
            cache = self._get_cache_for_type(cache_type)
            cache_key = f"{cache_type}:{key}"

            if cache_key in cache:
                self._stats["hits"] += 1
                return cache[cache_key]

            self._stats["misses"] += 1
            return default

        except Exception as e:
            logger.error(f"Cache get error: {e}")
            self._stats["errors"] += 1
            return default

    def set(self, cache_type: str, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set value in cache.

        Args:
            cache_type: Type of cache (employee, department, shift, etc.)
            key: Cache key
            value: Value to cache
            ttl: Optional custom TTL (uses config default if not provided)

        Returns:
            True if successful, False otherwise
        """
        if not self._enabled:
            return False

        try:
            # Store in Redis if available
            if self._redis_client:
                try:
                    redis_key = CacheConfig.get_cache_key(cache_type, key)
                    redis_ttl = ttl or CacheConfig.get_ttl(f"{cache_type}_by_id")
                    self._redis_client.setex(redis_key, redis_ttl, json.dumps(value))
                except Exception as e:
                    logger.debug(f"Redis set error: {e}")

            # Store in in-memory cache
            cache = self._get_cache_for_type(cache_type)
            cache_key = f"{cache_type}:{key}"
            cache[cache_key] = value

            self._stats["sets"] += 1
            return True

        except Exception as e:
            logger.error(f"Cache set error: {e}")
            self._stats["errors"] += 1
            return False

    def delete(self, cache_type: str, key: str) -> bool:
        """
        Delete value from cache.

        Args:
            cache_type: Type of cache (employee, department, shift, etc.)
            key: Cache key

        Returns:
            True if successful, False otherwise
        """
        if not self._enabled:
            return False

        try:
            # Delete from Redis if available
            if self._redis_client:
                try:
                    redis_key = CacheConfig.get_cache_key(cache_type, key)
                    self._redis_client.delete(redis_key)
                except Exception as e:
                    logger.debug(f"Redis delete error: {e}")

            # Delete from in-memory cache
            cache = self._get_cache_for_type(cache_type)
            cache_key = f"{cache_type}:{key}"

            if cache_key in cache:
                del cache[cache_key]

            self._stats["deletes"] += 1
            return True

        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            self._stats["errors"] += 1
            return False

    def clear(self, cache_type: Optional[str] = None) -> bool:
        """
        Clear cache.

        Args:
            cache_type: Optional specific cache type to clear (clears all if None)

        Returns:
            True if successful, False otherwise
        """
        if not self._enabled:
            return False

        try:
            if cache_type:
                # Clear specific cache
                cache = self._get_cache_for_type(cache_type)
                cache.clear()

                # Clear from Redis if available
                if self._redis_client:
                    try:
                        pattern = CacheConfig.get_cache_key(cache_type, "*")
                        keys = self._redis_client.keys(pattern)
                        if keys:
                            self._redis_client.delete(*keys)
                    except Exception as e:
                        logger.debug(f"Redis clear error: {e}")
            else:
                # Clear all caches
                self._employees_cache.clear()
                self._departments_cache.clear()
                self._shifts_cache.clear()
                self._schedules_cache.clear()
                self._rules_cache.clear()
                self._notifications_cache.clear()
                self._general_cache.clear()

                # Clear all from Redis if available
                if self._redis_client:
                    try:
                        pattern = f"{CacheConfig.KEY_PREFIX}*"
                        keys = self._redis_client.keys(pattern)
                        if keys:
                            self._redis_client.delete(*keys)
                    except Exception as e:
                        logger.debug(f"Redis clear error: {e}")

            logger.info(f"Cache cleared: {cache_type or 'all'}")
            return True

        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            self._stats["errors"] += 1
            return False

    def invalidate_pattern(self, cache_type: str, pattern: str) -> int:
        """
        Invalidate all cache keys matching a pattern.

        Args:
            cache_type: Type of cache
            pattern: Pattern to match (e.g., "employee:*" or "employee:123:*")

        Returns:
            Number of keys invalidated
        """
        if not self._enabled:
            return 0

        count = 0
        try:
            # Invalidate in in-memory cache
            cache = self._get_cache_for_type(cache_type)
            prefix = f"{cache_type}:"
            keys_to_delete = [k for k in cache.keys() if k.startswith(prefix) and self._match_pattern(k, pattern)]

            for key in keys_to_delete:
                del cache[key]
                count += 1

            # Invalidate in Redis if available
            if self._redis_client:
                try:
                    redis_pattern = CacheConfig.get_cache_key(cache_type, pattern)
                    redis_keys = self._redis_client.keys(redis_pattern)
                    if redis_keys:
                        self._redis_client.delete(*redis_keys)
                        count += len(redis_keys)
                except Exception as e:
                    logger.debug(f"Redis pattern invalidation error: {e}")

            logger.debug(f"Invalidated {count} keys matching pattern: {pattern}")
            return count

        except Exception as e:
            logger.error(f"Cache pattern invalidation error: {e}")
            self._stats["errors"] += 1
            return count

    def _match_pattern(self, key: str, pattern: str) -> bool:
        """Simple pattern matching for cache keys."""
        if pattern.endswith("*"):
            return key.startswith(pattern[:-1])
        return key == pattern

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0

        return {
            "enabled": self._enabled,
            "redis_enabled": self._redis_client is not None,
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "sets": self._stats["sets"],
            "deletes": self._stats["deletes"],
            "errors": self._stats["errors"],
            "total_requests": total_requests,
            "hit_rate": round(hit_rate, 2),
            "cache_sizes": {
                "employees": len(self._employees_cache),
                "departments": len(self._departments_cache),
                "shifts": len(self._shifts_cache),
                "schedules": len(self._schedules_cache),
                "rules": len(self._rules_cache),
                "notifications": len(self._notifications_cache),
                "general": len(self._general_cache),
            },
        }

    def reset_stats(self):
        """Reset cache statistics."""
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "errors": 0,
        }
        logger.info("Cache statistics reset")


# Global cache manager instance
cache_manager = CacheManager()


def cached(cache_type: str, key_func: Callable[[Any], str], ttl: Optional[int] = None):
    """
    Decorator for caching function results.

    Args:
        cache_type: Type of cache (employee, department, shift, etc.)
        key_func: Function to generate cache key from function arguments
        ttl: Optional custom TTL

    Example:
        @cached("employee", lambda db, id: f"id:{id}")
        async def get_employee(db, id):
            # ... database query
            pass
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not cache_manager._enabled:
                return await func(*args, **kwargs)

            try:
                # Generate cache key from arguments
                cache_key = key_func(*args, **kwargs)

                # Try to get from cache
                cached_value = cache_manager.get(cache_type, cache_key)
                if cached_value is not None:
                    logger.debug(f"Cache hit: {cache_type}:{cache_key}")
                    return cached_value

                # Cache miss - call function
                logger.debug(f"Cache miss: {cache_type}:{cache_key}")
                result = await func(*args, **kwargs)

                # Store result in cache
                if result is not None:
                    cache_manager.set(cache_type, cache_key, result, ttl)

                return result

            except Exception as e:
                logger.error(f"Cache decorator error: {e}")
                # Fallback to calling function without caching
                return await func(*args, **kwargs)

        return wrapper

    return decorator


# Utility functions for common cache operations
def invalidate_employee_cache(employee_id: Optional[int] = None, email: Optional[str] = None):
    """Invalidate employee cache entries."""
    if employee_id:
        cache_manager.delete("employee", f"id:{employee_id}")
    if email:
        cache_manager.delete("employee", f"email:{email}")
    # Invalidate employee list cache
    cache_manager.invalidate_pattern("employee", "list:*")


def invalidate_department_cache(department_id: Optional[int] = None):
    """Invalidate department cache entries."""
    if department_id:
        cache_manager.delete("department", f"id:{department_id}")
        cache_manager.invalidate_pattern("department", f"hierarchy:{department_id}:*")
    # Invalidate department list cache
    cache_manager.invalidate_pattern("department", "list:*")


def invalidate_shift_cache(shift_id: Optional[int] = None, shift_name: Optional[str] = None):
    """Invalidate shift cache entries."""
    if shift_id:
        cache_manager.delete("shift", f"id:{shift_id}")
    if shift_name:
        cache_manager.delete("shift", f"name:{shift_name}")
    # Invalidate shift types cache
    cache_manager.delete("shift", "types")


def invalidate_schedule_cache(schedule_id: Optional[int] = None):
    """Invalidate schedule cache entries."""
    if schedule_id:
        cache_manager.delete("schedule", f"id:{schedule_id}")
        cache_manager.invalidate_pattern("schedule", f"assignments:{schedule_id}:*")


def invalidate_all_caches():
    """Clear all caches."""
    cache_manager.clear()
