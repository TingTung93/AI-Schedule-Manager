"""Caching utilities for performance optimization."""
import json
import hashlib
from typing import Any, Optional, Callable
from datetime import datetime, timedelta
import redis
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class CacheManager:
    """Manages caching strategies for the application."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        """Initialize cache manager with Redis connection."""
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
            self.enabled = True
            logger.info("Redis cache connected successfully")
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis not available, using memory cache: {e}")
            self.redis_client = None
            self.enabled = False
            self.memory_cache = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled:
            return self.memory_cache.get(key)
        
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache with TTL in seconds."""
        if not self.enabled:
            self.memory_cache[key] = value
            return True
        
        try:
            serialized = json.dumps(value)
            return self.redis_client.setex(key, ttl, serialized)
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self.enabled:
            self.memory_cache.pop(key, None)
            return True
        
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern."""
        if not self.enabled:
            keys_deleted = 0
            for key in list(self.memory_cache.keys()):
                if pattern.replace('*', '') in key:
                    del self.memory_cache[key]
                    keys_deleted += 1
            return keys_deleted
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
        return 0
    
    @staticmethod
    def generate_key(*args, **kwargs) -> str:
        """Generate cache key from arguments."""
        key_data = {
            'args': args,
            'kwargs': kwargs
        }
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()


def cache_result(ttl: int = 3600, prefix: str = ""):
    """Decorator to cache function results."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{prefix}:{func.__name__}:{CacheManager.generate_key(*args, **kwargs)}"
            
            # Try to get from cache
            cache_manager = kwargs.pop('cache_manager', None)
            if cache_manager:
                cached = cache_manager.get(cache_key)
                if cached is not None:
                    logger.debug(f"Cache hit for {cache_key}")
                    return cached
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            if cache_manager and result is not None:
                cache_manager.set(cache_key, result, ttl)
                logger.debug(f"Cached result for {cache_key}")
            
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{prefix}:{func.__name__}:{CacheManager.generate_key(*args, **kwargs)}"
            
            # Try to get from cache
            cache_manager = kwargs.pop('cache_manager', None)
            if cache_manager:
                cached = cache_manager.get(cache_key)
                if cached is not None:
                    logger.debug(f"Cache hit for {cache_key}")
                    return cached
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            if cache_manager and result is not None:
                cache_manager.set(cache_key, result, ttl)
                logger.debug(f"Cached result for {cache_key}")
            
            return result
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


class ScheduleCache:
    """Specialized cache for schedule results."""
    
    def __init__(self, cache_manager: CacheManager):
        """Initialize schedule cache."""
        self.cache = cache_manager
        self.prefix = "schedule"
    
    def get_schedule(self, 
                     employees: list, 
                     shifts: list, 
                     constraints: list) -> Optional[dict]:
        """Get cached schedule if exists."""
        key = self._generate_schedule_key(employees, shifts, constraints)
        return self.cache.get(f"{self.prefix}:{key}")
    
    def set_schedule(self, 
                     employees: list, 
                     shifts: list, 
                     constraints: list,
                     schedule: dict,
                     ttl: int = 1800):
        """Cache schedule result."""
        key = self._generate_schedule_key(employees, shifts, constraints)
        return self.cache.set(f"{self.prefix}:{key}", schedule, ttl)
    
    def invalidate_employee_schedules(self, employee_id: str):
        """Invalidate all schedules containing specific employee."""
        return self.cache.clear_pattern(f"{self.prefix}:*{employee_id}*")
    
    def invalidate_date_schedules(self, date: str):
        """Invalidate all schedules for specific date."""
        return self.cache.clear_pattern(f"{self.prefix}:*{date}*")
    
    def _generate_schedule_key(self, employees, shifts, constraints) -> str:
        """Generate unique key for schedule parameters."""
        key_data = {
            'employee_ids': sorted([e.get('id') or e for e in employees]),
            'shift_ids': sorted([s.get('id') or s for s in shifts]),
            'constraint_hashes': sorted([
                hashlib.md5(json.dumps(c, sort_keys=True).encode()).hexdigest()
                for c in constraints
            ])
        }
        return CacheManager.generate_key(**key_data)


class RuleCache:
    """Cache for parsed rules to avoid re-parsing."""
    
    def __init__(self, cache_manager: CacheManager):
        """Initialize rule cache."""
        self.cache = cache_manager
        self.prefix = "rule"
    
    def get_parsed_rule(self, rule_text: str) -> Optional[dict]:
        """Get cached parsed rule."""
        key = hashlib.md5(rule_text.encode()).hexdigest()
        return self.cache.get(f"{self.prefix}:{key}")
    
    def set_parsed_rule(self, rule_text: str, parsed: dict, ttl: int = 86400):
        """Cache parsed rule (24 hour TTL by default)."""
        key = hashlib.md5(rule_text.encode()).hexdigest()
        return self.cache.set(f"{self.prefix}:{key}", parsed, ttl)
    
    def invalidate_all_rules(self):
        """Clear all cached rules."""
        return self.cache.clear_pattern(f"{self.prefix}:*")