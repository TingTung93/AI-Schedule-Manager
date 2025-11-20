"""
Database configuration and session management for AI Schedule Manager
"""

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .models import Base

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/ai_schedule_manager")

# Create async engine with optimized connection pool settings
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Disable SQL logging to reduce overhead
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=300,  # Recycle connections every 5 minutes to prevent stale connections
    pool_size=10,  # Reduced from 30 to prevent pool exhaustion
    max_overflow=10,  # Reduced from 20 to limit total connections
    pool_timeout=10,  # Reduced from 30s - fail fast if pool is exhausted
    connect_args={
        "timeout": 5,  # Quick connection establishment
        "command_timeout": 15,  # Faster query timeout to prevent hangs
        "server_settings": {
            "statement_timeout": "15000",  # 15 second statement timeout (reduced from 30s)
            "idle_in_transaction_session_timeout": "30000",  # 30 second idle transaction timeout (reduced from 60s)
        },
    },
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """
    Create all database tables
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables():
    """
    Drop all database tables
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def close_db_connection():
    """
    Close database connections
    """
    await engine.dispose()


# Database utilities
class DatabaseManager:
    """Database management utilities"""

    @staticmethod
    async def health_check() -> bool:
        """Check database health"""
        try:
            async with AsyncSessionLocal() as session:
                await session.execute("SELECT 1")
                return True
        except Exception:
            return False

    @staticmethod
    async def get_connection_info() -> dict:
        """Get database connection information"""
        return {
            "url": DATABASE_URL.replace(DATABASE_URL.split("://")[1].split("@")[0], "***:***"),
            "pool_size": engine.pool.size(),
            "checked_in": engine.pool.checkedin(),
            "checked_out": engine.pool.checkedout(),
            "overflow": engine.pool.overflow(),
        }

    @staticmethod
    async def reset_database():
        """Reset database - drop and recreate all tables"""
        await drop_tables()
        await create_tables()


# Export commonly used objects
__all__ = [
    "engine",
    "AsyncSessionLocal",
    "get_db_session",
    "create_tables",
    "drop_tables",
    "close_db_connection",
    "DatabaseManager",
    "Base",
]
