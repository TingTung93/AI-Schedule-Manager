"""
Employee management API routes
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..dependencies import get_current_user, get_database_session
from ..models import User
from ..schemas import EmployeeCreate, EmployeeResponse, EmployeeUpdate

router = APIRouter(prefix="/api/employees", tags=["employees"])


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

    - **role**: Filter by employee role
    - **is_active**: Filter by active status
    - **department_id**: Filter by department
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    try:
        # Import Department model for manual loading
        from ..models.department import Department

        # Build query
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

        # Execute query
        print(f"[DEBUG] Executing employees query with skip={skip}, limit={limit}")
        result = await db.execute(query)
        users = result.scalars().all()
        print(f"[DEBUG] Found {len(users)} users")

        # Manually load department data for each user
        for user in users:
            if user.department_id:
                dept_result = await db.execute(select(Department).where(Department.id == user.department_id))
                user.department = dept_result.scalar_one_or_none()
            else:
                user.department = None

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
    """Get a specific employee by ID."""
    try:
        # Import Department model for manual loading
        from ..models.department import Department

        # Load employee
        query = select(User).where(User.id == employee_id)

        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        # Manually load department data
        if user.department_id:
            dept_result = await db.execute(select(Department).where(Department.id == user.department_id))
            user.department = dept_result.scalar_one_or_none()
        else:
            user.department = None

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
    """Create a new employee - only first_name and last_name required."""
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
            # Provide helpful error message with suggestions
            error_detail = {
                "detail": f"Employee with email {email} already exists",
                "suggestions": [
                    "Use a different email address",
                    "Leave the email field empty to auto-generate a unique email",
                    f"Existing employee: {existing_user.first_name} {existing_user.last_name} (ID: {existing_user.id})"
                ]
            }
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
    """Update an existing employee. Supports both PUT and PATCH methods."""
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

        # Validate department_id if being updated
        if 'department_id' in update_data and update_data['department_id'] is not None:
            dept_result = await db.execute(
                select(Department).where(Department.id == update_data['department_id'])
            )
            department = dept_result.scalar_one_or_none()

            if not department:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Department with ID {update_data['department_id']} not found. Please select a valid department or set to null for unassigned."
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
    """Delete an employee."""
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


# Helper function for validating department
async def _validate_department(db: AsyncSession, department_id: Optional[int]) -> Optional[object]:
    """Validate department exists and is active. Returns department or None."""
    if department_id is None:
        return None

    from ..models.department import Department

    dept_result = await db.execute(
        select(Department).where(Department.id == department_id)
    )
    department = dept_result.scalar_one_or_none()

    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {department_id} not found"
        )

    if not department.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign employees to inactive department '{department.name}'"
        )

    return department


@router.post("/bulk-assign-department")
async def bulk_assign_department(
    employee_ids: List[int],
    department_id: Optional[int] = None,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Bulk assign employees to a department (or unassign if department_id is None).

    - **employee_ids**: List of employee IDs to assign
    - **department_id**: Department ID to assign to, or null to unassign

    Returns statistics about the operation including success/failure counts.
    """
    try:
        from ..models.department import Department

        # Validate inputs
        if not employee_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="employee_ids list cannot be empty"
            )

        # Validate department if provided
        department = await _validate_department(db, department_id)

        # Track statistics
        success_count = 0
        failed_count = 0
        errors = []
        updated_employees = []

        # Process each employee in transaction
        for emp_id in employee_ids:
            try:
                # Find employee
                result = await db.execute(select(User).where(User.id == emp_id))
                user = result.scalar_one_or_none()

                if not user:
                    failed_count += 1
                    errors.append({
                        "employee_id": emp_id,
                        "error": f"Employee with ID {emp_id} not found"
                    })
                    continue

                # Update department assignment
                user.department_id = department_id
                success_count += 1
                updated_employees.append({
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "department_id": user.department_id
                })

            except Exception as e:
                failed_count += 1
                errors.append({
                    "employee_id": emp_id,
                    "error": str(e)
                })

        # Commit all changes atomically
        if success_count > 0:
            await db.commit()

        # Prepare response
        response = {
            "message": f"Bulk assignment completed",
            "department_id": department_id,
            "department_name": department.name if department else None,
            "total_requested": len(employee_ids),
            "success_count": success_count,
            "failed_count": failed_count,
            "updated_employees": updated_employees,
            "errors": errors if errors else None
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in bulk_assign_department: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk assign department: {str(e)}"
        )


