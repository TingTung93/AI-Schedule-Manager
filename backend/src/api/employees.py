"""
Employee management API routes with comprehensive audit logging

This module implements REST API endpoints for employee management
with automatic audit trail logging for department assignment changes.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from ..dependencies import get_current_user, get_database_session
from ..auth.models import User
from ..models.department_history import DepartmentAssignmentHistory
from ..schemas import (
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    DepartmentHistoryResponse,
    DepartmentHistoryListResponse,
    DepartmentChangeSummary
)

router = APIRouter(prefix="/api/employees", tags=["employees"])


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
        # Build query
        # Note: User.department relationship not available due to different Base classes
        # Department data can be joined manually if needed via department_id
        query = select(User)

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

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Returns:
        Employee record with department information

    Raises:
        404: Employee not found
        500: Server error
    """
    try:
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


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Create a new employee - only first_name and last_name required.

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

        # Generate email if not provided
        import uuid
        if not employee_data.email:
            # Generate email from first_name and last_name
            email_base = f"{employee_data.first_name.lower()}.{employee_data.last_name.lower()}"
            # Add random suffix to ensure uniqueness
            email = f"{email_base}.{uuid.uuid4().hex[:8]}@temp.example.com"
        else:
            email = employee_data.email

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

        # Create new user
        new_user = User(
            email=email,
            password_hash=password_hash,
            first_name=employee_data.first_name,
            last_name=employee_data.last_name,
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

        # Load department relationship for response
        if new_user.department_id:
            dept_result = await db.execute(
                select(Department).where(Department.id == new_user.department_id)
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


@router.patch("/{employee_id}", response_model=EmployeeResponse)
@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Update an existing employee. Supports both PUT and PATCH methods.

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

        # Update fields that exist in User model
        update_data = employee_data.model_dump(exclude_unset=True)

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

        await db.commit()
        await db.refresh(user)

        # Load department relationship for response
        if user.department_id:
            dept_result = await db.execute(
                select(Department).where(Department.id == user.department_id)
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


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Delete an employee.

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
