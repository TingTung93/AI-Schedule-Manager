"""
Department management API endpoints.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_manager, get_current_user, get_database_session
from ..schemas import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    EmployeeResponse,
    PaginatedResponse,
    ShiftResponse,
)
from ..services.crud import crud_department

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=PaginatedResponse)
async def get_departments(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    active: Optional[bool] = Query(None),
    parent_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
):
    """
    Get all departments with hierarchy, pagination and filtering.

    - **active**: Filter by active status
    - **parent_id**: Filter by parent department (null for root departments)
    - **search**: Search by department name
    - **page**: Page number (starts at 1)
    - **size**: Items per page
    - **sort_by**: Field to sort by (name, created_at, etc.)
    - **sort_order**: Sort direction (asc or desc)
    """
    skip = (page - 1) * size

    result = await crud_department.get_multi_with_hierarchy(
        db=db,
        skip=skip,
        limit=size,
        active=active,
        parent_id=parent_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    # Convert ORM objects to response schemas
    department_responses = [DepartmentResponse.model_validate(dept) for dept in result["items"]]
    
    return PaginatedResponse(
        items=department_responses, total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Get specific department by ID with hierarchy information.

    Returns department with parent and children relationships loaded.
    """
    department = await crud_department.get_with_hierarchy(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return department


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    department: DepartmentCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Create new department.

    - **name**: Department name (unique, required)
    - **description**: Department description (optional)
    - **parent_id**: Parent department ID for hierarchy (optional)
    - **settings**: JSON settings object (optional)
    - **active**: Active status (default: true)

    Requires manager role.
    """
    # Check if parent exists if parent_id is provided
    if department.parent_id:
        parent = await crud_department.get(db, department.parent_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent department not found")

    try:
        new_department = await crud_department.create(db, department)
        return await crud_department.get_with_hierarchy(db, new_department.id)
    except Exception as e:
        logger.error(f"Error creating department: {e}")
        if "unique constraint" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department name already exists")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    department_update: DepartmentUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Update department.

    All fields are optional. Only provided fields will be updated.
    Requires manager role.
    """
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Check if parent exists if parent_id is being updated
    if department_update.parent_id is not None:
        # Prevent circular hierarchy
        if department_update.parent_id == department_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department cannot be its own parent")

        parent = await crud_department.get(db, department_update.parent_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent department not found")

    try:
        updated_department = await crud_department.update(db, department, department_update)
        return await crud_department.get_with_hierarchy(db, updated_department.id)
    except Exception as e:
        logger.error(f"Error updating department: {e}")
        if "unique constraint" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department name already exists")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{department_id}")
async def delete_department(
    department_id: int,
    force: bool = Query(False, description="Force delete even with dependencies"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Delete department.

    By default, prevents deletion if department has:
    - Employees assigned to it
    - Shifts assigned to it
    - Child departments

    Use force=true to delete anyway (will null out foreign keys).
    Requires manager role.
    """
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Check for dependencies
    dependencies = await crud_department.check_dependencies(db, department_id)

    if dependencies["has_dependencies"] and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Cannot delete department with dependencies",
                "dependencies": {
                    "employees": dependencies["employees"],
                    "shifts": dependencies["shifts"],
                    "children": dependencies["children"],
                },
                "hint": "Use force=true to delete anyway (will null out references)",
            },
        )

    await crud_department.remove(db, department_id)
    return {"message": "Department deleted successfully", "dependencies_cleared": dependencies}


@router.get("/{department_id}/staff", response_model=PaginatedResponse)
async def get_department_staff(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """
    Get all staff members assigned to a department.

    Returns paginated list of employees in the department.
    """
    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    skip = (page - 1) * size
    result = await crud_department.get_staff(db, department_id, skip, size)

    # Convert ORM objects to response schemas
    department_responses = [DepartmentResponse.model_validate(dept) for dept in result["items"]]
    
    return PaginatedResponse(
        items=department_responses, total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )


@router.get("/{department_id}/shifts", response_model=PaginatedResponse)
async def get_department_shifts(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """
    Get all shifts assigned to a department.

    Returns paginated list of shifts in the department.
    """
    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    skip = (page - 1) * size
    result = await crud_department.get_shifts(db, department_id, skip, size)

    # Convert ORM objects to response schemas
    department_responses = [DepartmentResponse.model_validate(dept) for dept in result["items"]]
    
    return PaginatedResponse(
        items=department_responses, total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )
