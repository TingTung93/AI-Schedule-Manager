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

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # Set to False in production
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=20,
    max_overflow=30,
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
