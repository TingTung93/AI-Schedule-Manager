"""
Template caching utilities.
"""

import logging
import threading
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class TemplateCache:
    """In-memory template cache with TTL support."""

    def __init__(self, ttl: int = 3600, max_size: int = 1000):
        """Initialize template cache."""
        self.ttl = ttl
        self.max_size = max_size
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        """Get item from cache."""
        try:
            with self._lock:
                if key not in self._cache:
                    return None

                cache_item = self._cache[key]

                # Check if expired
                if time.time() > cache_item["expires_at"]:
                    del self._cache[key]
                    return None

                # Update access time
                cache_item["accessed_at"] = time.time()
                return cache_item["value"]

        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set item in cache."""
        try:
            with self._lock:
                # Check if cache is full
                if len(self._cache) >= self.max_size and key not in self._cache:
                    self._evict_oldest()

                expires_at = time.time() + (ttl or self.ttl)

                self._cache[key] = {
                    "value": value,
                    "created_at": time.time(),
                    "accessed_at": time.time(),
                    "expires_at": expires_at,
                }

                return True

        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete item from cache."""
        try:
            with self._lock:
                if key in self._cache:
                    del self._cache[key]
                    return True
                return False

        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False

    def clear(self) -> bool:
        """Clear all items from cache."""
        try:
            with self._lock:
                self._cache.clear()
                return True

        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False

    def _evict_oldest(self) -> None:
        """Evict oldest accessed item from cache."""
        if not self._cache:
            return

        # Find oldest accessed item
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]["accessed_at"])

        del self._cache[oldest_key]

    def cleanup_expired(self) -> int:
        """Remove expired items from cache."""
        try:
            with self._lock:
                current_time = time.time()
                expired_keys = [key for key, item in self._cache.items() if current_time > item["expires_at"]]

                for key in expired_keys:
                    del self._cache[key]

                logger.debug(f"Cleaned up {len(expired_keys)} expired cache items")
                return len(expired_keys)

        except Exception as e:
            logger.error(f"Cache cleanup error: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        try:
            with self._lock:
                current_time = time.time()

                total_items = len(self._cache)
                expired_items = sum(1 for item in self._cache.values() if current_time > item["expires_at"])

                return {
                    "total_items": total_items,
                    "expired_items": expired_items,
                    "active_items": total_items - expired_items,
                    "max_size": self.max_size,
                    "utilization": total_items / self.max_size if self.max_size > 0 else 0,
                    "ttl": self.ttl,
                }

        except Exception as e:
            logger.error(f"Cache stats error: {e}")
            return {"error": str(e), "total_items": 0, "active_items": 0}

    def exists(self, key: str) -> bool:
        """Check if key exists and is not expired."""
        try:
            with self._lock:
                if key not in self._cache:
                    return False

                # Check if expired
                if time.time() > self._cache[key]["expires_at"]:
                    del self._cache[key]
                    return False

                return True

        except Exception as e:
            logger.error(f"Cache exists error: {e}")
            return False

    def extend_ttl(self, key: str, additional_seconds: int) -> bool:
        """Extend TTL for existing cache item."""
        try:
            with self._lock:
                if key not in self._cache:
                    return False

                cache_item = self._cache[key]

                # Check if not already expired
                if time.time() > cache_item["expires_at"]:
                    del self._cache[key]
                    return False

                cache_item["expires_at"] += additional_seconds
                return True

        except Exception as e:
            logger.error(f"Cache extend TTL error: {e}")
            return False
