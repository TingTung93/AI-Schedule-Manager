"""
Employee management API routes with comprehensive audit logging

This module implements REST API endpoints for employee management
with automatic audit trail logging for department assignment changes.
"""

import html
import secrets
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from pydantic import ValidationError
import bcrypt

from ..dependencies import get_current_user, get_database_session, require_roles, require_permissions
from ..auth.models import User, Role, user_roles
from ..models.department_history import DepartmentAssignmentHistory
from ..models.role_history import RoleChangeHistory
from ..models.password_history import PasswordHistory
from ..schemas import (
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    DepartmentHistoryResponse,
    DepartmentHistoryListResponse,
    DepartmentChangeSummary,
    RoleHistoryResponse,
    RoleHistoryListResponse,
    ResetPasswordRequest,
    PasswordResponse,
    ChangePasswordRequest,
    ChangePasswordResponse
)

router = APIRouter(prefix="/api/employees", tags=["employees"])

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)


def generate_secure_password(length: int = 12) -> str:
    """
    Generate a cryptographically secure random password.

    Creates a password that meets complexity requirements:
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character

    Args:
        length: Password length (minimum 12)

    Returns:
        Secure random password string
    """
    if length < 12:
        length = 12

    # Define character sets
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()_+-=[]{}|;:,.<>?"

    # Ensure at least one character from each set
    password_chars = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special)
    ]

    # Fill remaining length with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    password_chars.extend(secrets.choice(all_chars) for _ in range(length - 4))

    # Shuffle to avoid predictable patterns
    shuffled = password_chars.copy()
    for i in range(len(shuffled) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]

    return ''.join(shuffled)


async def check_password_history(
    db: AsyncSession,
    user_id: int,
    new_password: str,
    history_limit: int = 5
) -> bool:
    """
    Check if password was used in recent history.

    Args:
        db: Database session
        user_id: User ID to check
        new_password: New password to validate
        history_limit: Number of previous passwords to check

    Returns:
        True if password is reused, False if password is unique
    """
    # Get recent password history
    history_query = (
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user_id)
        .order_by(desc(PasswordHistory.changed_at))
        .limit(history_limit)
    )

    result = await db.execute(history_query)
    history_records = result.scalars().all()

    # Check if new password matches any in history
    new_password_bytes = new_password.encode('utf-8')
    for record in history_records:
        if bcrypt.checkpw(new_password_bytes, record.password_hash.encode('utf-8')):
            return True  # Password is reused

    return False  # Password is unique


async def save_password_to_history(
    db: AsyncSession,
    user_id: int,
    password_hash: str,
    change_method: str = 'self_change',
    changed_by_user_id: Optional[int] = None,
    ip_address: Optional[str] = None
) -> PasswordHistory:
    """
    Save password to history for tracking.

    Args:
        db: Database session
        user_id: User ID
        password_hash: Hashed password
        change_method: How password was changed ('reset', 'self_change', 'admin_change')
        changed_by_user_id: ID of user who initiated change
        ip_address: IP address of change request

    Returns:
        Created password history record
    """
    history_record = PasswordHistory(
        user_id=user_id,
        password_hash=password_hash,
        changed_at=datetime.now(timezone.utc),
        change_method=change_method,
        changed_by_user_id=changed_by_user_id,
        ip_address=ip_address
    )

    db.add(history_record)
    await db.flush()

    return history_record


def sanitize_text(text: Optional[str]) -> Optional[str]:
    """
    Sanitize text input to prevent XSS attacks.

    Escapes HTML special characters and trims whitespace.

    Args:
        text: Input text to sanitize

    Returns:
        Sanitized text or None if input was None
    """
    if text:
        return html.escape(text.strip())
    return text


def format_validation_errors(validation_error: ValidationError) -> dict:
    """
    Format Pydantic validation errors into field-specific error messages.

    Args:
        validation_error: Pydantic ValidationError instance

    Returns:
        Dictionary with formatted error details
    """
    errors = []
    for error in validation_error.errors():
        # Extract field name from location tuple
        field_path = '.'.join(str(x) for x in error['loc'] if x != 'body')

        # Get user-friendly error message
        error_msg = error.get('msg', 'Validation error')

        # Handle specific error types with custom messages
        error_type = error.get('type', '')

        if error_type == 'extra_forbidden':
            field_name = error['loc'][-1] if error['loc'] else 'unknown'
            error_msg = f"Unknown field '{field_name}' is not allowed. Please remove this field from your request."
        elif error_type == 'string_too_short':
            ctx = error.get('ctx', {})
            min_length = ctx.get('min_length', 'required')
            error_msg = f"Field must be at least {min_length} characters long."
        elif error_type == 'string_too_long':
            ctx = error.get('ctx', {})
            max_length = ctx.get('max_length', 'allowed')
            error_msg = f"Field must be no more than {max_length} characters long."
        elif error_type == 'value_error':
            # Use the custom validation message from our validators
            error_msg = str(error.get('ctx', {}).get('error', error_msg))

        errors.append({
            'field': field_path,
            'message': error_msg,
            'type': error_type
        })

    return {'errors': errors}


