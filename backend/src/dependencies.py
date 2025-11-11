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


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency to get current authenticated user."""
    # Mock authentication for now
    # In production, verify JWT token here
    token = credentials.credentials
    if not token or not token.startswith("mock-jwt-token-"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract email from mock token
    email = token.replace("mock-jwt-token-", "")
    return {"email": email, "role": "manager" if "admin" in email else "employee"}


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
