"""Database connection pooling and optimization."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.pool import NullPool, QueuePool
from sqlalchemy import event, text
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections with pooling."""
    
    def __init__(self, database_url: str, **kwargs):
        """Initialize database manager with connection pooling."""
        # Convert to async URL if needed
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
        
        # Configure connection pool
        pool_config = {
            "pool_size": kwargs.get("pool_size", 20),
            "max_overflow": kwargs.get("max_overflow", 10),
            "pool_timeout": kwargs.get("pool_timeout", 30),
            "pool_recycle": kwargs.get("pool_recycle", 1800),
            "pool_pre_ping": True,  # Verify connections before using
        }
        
        # Create engine with optimized settings
        self.engine: AsyncEngine = create_async_engine(
            database_url,
            poolclass=QueuePool,
            echo=kwargs.get("echo", False),
            future=True,
            query_cache_size=1200,  # Cache parsed SQL statements
            **pool_config
        )
        
        # Create session factory
        self.async_session = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,  # Don't expire objects after commit
            autoflush=False,  # Control flushing manually
            autocommit=False
        )
        
        self._setup_listeners()
        logger.info("Database manager initialized with connection pooling")
    
    def _setup_listeners(self):
        """Set up event listeners for monitoring."""
        @event.listens_for(self.engine.sync_engine, "connect")
        def receive_connect(dbapi_conn, connection_record):
            """Configure connection on connect."""
            connection_record.info['connect_time'] = datetime.now()
            
            # Set connection-level optimizations for PostgreSQL
            with dbapi_conn.cursor() as cursor:
                # Increase work memory for complex queries
                cursor.execute("SET work_mem = '16MB'")
                # Optimize for read-heavy workload
                cursor.execute("SET random_page_cost = 1.1")
                # Enable parallel queries
                cursor.execute("SET max_parallel_workers_per_gather = 2")
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session with automatic cleanup."""
        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def execute_query(self, query: str, params: Optional[dict] = None):
        """Execute raw SQL query with parameters."""
        async with self.get_session() as session:
            result = await session.execute(text(query), params or {})
            return result.fetchall()
    
    async def health_check(self) -> bool:
        """Check database connectivity."""
        try:
            async with self.get_session() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    async def get_pool_status(self) -> dict:
        """Get connection pool statistics."""
        pool = self.engine.pool
        return {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total": pool.size() + pool.overflow()
        }
    
    async def optimize_tables(self):
        """Run maintenance operations on tables."""
        async with self.get_session() as session:
            # Analyze tables for query planner
            tables = ["employees", "shifts", "schedules", "rules", "constraints"]
            for table in tables:
                try:
                    await session.execute(text(f"ANALYZE {table}"))
                    logger.info(f"Analyzed table {table}")
                except Exception as e:
                    logger.warning(f"Could not analyze {table}: {e}")
    
    async def close(self):
        """Close all database connections."""
        await self.engine.dispose()
        logger.info("Database connections closed")


class QueryOptimizer:
    """Utilities for query optimization."""
    
    @staticmethod
    def add_indexes_sql() -> list:
        """SQL statements to create optimized indexes."""
        return [
            # Employees indexes
            "CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active) WHERE active = true",
            "CREATE INDEX IF NOT EXISTS idx_employees_qualifications ON employees USING GIN(qualifications)",
            
            # Shifts indexes  
            "CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)",
            "CREATE INDEX IF NOT EXISTS idx_shifts_date_time ON shifts(date, start_time, end_time)",
            "CREATE INDEX IF NOT EXISTS idx_shifts_type ON shifts(shift_type)",
            
            # Schedules indexes
            "CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date)",
            "CREATE INDEX IF NOT EXISTS idx_schedules_employee ON schedules(employee_id)",
            "CREATE INDEX IF NOT EXISTS idx_schedules_shift ON schedules(shift_id)",
            "CREATE INDEX IF NOT EXISTS idx_schedules_composite ON schedules(date, employee_id, shift_id)",
            
            # Rules indexes
            "CREATE INDEX IF NOT EXISTS idx_rules_type ON rules(rule_type)",
            "CREATE INDEX IF NOT EXISTS idx_rules_employee ON rules(employee_id) WHERE employee_id IS NOT NULL",
            "CREATE INDEX IF NOT EXISTS idx_rules_active ON rules(active) WHERE active = true",
            
            # Constraints indexes
            "CREATE INDEX IF NOT EXISTS idx_constraints_type ON constraints(constraint_type)",
            "CREATE INDEX IF NOT EXISTS idx_constraints_priority ON constraints(priority)",
        ]
    
    @staticmethod
    async def create_indexes(db: DatabaseManager):
        """Create all optimized indexes."""
        for index_sql in QueryOptimizer.add_indexes_sql():
            try:
                await db.execute_query(index_sql)
                logger.info(f"Created index: {index_sql.split('idx_')[1].split(' ')[0]}")
            except Exception as e:
                logger.warning(f"Index creation failed: {e}")


# Import datetime for the event listener
from datetime import datetime