async def log_department_change(
    db: AsyncSession,
    employee_id: int,
    from_dept: Optional[int],
    to_dept: Optional[int],
    changed_by: int,
    reason: Optional[str] = None,
    metadata: Optional[dict] = None
) -> DepartmentAssignmentHistory:
    """
    Log department assignment change to audit trail.

    This helper function creates a comprehensive audit record for department changes,
    following best practices for audit logging with complete context capture.

    Args:
        db: Database session
        employee_id: ID of employee whose department is changing
        from_dept: Previous department ID (None if unassigned)
        to_dept: New department ID (None if being unassigned)
        changed_by: ID of user making the change
        reason: Optional explanation for the change
        metadata: Optional additional context (JSON format)

    Returns:
        Created history record

    Raises:
        HTTPException: If database operation fails
    """
    try:
        history_record = DepartmentAssignmentHistory(
            employee_id=employee_id,
            from_department_id=from_dept,
            to_department_id=to_dept,
            changed_by_user_id=changed_by,
            changed_at=datetime.utcnow(),
            change_reason=reason,
            metadata=metadata or {}
        )

        db.add(history_record)
        await db.flush()  # Flush to get ID but don't commit yet

        return history_record
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging department change: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log department change: {str(e)}"
        )


async def update_user_role(
    db: AsyncSession,
    user_id: int,
    new_role: str,
    changed_by_id: int,
    reason: Optional[str] = None
) -> bool:
    """
    Update user role in user_roles table and create audit trail.

    This helper function manages the many-to-many relationship between users and roles,
    updates the role assignment, and creates a comprehensive audit record.

    Args:
        db: Database session
        user_id: ID of user whose role is changing
        new_role: Name of the new role to assign
        changed_by_id: ID of user making the change
        reason: Optional explanation for the change

    Returns:
        True if successful, False otherwise

    Raises:
        HTTPException: If role doesn't exist or database operation fails
    """
    try:
        # Load user with current roles
        user_query = select(User).where(User.id == user_id).options(selectinload(User.roles))
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )

        # Get current role (assuming users have one role for simplicity)
        old_role = user.roles[0].name if user.roles else None

        # Check if role is actually changing
        if old_role == new_role:
            return True  # No change needed

        # Find the new role
        role_query = select(Role).where(Role.name == new_role)
        role_result = await db.execute(role_query)
        new_role_obj = role_result.scalar_one_or_none()

        if not new_role_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role '{new_role}' not found. Available roles: admin, manager, user, guest"
            )

        # Remove all existing roles (one role per user approach)
        if user.roles:
            user.roles.clear()

        # Assign new role
        user.roles.append(new_role_obj)

        # Create audit trail record
        history_record = RoleChangeHistory(
            user_id=user_id,
            old_role=old_role,
            new_role=new_role,
            changed_by_id=changed_by_id,
            changed_at=datetime.utcnow(),
            reason=reason or "Role updated via API",
            metadata_json={"action": "role_change", "api_endpoint": "/api/employees"}
        )

        db.add(history_record)
        await db.flush()

        return True

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating user role: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update role: {str(e)}"
        )


