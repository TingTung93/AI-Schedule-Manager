"""
FastAPI dependencies for database sessions, authentication, and validation.
"""

import logging
from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .core.config import settings
from .core.database import DatabaseManager

logger = logging.getLogger(__name__)

# Initialize database manager
db_manager = DatabaseManager(settings.DATABASE_URL)

# Security
security = HTTPBearer()


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with db_manager.get_session() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user() -> dict:
    """Dependency to get current authenticated user."""
    # For development: return a demo user with manager permissions
    # This allows the frontend to work while we implement proper authentication integration
    # TODO: Integrate with Flask auth backend or implement proper JWT validation
    #
    # In production, this should:
    # 1. Check for Authorization Bearer token OR
    # 2. Validate session cookie from Flask auth backend OR
    # 3. Verify JWT token
    #
    # For now, we allow all requests to proceed with a demo user

    return {
        "id": 1,
        "email": "demo@example.com",
        "full_name": "Demo User",
        "first_name": "Demo",
        "last_name": "User",
        "role": "manager",
        "roles": ["manager"],
        "permissions": ["read", "write", "manage"]
    }


async def get_current_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency to ensure current user is a manager."""
    if current_user.get("role") != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Manager role required.")
    return current_user


async def validate_pagination(page: int = 1, size: int = 10) -> dict:
    """Validate pagination parameters."""
    if page < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Page must be >= 1")
    if size < 1 or size > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Size must be between 1 and 100")
    return {"page": page, "size": size}


async def validate_sort_params(sort_by: str = "id", sort_order: str = "asc") -> dict:
    """Validate sorting parameters."""
    if sort_order not in ["asc", "desc"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sort order must be 'asc' or 'desc'")
    return {"sort_by": sort_by, "sort_order": sort_order}
