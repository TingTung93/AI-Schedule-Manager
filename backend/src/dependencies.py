"""
FastAPI dependencies for database sessions, authentication, and validation.
"""

import logging
from typing import AsyncGenerator, Optional

from fastapi import Depends, HTTPException, Header, Cookie, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .auth.auth import auth_service, AuthenticationError
from .auth.models import User
from .core.config import settings
from .database import get_db_session

logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    from .database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_database_session),
    access_token: Optional[str] = Cookie(None)
) -> User:
    """
    Dependency to get current authenticated user from JWT token.

    Validates JWT token from Authorization header or access_token cookie
    and returns the authenticated user.

    Args:
        authorization: Authorization header with Bearer token
        db: Database session
        access_token: JWT token from access_token cookie (automatic via FastAPI Cookie dependency)

    Returns:
        User: Authenticated user object

    Raises:
        HTTPException: 401 if authentication fails, 403 if user is inactive
    """
    token = None

    # Try to get token from Authorization header first
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]

    # Fallback to cookie if no Authorization header
    if not token and access_token:
        token = access_token
        logger.debug("Using token from access_token cookie")

    # Check if we have a token from either source
    if not token:
        logger.warning("Missing authentication - no Authorization header or cookie")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Authorization header or cookie required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Verify and decode JWT token
        payload = auth_service.verify_access_token(token)

        if not payload:
            logger.warning("Token verification returned empty payload")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Extract user ID from token
        user_id = payload.get("user_id")

        if not user_id:
            logger.warning("Token payload missing user_id")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Query user from database with roles preloaded
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"User {user_id} not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check if user account is active
        if not user.is_active:
            logger.warning(f"Inactive user attempted access: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )

        # Check if account is locked
        if user.is_account_locked():
            logger.warning(f"Locked user attempted access: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is locked"
            )

        logger.info(f"Successfully authenticated user: {user.email}")
        return user

    except AuthenticationError as e:
        logger.warning(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during authentication"
        )


async def get_current_manager(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure current user has manager role.

    Args:
        current_user: Authenticated user from get_current_user

    Returns:
        User: User with manager role

    Raises:
        HTTPException: 403 if user is not a manager
    """
    # Check if user has manager or admin role (admins have all manager permissions)
    if not (current_user.has_role("manager") or current_user.has_role("admin")):
        logger.warning(f"User {current_user.email} attempted manager access without role")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Manager role required."
        )

    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure current user has admin role.

    Args:
        current_user: Authenticated user from get_current_user

    Returns:
        User: User with admin role

    Raises:
        HTTPException: 403 if user is not an admin
    """
    # Check if user has admin role
    if not current_user.has_role("admin"):
        logger.warning(f"User {current_user.email} attempted admin access without role")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin role required."
        )

    return current_user


async def validate_pagination(page: int = 1, size: int = 10) -> dict:
    """Validate pagination parameters."""
    if page < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page must be >= 1"
        )
    if size < 1 or size > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Size must be between 1 and 100"
        )
    return {"page": page, "size": size}


async def validate_sort_params(sort_by: str = "id", sort_order: str = "asc") -> dict:
    """Validate sorting parameters."""
    if sort_order not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sort order must be 'asc' or 'desc'"
        )
    return {"sort_by": sort_by, "sort_order": sort_order}


def require_roles(*allowed_roles: str):
    """
    FastAPI dependency factory to require specific roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
        async def admin_endpoint():
            return {"message": "Admin access granted"}

    Args:
        *allowed_roles: One or more role names that are allowed access

    Returns:
        FastAPI dependency function

    Raises:
        HTTPException: 403 if user doesn't have required role
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if current user has one of the allowed roles."""
        user_roles = [role.name for role in current_user.roles]

        if not any(role in allowed_roles for role in user_roles):
            logger.warning(
                f"User {current_user.email} denied access. Required roles: {allowed_roles}, "
                f"User roles: {user_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(allowed_roles)}"
            )

        return current_user

    return role_checker


def require_permissions(*required_permissions: str):
    """
    FastAPI dependency factory to require specific permissions.

    Usage:
        @router.delete("/user/{id}", dependencies=[Depends(require_permissions("user.delete"))])
        async def delete_user(id: int):
            return {"message": "User deleted"}

    Args:
        *required_permissions: One or more permission names required for access

    Returns:
        FastAPI dependency function

    Raises:
        HTTPException: 403 if user doesn't have required permission
    """
    async def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if current user has one of the required permissions."""
        user_permissions = set(current_user.permissions)
        required_perms = set(required_permissions)

        # Check if user has any of the required permissions
        if not required_perms.intersection(user_permissions):
            logger.warning(
                f"User {current_user.email} denied access. Required permissions: {required_permissions}, "
                f"User permissions: {list(user_permissions)}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required permission: {' or '.join(required_permissions)}"
            )

        return current_user

    return permission_checker