@router.get("", response_model=List[EmployeeResponse])
async def get_employees(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    department_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get all employees with optional filtering.

    Authorization:
    - Admins and Managers: Can view all employees
    - Regular users (employee role): Can only view their own profile

    Query Parameters:
    - **role**: Filter by employee role
    - **is_active**: Filter by active status
    - **department_id**: Filter by department
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return (max 1000)

    Returns:
        List of employee records with department information
    """
    try:
        # Get current user's roles
        user_roles_list = [role.name for role in current_user.roles]
        is_admin_or_manager = any(role in ["admin", "manager"] for role in user_roles_list)

        # Build query
        # Note: User.department relationship not available due to different Base classes
        # Department data can be joined manually if needed via department_id
        query = select(User)

        # RBAC: Regular employees can only see their own profile
        if not is_admin_or_manager:
            query = query.where(User.id == current_user.id)

        # Apply filters
        if is_active is not None:
            query = query.where(User.is_active == is_active)

        # Filter by department
        if department_id is not None:
            query = query.where(User.department_id == department_id)

        # Note: role filter would need to be added via user_roles table join

        # Apply pagination - order by last_name, first_name
        query = query.offset(skip).limit(limit).order_by(User.last_name, User.first_name)

        # Execute query - department data is already loaded via selectinload
        print(f"[DEBUG] Executing employees query with skip={skip}, limit={limit}")
        result = await db.execute(query)
        users = result.scalars().all()
        print(f"[DEBUG] Found {len(users)} users with eager-loaded departments")

        return users

    except Exception as e:
        print(f"[ERROR] Error fetching employees: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch employees: {str(e)}"
        )


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get a specific employee by ID.

    Authorization:
    - Admins and Managers: Can view any employee
    - Regular users: Can only view their own profile

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Returns:
        Employee record with department information

    Raises:
        403: Access denied (trying to view another user's profile)
        404: Employee not found
        500: Server error
    """
    try:
        # Get current user's roles
        user_roles_list = [role.name for role in current_user.roles]
        is_admin_or_manager = any(role in ["admin", "manager"] for role in user_roles_list)

        # RBAC: Regular employees can only view their own profile
        if not is_admin_or_manager and employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only view your own profile."
            )

        # Load employee
        # Note: User.department relationship not available due to different Base classes
        query = select(User).where(User.id == employee_id)

        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        return user

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch employee: {str(e)}"
        )


