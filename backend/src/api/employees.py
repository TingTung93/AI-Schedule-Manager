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
        # Build query - User model doesn't have department relationship yet
        query = select(User)

        # Apply filters
        if is_active is not None:
            query = query.where(User.is_active == is_active)

        # Note: role and department_id filters removed as User model doesn't have these fields yet
        # These would need to be added via user_roles table join

        # Apply pagination - order by last_name, first_name
        query = query.offset(skip).limit(limit).order_by(User.last_name, User.first_name)

        # Execute query
        print(f"[DEBUG] Executing employees query with skip={skip}, limit={limit}")
        result = await db.execute(query)
        users = result.scalars().all()
        print(f"[DEBUG] Found {len(users)} users")

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
    """Create a new employee - only first_name and last_name required."""
    try:
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
                detail=f"Employee with email {email} already exists"
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
            is_active=True
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        return new_user

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error creating employee: {e}")
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

        # Map fields to User model
        field_mapping = {
            'first_name': 'first_name',
            'last_name': 'last_name',
            'email': 'email',
            'active': 'is_active'
        }

        for schema_field, model_field in field_mapping.items():
            if schema_field in update_data:
                setattr(user, model_field, update_data[schema_field])

        await db.commit()
        await db.refresh(user)

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