@router.post("/transfer-department")
async def transfer_department(
    from_department_id: int,
    to_department_id: int,
    employee_ids: Optional[List[int]] = None,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Transfer employees between departments.

    - **from_department_id**: Source department ID
    - **to_department_id**: Destination department ID
    - **employee_ids**: Optional list of specific employee IDs. If None, transfer all employees.

    Returns statistics about the transfer operation.
    """
    try:
        from ..models.department import Department

        # Prevent self-transfer
        if from_department_id == to_department_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transfer employees to the same department (from_department_id and to_department_id are identical)"
            )

        # Validate source department exists
        from_dept_result = await db.execute(
            select(Department).where(Department.id == from_department_id)
        )
        from_department = from_dept_result.scalar_one_or_none()

        if not from_department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source department with ID {from_department_id} not found"
            )

        # Validate destination department
        to_department = await _validate_department(db, to_department_id)

        # Build query for employees to transfer
        if employee_ids:
            # Transfer specific employees
            query = select(User).where(
                User.id.in_(employee_ids),
                User.department_id == from_department_id
            )
        else:
            # Transfer all employees from source department
            query = select(User).where(User.department_id == from_department_id)

        result = await db.execute(query)
        employees_to_transfer = result.scalars().all()

        # Validate all requested employees exist and belong to source department
        if employee_ids:
            found_ids = {emp.id for emp in employees_to_transfer}
            requested_ids = set(employee_ids)
            missing_ids = requested_ids - found_ids

            if missing_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Employees with IDs {list(missing_ids)} not found in department {from_department_id}"
                )

        # Check if any employees found
        if not employees_to_transfer:
            return {
                "message": "No employees to transfer",
                "from_department_id": from_department_id,
                "from_department_name": from_department.name,
                "to_department_id": to_department_id,
                "to_department_name": to_department.name,
                "transferred_count": 0,
                "transferred_employees": []
            }

        # Transfer employees
        transferred_employees = []
        for employee in employees_to_transfer:
            employee.department_id = to_department_id
            transferred_employees.append({
                "id": employee.id,
                "email": employee.email,
                "first_name": employee.first_name,
                "last_name": employee.last_name
            })

        # Commit transaction
        await db.commit()

        return {
            "message": f"Successfully transferred {len(transferred_employees)} employees",
            "from_department_id": from_department_id,
            "from_department_name": from_department.name,
            "to_department_id": to_department_id,
            "to_department_name": to_department.name,
            "transferred_count": len(transferred_employees),
            "transferred_employees": transferred_employees
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in transfer_department: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transfer employees: {str(e)}"
        )


@router.get("/unassigned")
async def get_unassigned_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get all employees without department assignment.

    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return

    Returns list of employees with no department assigned.
    """
    try:
        from ..models.department import Department

        # Query for employees without department
        query = select(User).where(User.department_id.is_(None))
        query = query.offset(skip).limit(limit).order_by(User.last_name, User.first_name)

        result = await db.execute(query)
        unassigned_employees = result.scalars().all()

        # Get total count for pagination info
        count_query = select(User).where(User.department_id.is_(None))
        count_result = await db.execute(count_query)
        total_count = len(count_result.scalars().all())

        # Format response
        employees_list = []
        for user in unassigned_employees:
            employees_list.append({
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "department_id": None,
                "department": None
            })

        return {
            "total_count": total_count,
            "returned_count": len(employees_list),
            "skip": skip,
            "limit": limit,
            "employees": employees_list
        }

    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching unassigned employees: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch unassigned employees: {str(e)}"
        )