@router.post(
    "",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "manager"))]
)
@limiter.limit("10/minute")
async def create_employee(
    request: Request,
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Create a new employee - only first_name and last_name required.

    Authorization:
    - Required roles: admin or manager

    Request Body:
    - **first_name**: Employee first name (required)
    - **last_name**: Employee last name (required)
    - **email**: Email address (optional, auto-generated if not provided)
    - **department_id**: Department assignment (optional)

    Returns:
        Created employee record

    Raises:
        404: Department not found
        409: Email already exists
        400: Invalid department (inactive)
        500: Server error
    """
    try:
        # Import Department model for validation
        from ..models.department import Department

        # Validate department_id if provided
        if employee_data.department_id is not None:
            dept_result = await db.execute(
                select(Department).where(Department.id == employee_data.department_id)
            )
            department = dept_result.scalar_one_or_none()

            if not department:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Department with ID {employee_data.department_id} not found. Please select a valid department or leave unassigned."
                )

            # Check if department is active
            if not department.active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign employee to inactive department '{department.name}'. Please select an active department."
                )

        # Sanitize input fields to prevent XSS
        first_name = sanitize_text(employee_data.first_name)
        last_name = sanitize_text(employee_data.last_name)

        # Generate email if not provided
        import uuid
        if not employee_data.email:
            # Generate email from first_name and last_name
            email_base = f"{first_name.lower()}.{last_name.lower()}"
            # Add random suffix to ensure uniqueness
            email = f"{email_base}.{uuid.uuid4().hex[:8]}@temp.example.com"
        else:
            email = sanitize_text(employee_data.email)

        # Check if email already exists
        result = await db.execute(select(User).where(User.email == email))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee with email {email} already exists. Suggestions: Use a different email or leave it empty to auto-generate."
            )

        # Hash password - use default password
        import bcrypt
        default_password = "Employee123!"
        password_bytes = default_password.encode('utf-8')
        password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        # Create new user (using sanitized fields)
        new_user = User(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            department_id=employee_data.department_id,
            is_active=True
        )

        db.add(new_user)
        await db.flush()  # Get user ID before logging

        # Log department assignment if assigned on creation
        if employee_data.department_id is not None:
            await log_department_change(
                db=db,
                employee_id=new_user.id,
                from_dept=None,
                to_dept=employee_data.department_id,
                changed_by=current_user.id,
                reason="Initial department assignment on employee creation",
                metadata={"action": "create", "initial_assignment": True}
            )

        await db.commit()
        await db.refresh(new_user)

        # Load department relationship for response with children eagerly loaded
        if new_user.department_id:
            from sqlalchemy.orm import selectinload
            dept_result = await db.execute(
                select(Department)
                .where(Department.id == new_user.department_id)
                .options(selectinload(Department.children))
            )
            new_user.department = dept_result.scalar_one_or_none()
        else:
            new_user.department = None

        return new_user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating employee: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create employee: {str(e)}"
        )


@router.patch(
    "/{employee_id}",
    response_model=EmployeeResponse,
    dependencies=[Depends(require_roles("admin", "manager"))]
)
@router.put(
    "/{employee_id}",
    response_model=EmployeeResponse,
    dependencies=[Depends(require_roles("admin", "manager"))]
)
@limiter.limit("10/minute")
async def update_employee(
    request: Request,
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Update an existing employee. Supports both PUT and PATCH methods.

    Authorization:
    - Required roles: admin or manager
    - Non-admin/manager users can only update their own profile
    - Only administrators can change user roles

    Automatically logs department assignment changes to audit trail.

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Request Body:
    - All fields optional for PATCH
    - Validates department existence and status
    - Logs department changes automatically

    Returns:
        Updated employee record

    Raises:
        404: Employee or department not found
        409: Email already exists
        400: Invalid department (inactive)
        500: Server error
    """
    try:
        # Import Department model for validation
        from ..models.department import Department

        # Find user
        result = await db.execute(select(User).where(User.id == employee_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )


        # RBAC: Resource-based authorization checks
        user_roles_list = [role.name for role in current_user.roles]
        is_admin = "admin" in user_roles_list
        is_manager = "manager" in user_roles_list
        
        # Non-admins/managers can only update their own profile
        if not (is_admin or is_manager) and employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only update your own profile."
            )

        # Check for role change - only admins can change roles
        if 'role' in employee_data.model_dump(exclude_unset=True):
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. Only administrators can change user roles."
                )

        # Update fields that exist in User model
        update_data = employee_data.model_dump(exclude_unset=True)

        # Sanitize text fields to prevent XSS
        if 'first_name' in update_data:
            update_data['first_name'] = sanitize_text(update_data['first_name'])
        if 'last_name' in update_data:
            update_data['last_name'] = sanitize_text(update_data['last_name'])
        if 'email' in update_data:
            update_data['email'] = sanitize_text(update_data['email'])

        # Track old department for audit logging
        old_department_id = user.department_id

        # Validate department_id if being updated
        if 'department_id' in update_data:
            new_department_id = update_data['department_id']

            if new_department_id is not None:
                dept_result = await db.execute(
                    select(Department).where(Department.id == new_department_id)
                )
                department = dept_result.scalar_one_or_none()

                if not department:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Department with ID {new_department_id} not found. Please select a valid department or set to null for unassigned."
                    )

                # Check if department is active
                if not department.active:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot assign employee to inactive department '{department.name}'. Please select an active department."
                    )

        # Check if email is being updated and ensure it's unique
        if 'email' in update_data and update_data['email'] != user.email:
            email_check = await db.execute(
                select(User).where(User.email == update_data['email'])
            )
            existing_user = email_check.scalar_one_or_none()

            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Employee with email {update_data['email']} already exists. Please use a different email address."
                )

        # Map fields to User model
        field_mapping = {
            'first_name': 'first_name',
            'last_name': 'last_name',
            'email': 'email',
            'active': 'is_active',
            'department_id': 'department_id'
        }

        for schema_field, model_field in field_mapping.items():
            if schema_field in update_data:
                setattr(user, model_field, update_data[schema_field])

        # Log department change if department was updated
        if 'department_id' in update_data:
            new_department_id = update_data['department_id']

            # Only log if department actually changed
            if old_department_id != new_department_id:
                await log_department_change(
                    db=db,
                    employee_id=employee_id,
                    from_dept=old_department_id,
                    to_dept=new_department_id,
                    changed_by=current_user.id,
                    reason=f"Department assignment updated via employee update API",
                    metadata={
                        "action": "update",
                        "updated_fields": list(update_data.keys())
                    }
                )

        # Handle role change if role was updated
        if 'role' in update_data and update_data['role']:
            role_name = update_data['role']
            # Convert EmployeeRole enum to string if needed
            if hasattr(role_name, 'value'):
                role_name = role_name.value

            success = await update_user_role(
                db=db,
                user_id=employee_id,
                new_role=role_name,
                changed_by_id=current_user.id,
                reason="Role updated via employee update API"
            )

            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update user role"
                )

        await db.commit()
        await db.refresh(user)

        # Load department relationship for response with children eagerly loaded
        if user.department_id:
            from sqlalchemy.orm import selectinload
            dept_result = await db.execute(
                select(Department)
                .where(Department.id == user.department_id)
                .options(selectinload(Department.children))
            )
            user.department = dept_result.scalar_one_or_none()
        else:
            user.department = None

        return user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error updating employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update employee: {str(e)}"
        )


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))]
)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Delete an employee.

    Authorization:
    - Required role: admin only

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Returns:
        No content (204)

    Raises:
        404: Employee not found
        500: Server error

    Note:
        Audit trail records are preserved due to CASCADE on employee_id
    """
    try:
        result = await db.execute(select(User).where(User.id == employee_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        await db.delete(user)
        await db.commit()

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error deleting employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete employee: {str(e)}"
        )


@router.get("/{employee_id}/department-history", response_model=DepartmentHistoryListResponse)
async def get_department_history(
    employee_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=500, description="Maximum records to return"),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get department assignment history for an employee.

    Returns comprehensive audit trail of all department changes with
    enriched data including employee and department names.

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Query Parameters:
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum records to return (max 500)

    Returns:
        Paginated list of department change records

    Raises:
        404: Employee not found
        500: Server error
    """
    try:
        # Import Department model for joins
        from ..models.department import Department

        # Verify employee exists
        employee_check = await db.execute(select(User).where(User.id == employee_id))
        employee = employee_check.scalar_one_or_none()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        # Get total count
        count_query = select(func.count()).select_from(DepartmentAssignmentHistory).where(
            DepartmentAssignmentHistory.employee_id == employee_id
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get history records with eager-loaded relationships (eliminates N+1 queries)
        history_query = (
            select(DepartmentAssignmentHistory)
            .where(DepartmentAssignmentHistory.employee_id == employee_id)
            .options(
                selectinload(DepartmentAssignmentHistory.from_department),
                selectinload(DepartmentAssignmentHistory.to_department),
                selectinload(DepartmentAssignmentHistory.changed_by_user)
            )
            .order_by(desc(DepartmentAssignmentHistory.changed_at))
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(history_query)
        history_records = result.scalars().all()

        # Build response with already-loaded relationships
        response_items = []
        for record in history_records:
            # All relationships already loaded via selectinload
            from_dept_name = record.from_department.name if record.from_department else None
            to_dept_name = record.to_department.name if record.to_department else None
            changed_by_name = f"{record.changed_by_user.first_name} {record.changed_by_user.last_name}" if record.changed_by_user else None

            # Create enriched response
            response_items.append(
                DepartmentHistoryResponse(
                    id=record.id,
                    employee_id=record.employee_id,
                    from_department_id=record.from_department_id,
                    to_department_id=record.to_department_id,
                    changed_by_user_id=record.changed_by_user_id,
                    changed_at=record.changed_at,
                    change_reason=record.change_reason,
                    metadata=record.metadata or {},
                    employee_name=f"{employee.first_name} {employee.last_name}",
                    from_department_name=from_dept_name,
                    to_department_name=to_dept_name,
                    changed_by_name=changed_by_name
                )
            )

        return DepartmentHistoryListResponse(
            total=total,
            items=response_items,
            skip=skip,
            limit=limit
        )

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching department history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch department history: {str(e)}"
        )


@router.get("/{employee_id}/role-history", response_model=RoleHistoryListResponse)
async def get_role_history(
    employee_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=500, description="Maximum records to return"),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get role change history for an employee.

    Returns comprehensive audit trail of all role changes with
    enriched data including user names and role details.

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Query Parameters:
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum records to return (max 500)

    Returns:
        Paginated list of role change records

    Raises:
        404: Employee not found
        500: Server error
    """
    try:
        # Verify employee exists
        employee_check = await db.execute(select(User).where(User.id == employee_id))
        employee = employee_check.scalar_one_or_none()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        # Get total count
        count_query = select(func.count()).select_from(RoleChangeHistory).where(
            RoleChangeHistory.user_id == employee_id
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get history records
        history_query = (
            select(RoleChangeHistory)
            .where(RoleChangeHistory.user_id == employee_id)
            .order_by(desc(RoleChangeHistory.changed_at))
            .offset(skip)
            .limit(limit)
        )

        result = await db.execute(history_query)
        history_records = result.scalars().all()

        # Build response with enriched data
        response_items = []
        for record in history_records:
            # Load changed_by user manually
            changed_by_query = select(User).where(User.id == record.changed_by_id)
            changed_by_result = await db.execute(changed_by_query)
            changed_by_user = changed_by_result.scalar_one_or_none()

            changed_by_name = f"{changed_by_user.first_name} {changed_by_user.last_name}" if changed_by_user else None

            # Create enriched response
            response_items.append(
                RoleHistoryResponse(
                    id=record.id,
                    user_id=record.user_id,
                    old_role=record.old_role,
                    new_role=record.new_role,
                    changed_by_id=record.changed_by_id,
                    changed_at=record.changed_at,
                    reason=record.reason,
                    metadata_json=record.metadata_json or {},
                    user_name=f"{employee.first_name} {employee.last_name}",
                    changed_by_name=changed_by_name
                )
            )

        return RoleHistoryListResponse(
            total=total,
            items=response_items,
            skip=skip,
            limit=limit
        )

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching role history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch role history: {str(e)}"
        )
