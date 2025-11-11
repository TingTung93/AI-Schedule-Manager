import asyncio
import hashlib
import json
import logging
import pickle
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Dict, Optional, Union

import redis.asyncio as redis


class CacheManager:
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.local_cache: Dict[str, Dict] = {}
        self.cache_stats = {"hits": 0, "misses": 0, "sets": 0, "deletes": 0}

    async def connect(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=False,  # We'll handle serialization manually
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
            )
            await self.redis_client.ping()
            logging.info("Redis cache connected successfully")
        except Exception as e:
            logging.warning(f"Redis connection failed: {e}. Using local cache fallback.")
            self.redis_client = None

    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()

    def _serialize_data(self, data: Any) -> bytes:
        """Serialize data for caching"""
        try:
            return pickle.dumps(data)
        except Exception:
            # Fallback to JSON for simple types
            return json.dumps(data, default=str).encode("utf-8")

    def _deserialize_data(self, data: bytes) -> Any:
        """Deserialize cached data"""
        try:
            return pickle.loads(data)
        except Exception:
            # Fallback to JSON
            return json.loads(data.decode("utf-8"))

    def _generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a unique cache key"""
        key_parts = [prefix]

        # Add positional arguments
        for arg in args:
            key_parts.append(str(arg))

        # Add keyword arguments (sorted for consistency)
        for k, v in sorted(kwargs.items()):
            key_parts.append(f"{k}:{v}")

        key_string = ":".join(key_parts)

        # Hash long keys to avoid Redis key length limits
        if len(key_string) > 200:
            return hashlib.sha256(key_string.encode()).hexdigest()

        return key_string

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            # Try Redis first
            if self.redis_client:
                data = await self.redis_client.get(key)
                if data:
                    self.cache_stats["hits"] += 1
                    return self._deserialize_data(data)

            # Fallback to local cache
            cached_item = self.local_cache.get(key)
            if cached_item and datetime.now() < cached_item["expires"]:
                self.cache_stats["hits"] += 1
                return cached_item["data"]
            elif cached_item:
                # Remove expired item
                del self.local_cache[key]

            self.cache_stats["misses"] += 1
            return None

        except Exception as e:
            logging.warning(f"Cache get error: {e}")
            self.cache_stats["misses"] += 1
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        try:
            serialized_data = self._serialize_data(value)

            # Try Redis first
            if self.redis_client:
                await self.redis_client.setex(key, ttl, serialized_data)
                self.cache_stats["sets"] += 1
                return True

            # Fallback to local cache
            self.local_cache[key] = {"data": value, "expires": datetime.now() + timedelta(seconds=ttl)}
            self.cache_stats["sets"] += 1
            return True

        except Exception as e:
            logging.warning(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            deleted = False

            # Delete from Redis
            if self.redis_client:
                result = await self.redis_client.delete(key)
                deleted = bool(result)

            # Delete from local cache
            if key in self.local_cache:
                del self.local_cache[key]
                deleted = True

            if deleted:
                self.cache_stats["deletes"] += 1

            return deleted

        except Exception as e:
            logging.warning(f"Cache delete error: {e}")
            return False

    async def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern"""
        try:
            deleted_count = 0

            if self.redis_client:
                keys = await self.redis_client.keys(pattern)
                if keys:
                    deleted_count = await self.redis_client.delete(*keys)

            # Clear from local cache
            import fnmatch

            keys_to_delete = [key for key in self.local_cache.keys() if fnmatch.fnmatch(key, pattern)]

            for key in keys_to_delete:
                del self.local_cache[key]
                deleted_count += 1

            return deleted_count

        except Exception as e:
            logging.warning(f"Cache clear pattern error: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = (self.cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0

        return {
            **self.cache_stats,
            "hit_rate": round(hit_rate, 2),
            "local_cache_size": len(self.local_cache),
            "redis_connected": self.redis_client is not None,
        }


# Cache decorators
def cached(ttl: int = 300, key_prefix: str = ""):
    """Decorator for caching function results"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache_manager = kwargs.pop("cache_manager", None)
            if not cache_manager:
                return await func(*args, **kwargs)

            # Generate cache key
            cache_key = cache_manager._generate_cache_key(key_prefix or func.__name__, *args, **kwargs)

            # Try to get from cache
            cached_result = await cache_manager.get(cache_key)
            if cached_result is not None:
                return cached_result

            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache_manager.set(cache_key, result, ttl)

            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            return asyncio.run(async_wrapper(*args, **kwargs))

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator


# Specialized caching strategies
class ScheduleCacheManager(CacheManager):
    """Specialized cache manager for schedule-related data"""

    async def cache_employee_schedule(self, employee_id: int, schedule_data: Dict, ttl: int = 1800):
        """Cache employee schedule with 30-minute TTL"""
        key = f"schedule:employee:{employee_id}"
        await self.set(key, schedule_data, ttl)

    async def get_employee_schedule(self, employee_id: int) -> Optional[Dict]:
        """Get cached employee schedule"""
        key = f"schedule:employee:{employee_id}"
        return await self.get(key)

    async def invalidate_employee_schedules(self, employee_ids: list = None):
        """Invalidate employee schedule caches"""
        if employee_ids:
            for employee_id in employee_ids:
                await self.delete(f"schedule:employee:{employee_id}")
        else:
            await self.clear_pattern("schedule:employee:*")

    async def cache_shift_availability(self, date: str, availability_data: Dict, ttl: int = 3600):
        """Cache shift availability for a specific date"""
        key = f"availability:{date}"
        await self.set(key, availability_data, ttl)

    async def get_shift_availability(self, date: str) -> Optional[Dict]:
        """Get cached shift availability"""
        key = f"availability:{date}"
        return await self.get(key)


# Session cache for user data
class SessionCacheManager(CacheManager):
    """Cache manager for user session data"""

    async def set_user_session(self, user_id: int, session_data: Dict, ttl: int = 86400):
        """Cache user session data with 24-hour TTL"""
        key = f"session:user:{user_id}"
        await self.set(key, session_data, ttl)

    async def get_user_session(self, user_id: int) -> Optional[Dict]:
        """Get cached user session"""
        key = f"session:user:{user_id}"
        return await self.get(key)

    async def invalidate_user_session(self, user_id: int):
        """Invalidate user session"""
        key = f"session:user:{user_id}"
        await self.delete(key)


# Query result cache
class QueryCacheManager(CacheManager):
    """Cache manager for database query results"""

    async def cache_query_result(self, query_hash: str, result: Any, ttl: int = 600):
        """Cache database query result"""
        key = f"query:{query_hash}"
        await self.set(key, result, ttl)

    async def get_query_result(self, query_hash: str) -> Optional[Any]:
        """Get cached query result"""
        key = f"query:{query_hash}"
        return await self.get(key)

    def generate_query_hash(self, query_str: str, params: Dict = None) -> str:
        """Generate hash for query caching"""
        query_data = {"query": query_str, "params": params or {}}
        query_json = json.dumps(query_data, sort_keys=True)
        return hashlib.sha256(query_json.encode()).hexdigest()[:16]


# Global cache instance
cache_manager = CacheManager()
schedule_cache = ScheduleCacheManager()
session_cache = SessionCacheManager()
query_cache = QueryCacheManager()
