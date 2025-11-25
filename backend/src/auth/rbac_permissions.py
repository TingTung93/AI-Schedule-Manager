"""
FastAPI RBAC (Role-Based Access Control) Foundation Module

This module implements comprehensive role-based and permission-based authorization
to fix the critical P0 security vulnerability where any authenticated user can
create/modify/delete all employees.

Security Controls:
- Permission-based access control with granular permissions
- Role-based access control with predefined role-permission mappings
- FastAPI dependency injection for authorization checks
- Async database queries for user role/permission retrieval

Permission Matrix:
┌─────────────────┬───────┬─────────┬──────────┬─────────┐
│ Permission      │ Admin │ Manager │ Employee │ Guest   │
├─────────────────┼───────┼─────────┼──────────┼─────────┤
│ create:employee │   ✓   │    ✓    │    ✗     │    ✗    │
│ read:employee   │   ✓   │    ✓    │    ✓*    │    ✗    │
│ update:employee │   ✓   │    ✓    │    ✗     │    ✗    │
│ delete:employee │   ✓   │    ✗    │    ✗     │    ✗    │
│ manage:roles    │   ✓   │    ✗    │    ✗     │    ✗    │
│ manage:depts    │   ✓   │    ✓**  │    ✗     │    ✗    │
│ view:audit_logs │   ✓   │    ✗    │    ✗     │    ✗    │
└─────────────────┴───────┴─────────┴──────────┴─────────┘
* Employee can read own profile only
** Manager can manage own department only

Usage Example:
    ```python
    from fastapi import Depends
    from .rbac_permissions import require_permission, Permission

    @router.post("/employees")
    async def create_employee(
        employee_data: EmployeeCreate,
        current_user: User = Depends(require_permission(Permission.CREATE_EMPLOYEE))
    ):
        # Only users with create:employee permission can access
        return await employee_service.create(employee_data)
    ```
"""

import logging
from enum import Enum
from typing import List, Optional, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db_session
from .models import User, Role

logger = logging.getLogger(__name__)


class Permission(str, Enum):
    """
    Enumeration of all system permissions.

    Permissions follow the pattern: action:resource
    - create: Create new resources
    - read: View/retrieve resources
    - update: Modify existing resources
    - delete: Remove resources
    - manage: Full administrative control
    - view: Read-only audit access
    """
    # Employee permissions
    CREATE_EMPLOYEE = "create:employee"
    READ_EMPLOYEE = "read:employee"
    UPDATE_EMPLOYEE = "update:employee"
    DELETE_EMPLOYEE = "delete:employee"

    # Department permissions
    CREATE_DEPARTMENT = "create:department"
    READ_DEPARTMENT = "read:department"
    UPDATE_DEPARTMENT = "update:department"
    DELETE_DEPARTMENT = "delete:department"
    MANAGE_DEPARTMENTS = "manage:departments"

    # Schedule permissions
    CREATE_SCHEDULE = "create:schedule"
    READ_SCHEDULE = "read:schedule"
    UPDATE_SCHEDULE = "update:schedule"
    DELETE_SCHEDULE = "delete:schedule"
    PUBLISH_SCHEDULE = "publish:schedule"

    # Role and permission management
    MANAGE_ROLES = "manage:roles"
    MANAGE_PERMISSIONS = "manage:permissions"
    ASSIGN_ROLES = "assign:roles"

    # Audit and monitoring
    VIEW_AUDIT_LOGS = "view:audit_logs"
    VIEW_ANALYTICS = "view:analytics"
    EXPORT_DATA = "export:data"

    # System administration
    MANAGE_SYSTEM = "manage:system"
    MANAGE_USERS = "manage:users"


# Role-Permission Mapping
# Defines which permissions each role has by default
ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    "admin": {
        # Admins have ALL permissions
        Permission.CREATE_EMPLOYEE,
        Permission.READ_EMPLOYEE,
        Permission.UPDATE_EMPLOYEE,
        Permission.DELETE_EMPLOYEE,
        Permission.CREATE_DEPARTMENT,
        Permission.READ_DEPARTMENT,
        Permission.UPDATE_DEPARTMENT,
        Permission.DELETE_DEPARTMENT,
        Permission.MANAGE_DEPARTMENTS,
        Permission.CREATE_SCHEDULE,
        Permission.READ_SCHEDULE,
        Permission.UPDATE_SCHEDULE,
        Permission.DELETE_SCHEDULE,
        Permission.PUBLISH_SCHEDULE,
        Permission.MANAGE_ROLES,
        Permission.MANAGE_PERMISSIONS,
        Permission.ASSIGN_ROLES,
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.MANAGE_SYSTEM,
        Permission.MANAGE_USERS,
    },
    "manager": {
        # Managers can manage employees and schedules in their department
        Permission.CREATE_EMPLOYEE,
        Permission.READ_EMPLOYEE,
        Permission.UPDATE_EMPLOYEE,
        Permission.READ_DEPARTMENT,
        Permission.UPDATE_DEPARTMENT,  # Own department only
        Permission.MANAGE_DEPARTMENTS,  # Own department only
        Permission.CREATE_SCHEDULE,
        Permission.READ_SCHEDULE,
        Permission.UPDATE_SCHEDULE,
        Permission.PUBLISH_SCHEDULE,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_DATA,
    },
    "employee": {
        # Employees have read-only access to their own data
        Permission.READ_EMPLOYEE,  # Own profile only
        Permission.READ_DEPARTMENT,
        Permission.READ_SCHEDULE,  # Own schedule only
    },
    "guest": {
        # Guests have minimal read access
        Permission.READ_SCHEDULE,  # Public schedules only
    },
    "user": {
        # Default user role - same as employee
        Permission.READ_EMPLOYEE,
        Permission.READ_DEPARTMENT,
        Permission.READ_SCHEDULE,
    }
}


