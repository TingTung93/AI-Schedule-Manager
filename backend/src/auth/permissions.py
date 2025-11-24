"""
Department-level authorization and RBAC for AI Schedule Manager.

This module implements fine-grained authorization controls to ensure
users can only access and modify departments they have permission for.

Security Controls:
- Role-Based Access Control (RBAC)
- Department-level resource access
- Action-specific permissions (read, create, update, delete, assign)

CRITICAL: This module fixes P0 authorization vulnerability identified in security audit.
"""

import logging
from functools import wraps
from typing import Callable, Optional, Set

from flask import g, jsonify
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)


class AuthorizationError(Exception):
    """Raised when user lacks permission for an operation"""
    pass


class DepartmentPermissions:
    """
    Department permission checker with role-based access control.

    Permission Model:
    - Admins: Full access to all departments
    - Managers: Access to their department + subdepartments
    - Employees: Read-only access to their department
    """

    @staticmethod
    async def can_access_department(
        db: AsyncSession,
        user_id: int,
        department_id: Optional[int],
        action: str
    ) -> bool:
        """
        Check if user has permission to perform action on department.

        Args:
            db: Database session
            user_id: User ID requesting access
            department_id: Department ID to check (None for unassigned)
            action: Action to perform (read, create, update, delete, assign)

        Returns:
            True if user has permission, False otherwise

        Raises:
            AuthorizationError: If permission is denied
        """
        from ..auth.models import User
        from ..models import Department

        # Get user with role information
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"Authorization check failed: User {user_id} not found")
            return False

        # Extract role (simplified - assumes single role)
        user_role = user.roles[0].name if user.roles else 'employee'

        # ADMIN ROLE: Full access to everything
        if user_role == 'admin':
            logger.info(f"Admin user {user_id} granted {action} access to department {department_id}")
            return True

        # Null department (unassigned) - allow read for all, create/assign for managers
        if department_id is None:
            if action == 'read':
                return True
            if action in ['create', 'assign'] and user_role == 'manager':
                return True
            logger.warning(f"User {user_id} denied {action} on unassigned department (role: {user_role})")
            return False

        # Get department information
        dept_result = await db.execute(
            select(Department).where(Department.id == department_id)
        )
        department = dept_result.scalar_one_or_none()

        if not department:
            logger.warning(f"Authorization check failed: Department {department_id} not found")
            return False

        # MANAGER ROLE: Can manage their department and subdepartments
        if user_role == 'manager':
            # Check if this is user's department
            if user.department_id == department_id:
                logger.info(f"Manager {user_id} granted {action} on own department {department_id}")
                return True

            # Check if this is a subdepartment
            if await DepartmentPermissions._is_subdepartment(db, user.department_id, department_id):
                logger.info(f"Manager {user_id} granted {action} on subdepartment {department_id}")
                return True

            logger.warning(f"Manager {user_id} denied {action} on department {department_id} (not in hierarchy)")
            return False

        # EMPLOYEE ROLE: Read-only access to their department
        if user_role == 'employee':
            if action == 'read' and user.department_id == department_id:
                logger.info(f"Employee {user_id} granted read access to own department {department_id}")
                return True

            logger.warning(f"Employee {user_id} denied {action} on department {department_id}")
            return False

        # DEFAULT: Deny access
        logger.warning(f"User {user_id} (role: {user_role}) denied {action} on department {department_id}")
        return False

    @staticmethod
    async def _is_subdepartment(db: AsyncSession, parent_id: Optional[int], child_id: int) -> bool:
        """
        Check if child_id is a subdepartment of parent_id.

        Args:
            db: Database session
            parent_id: Potential parent department ID
            child_id: Child department ID to check

        Returns:
            True if child is under parent in hierarchy
        """
        if parent_id is None:
            return False

        from ..models import Department

        # Traverse up from child to find parent
        current_id = child_id
        max_depth = 10  # Prevent infinite loops

        for _ in range(max_depth):
            result = await db.execute(
                select(Department.parent_id).where(Department.id == current_id)
            )
            parent = result.scalar_one_or_none()

            if parent is None:
                return False  # Reached root without finding parent_id

            if parent == parent_id:
                return True  # Found parent in hierarchy

            current_id = parent

        return False

    @staticmethod
    async def filter_accessible_departments(
        db: AsyncSession,
        user_id: int,
        department_ids: list
    ) -> list:
        """
        Filter department list to only those user can access.

        Args:
            db: Database session
            user_id: User ID requesting access
            department_ids: List of department IDs to filter

        Returns:
            Filtered list of accessible department IDs
        """
        accessible = []

        for dept_id in department_ids:
            if await DepartmentPermissions.can_access_department(db, user_id, dept_id, 'read'):
                accessible.append(dept_id)

        return accessible


def require_department_access(action: str):
    """
    Decorator to enforce department-level authorization.

    Usage:
        @require_department_access('update')
        async def update_department(department_id: int):
            # Only executes if user has update permission

    Args:
        action: Action being performed (read, create, update, delete, assign)

    Returns:
        Decorator function

    Raises:
        HTTPException 403: If user lacks permission
    """
    def decorator(f: Callable):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            # Extract department_id from kwargs or request
            department_id = kwargs.get('department_id') or kwargs.get('dept_id')

            # Get department_id from request body for POST/PUT
            if department_id is None and hasattr(g, 'request_json'):
                department_id = g.request_json.get('department_id')

            # Get current user ID (set by @token_required middleware)
            user_id = getattr(g, 'user_id', None)
            if user_id is None:
                logger.error("Department authorization check failed: No user_id in request context")
                return jsonify({"error": "Authentication required"}), 401

            # Get database session from kwargs
            db = kwargs.get('db')
            if db is None:
                logger.error("Department authorization check failed: No database session")
                return jsonify({"error": "Internal server error"}), 500

            # Check permission
            try:
                has_permission = await DepartmentPermissions.can_access_department(
                    db=db,
                    user_id=user_id,
                    department_id=department_id,
                    action=action
                )

                if not has_permission:
                    logger.warning(
                        f"Authorization denied: User {user_id} cannot {action} department {department_id}"
                    )
                    return jsonify({
                        "error": "Access denied",
                        "message": f"You do not have permission to {action} this department"
                    }), 403

                # Permission granted - execute function
                return await f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Authorization check error: {e}", exc_info=True)
                return jsonify({
                    "error": "Authorization check failed",
                    "message": str(e)
                }), 500

        return decorated_function
    return decorator


def require_manager_role():
    """
    Decorator to require manager or admin role.

    Usage:
        @require_manager_role()
        async def create_department():
            # Only managers and admins can execute
    """
    def decorator(f: Callable):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            user_role = getattr(g, 'user_role', None)

            if user_role not in ['manager', 'admin']:
                logger.warning(f"Manager role required but user has role: {user_role}")
                return jsonify({
                    "error": "Insufficient permissions",
                    "message": "This action requires manager or admin role"
                }), 403

            return await f(*args, **kwargs)

        return decorated_function
    return decorator
