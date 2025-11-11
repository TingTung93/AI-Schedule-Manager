import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import redis.asyncio as redis
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool, StaticPool


# Database connection pooling configuration
class DatabaseOptimizer:
    def __init__(self, database_url: str, redis_url: str = "redis://localhost:6379"):
        self.database_url = database_url
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.query_cache: Dict[str, Any] = {}
        self.query_stats: Dict[str, Dict] = {}

    async def initialize_redis(self):
        """Initialize Redis connection for caching"""
        try:
            self.redis_client = redis.from_url(self.redis_url, encoding="utf-8", decode_responses=True)
            await self.redis_client.ping()
            logging.info("Redis connection established")
        except Exception as e:
            logging.warning(f"Redis connection failed: {e}. Falling back to in-memory cache.")
            self.redis_client = None

    def configure_engine_pool(self, engine):
        """Configure connection pooling for optimal performance"""
        if "postgresql" in self.database_url:
            # PostgreSQL optimizations
            engine.pool = QueuePool(
                engine.pool._creator, pool_size=20, max_overflow=30, pool_timeout=30, pool_recycle=3600, pool_pre_ping=True
            )
        return engine

    @asynccontextmanager
    async def get_cached_session(self, cache_key: str = None):
        """Context manager for database sessions with caching"""
        session = None
        try:
            # Create session here - this would integrate with your actual session factory
            session = Session()  # Replace with your session factory
            yield session
        finally:
            if session:
                session.close()

    async def cache_query_result(self, cache_key: str, result: Any, ttl: int = 300):
        """Cache query results with TTL"""
        try:
            serialized_result = json.dumps(result, default=str)

            if self.redis_client:
                await self.redis_client.setex(cache_key, ttl, serialized_result)
            else:
                # Fallback to in-memory cache with expiration
                self.query_cache[cache_key] = {"data": serialized_result, "expires": datetime.now() + timedelta(seconds=ttl)}
        except Exception as e:
            logging.warning(f"Failed to cache query result: {e}")

    async def get_cached_result(self, cache_key: str):
        """Retrieve cached query result"""
        try:
            if self.redis_client:
                result = await self.redis_client.get(cache_key)
                return json.loads(result) if result else None
            else:
                # Check in-memory cache
                cached = self.query_cache.get(cache_key)
                if cached and datetime.now() < cached["expires"]:
                    return json.loads(cached["data"])
                elif cached:
                    # Remove expired cache
                    del self.query_cache[cache_key]
        except Exception as e:
            logging.warning(f"Failed to retrieve cached result: {e}")
        return None

    def track_query_performance(self, query: str, execution_time: float):
        """Track query performance for optimization insights"""
        if query not in self.query_stats:
            self.query_stats[query] = {"count": 0, "total_time": 0, "max_time": 0, "min_time": float("inf")}

        stats = self.query_stats[query]
        stats["count"] += 1
        stats["total_time"] += execution_time
        stats["max_time"] = max(stats["max_time"], execution_time)
        stats["min_time"] = min(stats["min_time"], execution_time)

        # Log slow queries
        if execution_time > 1.0:  # Queries taking more than 1 second
            logging.warning(f"Slow query detected ({execution_time:.2f}s): {query[:100]}...")

    def get_performance_report(self):
        """Generate performance report for all tracked queries"""
        report = []
        for query, stats in self.query_stats.items():
            avg_time = stats["total_time"] / stats["count"] if stats["count"] > 0 else 0
            report.append(
                {
                    "query": query[:100] + "..." if len(query) > 100 else query,
                    "count": stats["count"],
                    "avg_time": round(avg_time, 3),
                    "max_time": round(stats["max_time"], 3),
                    "min_time": round(stats["min_time"], 3),
                    "total_time": round(stats["total_time"], 3),
                }
            )

        # Sort by total time (most expensive queries first)
        return sorted(report, key=lambda x: x["total_time"], reverse=True)


# Query optimization decorators and utilities
def cached_query(cache_key_func, ttl: int = 300):
    """Decorator for caching database queries"""

    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache_key_func(*args, **kwargs)

            # Try to get from cache first
            optimizer = kwargs.get("optimizer") or getattr(args[0], "optimizer", None)
            if optimizer:
                cached_result = await optimizer.get_cached_result(cache_key)
                if cached_result is not None:
                    return cached_result

            # Execute query and cache result
            start_time = time.time()
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time

            # Cache and track performance
            if optimizer:
                await optimizer.cache_query_result(cache_key, result, ttl)
                optimizer.track_query_performance(str(func.__name__), execution_time)

            return result

        return wrapper

    return decorator


# SQLAlchemy event listeners for performance monitoring
@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()


@event.listens_for(Engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - context._query_start_time

    # Log slow queries
    if total > 0.5:  # Queries taking more than 500ms
        logging.warning(f"Slow query ({total:.2f}s): {statement[:200]}...")


# Database indexing recommendations
class IndexOptimizer:
    def __init__(self, session):
        self.session = session

    async def analyze_missing_indexes(self):
        """Analyze queries to suggest missing indexes"""
        # This would analyze slow queries and suggest indexes
        # Implementation depends on your specific database and ORM usage
        suggestions = []

        # Example analysis for common patterns
        slow_queries = [
            "SELECT * FROM employees WHERE department_id = ?",
            "SELECT * FROM schedules WHERE employee_id = ? AND date BETWEEN ? AND ?",
            "SELECT * FROM shifts WHERE status = 'active'",
        ]

        index_suggestions = [
            "CREATE INDEX idx_employees_department ON employees(department_id);",
            "CREATE INDEX idx_schedules_employee_date ON schedules(employee_id, date);",
            "CREATE INDEX idx_shifts_status ON shifts(status);",
        ]

        return index_suggestions

    async def create_recommended_indexes(self):
        """Create recommended indexes for better performance"""
        indexes = await self.analyze_missing_indexes()

        for index_sql in indexes:
            try:
                await self.session.execute(text(index_sql))
                logging.info(f"Created index: {index_sql}")
            except Exception as e:
                logging.warning(f"Failed to create index: {e}")


# Pagination utility for large datasets
class OptimizedPagination:
    def __init__(self, query, page: int = 1, per_page: int = 20):
        self.query = query
        self.page = max(1, page)
        self.per_page = min(100, max(1, per_page))  # Limit max items per page

    async def paginate(self):
        """Efficient pagination with cursor-based approach for large datasets"""
        offset = (self.page - 1) * self.per_page

        # Get total count efficiently
        count_query = self.query.statement.with_only_columns([text("COUNT(*)")]).order_by(None)
        total = await self.query.session.execute(count_query).scalar()

        # Get paginated results
        items = await self.query.offset(offset).limit(self.per_page).all()

        return {
            "items": items,
            "page": self.page,
            "per_page": self.per_page,
            "total": total,
            "pages": (total + self.per_page - 1) // self.per_page,
            "has_prev": self.page > 1,
            "has_next": self.page * self.per_page < total,
        }