async def get_current_user(
    db: AsyncSession = Depends(get_db_session)
) -> User:
    """
    Dependency to get the current authenticated user.

    NOTE: This is a placeholder. In production, this should:
    1. Extract JWT token from Authorization header
    2. Validate token signature and expiration
    3. Extract user_id from token claims
    4. Query database for user with eager-loaded roles

    Args:
        db: Database session

    Returns:
        Current authenticated user with roles loaded

    Raises:
        HTTPException 401: If not authenticated
        HTTPException 403: If user account is locked/inactive
    """
    # TODO: Replace with actual JWT authentication
    # For now, this is a placeholder that will be replaced with proper auth
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. JWT token not found.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_user_roles(
    db: AsyncSession,
    user_id: int
) -> List[str]:
    """
    Get all role names for a user.

    Queries the user_roles association table to retrieve all roles
    assigned to the specified user.

    Args:
        db: Database session
        user_id: User ID to query roles for

    Returns:
        List of role names (e.g., ['admin', 'manager'])

    Example:
        ```python
        roles = await get_user_roles(db, user_id=5)
        # Returns: ['manager', 'employee']
        ```
    """
    try:
        # Query user with eager-loaded roles to avoid N+1 queries
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"User ID {user_id} not found when querying roles")
            return []

        role_names = [role.name for role in user.roles]
        logger.debug(f"User {user_id} has roles: {role_names}")
        return role_names

    except Exception as e:
        logger.error(f"Error querying roles for user {user_id}: {e}", exc_info=True)
        return []


async def get_user_permissions(
    db: AsyncSession,
    user_id: int
) -> Set[Permission]:
    """
    Get all permissions for a user based on their roles.

    Aggregates permissions from all roles assigned to the user.
    Uses the ROLE_PERMISSIONS mapping to determine permissions.

    Args:
        db: Database session
        user_id: User ID to query permissions for

    Returns:
        Set of Permission enums the user has

    Example:
        ```python
        perms = await get_user_permissions(db, user_id=5)
        if Permission.CREATE_EMPLOYEE in perms:
            # User can create employees
        ```
    """
    roles = await get_user_roles(db, user_id)

    if not roles:
        logger.warning(f"User {user_id} has no roles assigned")
        return set()

    # Aggregate permissions from all roles
    permissions: Set[Permission] = set()
    for role_name in roles:
        role_perms = ROLE_PERMISSIONS.get(role_name, set())
        permissions.update(role_perms)
        logger.debug(f"Added {len(role_perms)} permissions from role '{role_name}'")

    logger.info(f"User {user_id} has {len(permissions)} total permissions from roles: {roles}")
    return permissions


async def check_user_role(
    db: AsyncSession,
    user_id: int,
    allowed_roles: List[str]
) -> bool:
    """
    Check if user has at least one of the allowed roles.

    Args:
        db: Database session
        user_id: User ID to check
        allowed_roles: List of role names that are allowed

    Returns:
        True if user has at least one allowed role, False otherwise

    Example:
        ```python
        has_access = await check_user_role(db, user_id=5, allowed_roles=['admin', 'manager'])
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")
        ```
    """
    user_roles = await get_user_roles(db, user_id)

    # Check if any user role is in allowed roles
    has_role = any(role in allowed_roles for role in user_roles)

    if has_role:
        logger.info(f"User {user_id} has allowed role. User roles: {user_roles}, Allowed: {allowed_roles}")
    else:
        logger.warning(f"User {user_id} lacks required role. User roles: {user_roles}, Required: {allowed_roles}")

    return has_role


async def check_user_permission(
    db: AsyncSession,
    user_id: int,
    permission: Permission
) -> bool:
    """
    Check if user has a specific permission.

    Args:
        db: Database session
        user_id: User ID to check
        permission: Permission enum to verify

    Returns:
        True if user has the permission, False otherwise

    Example:
        ```python
        can_delete = await check_user_permission(db, user_id=5, permission=Permission.DELETE_EMPLOYEE)
        if not can_delete:
            raise HTTPException(status_code=403, detail="Cannot delete employees")
        ```
    """
    user_permissions = await get_user_permissions(db, user_id)

    has_permission = permission in user_permissions

    if has_permission:
        logger.info(f"User {user_id} has permission: {permission.value}")
    else:
        logger.warning(f"User {user_id} lacks permission: {permission.value}")

    return has_permission


