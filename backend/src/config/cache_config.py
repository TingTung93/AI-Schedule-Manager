"""
Cache configuration settings.
Defines TTL values, size limits, and cache strategies for different data types.
"""

from typing import Dict


class CacheConfig:
    """Cache configuration for the application."""

    # Enable/disable caching globally
    CACHE_ENABLED = True

    # Default TTL values (in seconds)
    DEFAULT_TTL = 300  # 5 minutes

    # Specific TTL values for different data types
    TTL_CONFIG: Dict[str, int] = {
        # Employee data - moderate TTL (changes occasionally)
        "employee_by_id": 600,  # 10 minutes
        "employee_by_email": 600,  # 10 minutes
        "employee_list": 300,  # 5 minutes
        # Department data - longer TTL (changes infrequently)
        "department_by_id": 900,  # 15 minutes
        "department_hierarchy": 1800,  # 30 minutes
        "department_list": 600,  # 10 minutes
        # Shift data - moderate TTL
        "shift_by_id": 600,  # 10 minutes
        "shift_by_name": 600,  # 10 minutes
        "shift_types": 900,  # 15 minutes
        # Schedule data - shorter TTL (changes frequently)
        "schedule_by_id": 180,  # 3 minutes
        "schedule_assignments": 180,  # 3 minutes
        # Rule data - longer TTL (changes infrequently)
        "rule_by_id": 900,  # 15 minutes
        "active_rules": 600,  # 10 minutes
        # Notification data - very short TTL (real-time)
        "notification_by_id": 60,  # 1 minute
        "unread_notifications": 30,  # 30 seconds
    }

    # Cache size limits (max number of items)
    MAX_CACHE_SIZES: Dict[str, int] = {
        "employees": 1000,
        "departments": 200,
        "shifts": 500,
        "schedules": 500,
        "rules": 1000,
        "notifications": 2000,
        "general": 1000,  # For miscellaneous cached data
    }

    # Redis configuration (optional - fallback to in-memory if not available)
    REDIS_ENABLED = False
    REDIS_HOST = "localhost"
    REDIS_PORT = 6379
    REDIS_DB = 0
    REDIS_PASSWORD = None
    REDIS_DECODE_RESPONSES = True

    # Cache key prefixes
    KEY_PREFIX = "ai_schedule:"

    # Cache strategies
    CACHE_STRATEGIES = {
        "employee": "lru",  # Least Recently Used
        "department": "lru",
        "shift": "lru",
        "schedule": "ttl",  # Time-based eviction only
        "rule": "lru",
        "notification": "ttl",  # Time-based eviction only
    }

    @classmethod
    def get_ttl(cls, cache_type: str) -> int:
        """Get TTL for a specific cache type."""
        return cls.TTL_CONFIG.get(cache_type, cls.DEFAULT_TTL)

    @classmethod
    def get_max_size(cls, cache_type: str) -> int:
        """Get max size for a specific cache type."""
        return cls.MAX_CACHE_SIZES.get(cache_type, cls.MAX_CACHE_SIZES["general"])

    @classmethod
    def get_cache_key(cls, cache_type: str, identifier: str) -> str:
        """Generate cache key with prefix."""
        return f"{cls.KEY_PREFIX}{cache_type}:{identifier}"
