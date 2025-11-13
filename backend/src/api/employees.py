"""
Employee management API routes
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..dependencies import get_current_user, get_database_session
from ..models.employee import Employee
from ..schemas import EmployeeCreate, EmployeeResponse, EmployeeUpdate

router = APIRouter(prefix="/api/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeResponse])
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
        # Build query with eager loading
        query = select(Employee).options(
            selectinload(Employee.department)
        )

        # Apply filters
        if role:
            query = query.where(Employee.role == role)

        if is_active is not None:
            query = query.where(Employee.is_active == is_active)

        if department_id:
            query = query.where(Employee.department_id == department_id)

        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Employee.name)

        # Execute query
        result = await db.execute(query)
        employees = result.scalars().all()

        return employees

    except Exception as e:
        print(f"Error fetching employees: {e}")
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
        query = select(Employee).options(
            selectinload(Employee.department)
        ).where(Employee.id == employee_id)

        result = await db.execute(query)
        employee = result.scalar_one_or_none()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        return employee

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch employee: {str(e)}"
        )


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """Create a new employee."""
    try:
        # Check if email already exists
        result = await db.execute(select(Employee).where(Employee.email == employee_data.email))
        existing_employee = result.scalar_one_or_none()

        if existing_employee:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee with email {employee_data.email} already exists"
            )

        # Hash password
        from ..auth.auth import auth_service
        password_hash = auth_service.hash_password(employee_data.password)

        # Create new employee
        new_employee = Employee(
            email=employee_data.email,
            password_hash=password_hash,
            name=employee_data.name,
            role=employee_data.role,
            qualifications=employee_data.qualifications,
            availability=employee_data.availability,
            department_id=employee_data.department_id,
            is_active=True,
            is_admin=False
        )

        db.add(new_employee)
        await db.commit()
        await db.refresh(new_employee)

        # Reload with relationships
        query = select(Employee).options(
            selectinload(Employee.department)
        ).where(Employee.id == new_employee.id)

        result = await db.execute(query)
        employee = result.scalar_one()

        return employee

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error creating employee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create employee: {str(e)}"
        )


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """Update an existing employee."""
    try:
        # Find employee
        result = await db.execute(select(Employee).where(Employee.id == employee_id))
        employee = result.scalar_one_or_none()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        # Update fields
        update_data = employee_data.model_dump(exclude_unset=True)

        # Handle password separately if provided
        if 'password' in update_data:
            from ..auth.auth import auth_service
            update_data['password_hash'] = auth_service.hash_password(update_data.pop('password'))

        for field, value in update_data.items():
            if hasattr(employee, field):
                setattr(employee, field, value)

        await db.commit()
        await db.refresh(employee)

        # Reload with relationships
        query = select(Employee).options(
            selectinload(Employee.department)
        ).where(Employee.id == employee_id)

        result = await db.execute(query)
        employee = result.scalar_one()

        return employee

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
        result = await db.execute(select(Employee).where(Employee.id == employee_id))
        employee = result.scalar_one_or_none()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        await db.delete(employee)
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