def require_role(allowed_roles: List[str]):
    """
    FastAPI dependency factory to require specific roles.

    Creates a dependency function that checks if the current user
    has at least one of the allowed roles.

    Args:
        allowed_roles: List of role names that are allowed to access the endpoint

    Returns:
        FastAPI dependency function that returns the current user if authorized

    Raises:
        HTTPException 403: If user doesn't have an allowed role

    Usage:
        ```python
        @router.post("/employees")
        async def create_employee(
            employee_data: EmployeeCreate,
            current_user: User = Depends(require_role(['admin', 'manager']))
        ):
            # Only admins and managers can create employees
            return await employee_service.create(employee_data)
        ```
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session)
    ) -> User:
        """Check if current user has required role"""
        has_role = await check_user_role(db, current_user.id, allowed_roles)

        if not has_role:
            logger.warning(
                f"Access denied for user {current_user.id} ({current_user.email}). "
                f"Required roles: {allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(allowed_roles)}",
            )

        return current_user

    return role_checker


def require_permission(permission: Permission):
    """
    FastAPI dependency factory to require specific permission.

    Creates a dependency function that checks if the current user
    has the required permission based on their roles.

    Args:
        permission: Permission enum required to access the endpoint

    Returns:
        FastAPI dependency function that returns the current user if authorized

    Raises:
        HTTPException 403: If user doesn't have the required permission

    Usage:
        ```python
        @router.delete("/employees/{employee_id}")
        async def delete_employee(
            employee_id: int,
            current_user: User = Depends(require_permission(Permission.DELETE_EMPLOYEE))
        ):
            # Only users with delete:employee permission can delete
            return await employee_service.delete(employee_id)
        ```
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session)
    ) -> User:
        """Check if current user has required permission"""
        has_permission = await check_user_permission(db, current_user.id, permission)

        if not has_permission:
            logger.warning(
                f"Permission denied for user {current_user.id} ({current_user.email}). "
                f"Required permission: {permission.value}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: {permission.value}",
            )

        return current_user

    return permission_checker


def require_any_permission(permissions: List[Permission]):
    """
    FastAPI dependency factory to require ANY of the specified permissions.

    User needs at least one of the permissions in the list.

    Args:
        permissions: List of Permission enums (user needs at least one)

    Returns:
        FastAPI dependency function that returns the current user if authorized

    Raises:
        HTTPException 403: If user doesn't have any of the required permissions

    Usage:
        ```python
        @router.get("/employees/{employee_id}")
        async def get_employee(
            employee_id: int,
            current_user: User = Depends(require_any_permission([
                Permission.READ_EMPLOYEE,
                Permission.MANAGE_USERS
            ]))
        ):
            # User needs either read:employee OR manage:users
            return await employee_service.get(employee_id)
        ```
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session)
    ) -> User:
        """Check if current user has any of the required permissions"""
        user_permissions = await get_user_permissions(db, current_user.id)

        has_any = any(perm in user_permissions for perm in permissions)

        if not has_any:
            perm_names = [p.value for p in permissions]
            logger.warning(
                f"Permission denied for user {current_user.id} ({current_user.email}). "
                f"Required any of: {perm_names}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required any of: {', '.join(perm_names)}",
            )

        return current_user

    return permission_checker


def require_all_permissions(permissions: List[Permission]):
    """
    FastAPI dependency factory to require ALL of the specified permissions.

    User must have every permission in the list.

    Args:
        permissions: List of Permission enums (user needs all of them)

    Returns:
        FastAPI dependency function that returns the current user if authorized

    Raises:
        HTTPException 403: If user doesn't have all required permissions

    Usage:
        ```python
        @router.post("/system/reset")
        async def reset_system(
            current_user: User = Depends(require_all_permissions([
                Permission.MANAGE_SYSTEM,
                Permission.DELETE_EMPLOYEE,
                Permission.DELETE_DEPARTMENT
            ]))
        ):
            # User needs ALL three permissions
            return await system_service.reset()
        ```
    """
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session)
    ) -> User:
        """Check if current user has all required permissions"""
        user_permissions = await get_user_permissions(db, current_user.id)

        missing_permissions = [p for p in permissions if p not in user_permissions]

        if missing_permissions:
            missing_names = [p.value for p in missing_permissions]
            logger.warning(
                f"Permission denied for user {current_user.id} ({current_user.email}). "
                f"Missing permissions: {missing_names}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Missing permissions: {', '.join(missing_names)}",
            )

        return current_user

    return permission_checker


# Export all public APIs
__all__ = [
    "Permission",
    "ROLE_PERMISSIONS",
    "get_user_roles",
    "get_user_permissions",
    "check_user_role",
    "check_user_permission",
    "require_role",
    "require_permission",
    "require_any_permission",
    "require_all_permissions",
    "get_current_user",
]
