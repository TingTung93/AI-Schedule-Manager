"""
Department management API endpoints.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func

from ..dependencies import get_current_manager, get_current_user, get_database_session
from ..models import Department
from ..schemas import (
    DepartmentAnalyticsOverview,
    DepartmentCreate,
    DepartmentDetailedAnalytics,
    DepartmentResponse,
    DepartmentUpdate,
    EmployeeDistributionItem,
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

    SECURITY FIX: SQL injection vulnerability fixed via field whitelisting
    """
    # SECURITY FIX: Whitelist allowed sort fields to prevent SQL injection
    ALLOWED_SORT_FIELDS = {
        'name': Department.name,
        'created_at': Department.created_at,
        'updated_at': Department.updated_at,
        'employee_count': func.count(Department.id),
        'id': Department.id
    }

    # Validate sort_by parameter against whitelist
    if sort_by not in ALLOWED_SORT_FIELDS:
        logger.warning(f"Invalid sort_by parameter rejected: {sort_by}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by field. Allowed values: {', '.join(ALLOWED_SORT_FIELDS.keys())}"
        )

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


@router.get("/analytics/overview", response_model=DepartmentAnalyticsOverview)
async def get_departments_analytics(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Get department analytics overview.

    Returns comprehensive statistics including:
    - Total departments (active/inactive)
    - Total employees assigned/unassigned
    - Average employees per department
    - Largest/smallest departments by employee count
    - Department hierarchy depth
    - Root departments count

    All queries are optimized with aggregation functions to avoid N+1 queries.
    """
    logger.info(f"User {current_user.get('email')} requesting department analytics overview")
    analytics = await crud_department.get_analytics_overview(db)
    return analytics


@router.get("/analytics/distribution", response_model=List[EmployeeDistributionItem])
async def get_employee_distribution(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Get employee distribution across departments.

    Returns a list of departments with:
    - Department ID and name
    - Employee count
    - Percentage of total employees
    - Active status

    Data is formatted ready for charting (pie charts, bar graphs, etc.).
    Results are ordered by employee count (descending).
    """
    logger.info(f"User {current_user.get('email')} requesting employee distribution analytics")
    distribution = await crud_department.get_employee_distribution(db)
    return distribution


@router.get("/{department_id}/analytics", response_model=DepartmentDetailedAnalytics)
async def get_department_analytics(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Get detailed analytics for a specific department.

    Returns comprehensive department-specific metrics:
    - Employee count (total, by role, active/inactive)
    - Subdepartment count
    - Assignment trends for last 30/60/90 days

    All data is optimized with efficient SQL aggregations.
    """
    logger.info(f"User {current_user.get('email')} requesting analytics for department {department_id}")
    analytics = await crud_department.get_department_detailed_analytics(db, department_id)

    if not analytics:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    return analytics


# Department Schedule Management Endpoints
@router.get("/{department_id}/schedules", response_model=PaginatedResponse)
async def get_department_schedules(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    start_date: Optional[str] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by schedule status"),
):
    """
    Get all schedules for a department.

    Returns paginated list of schedules with:
    - Schedule metadata (name, dates, status)
    - Employee count
    - Shift count
    - Department information

    Query Parameters:
    - page: Page number (default: 1)
    - size: Items per page (default: 10, max: 100)
    - start_date: Filter schedules starting on or after this date
    - end_date: Filter schedules ending on or before this date
    - status: Filter by schedule status (draft, published, archived)
    """
    from datetime import date as date_type

    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Parse dates if provided
    start_date_obj = None
    end_date_obj = None
    if start_date:
        try:
            start_date_obj = date_type.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid start_date format")

    if end_date:
        try:
            end_date_obj = date_type.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid end_date format")

    skip = (page - 1) * size
    result = await crud_department.get_department_schedules(
        db, department_id, skip, size, start_date_obj, end_date_obj, status
    )

    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size,
    )


@router.post("/{department_id}/schedules", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_department_schedule(
    department_id: int,
    schedule_data: Dict[str, Any],
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Create a new schedule for a department.

    Request Body:
    - name: Schedule name (required)
    - start_date: Schedule start date (YYYY-MM-DD, required)
    - end_date: Schedule end date (YYYY-MM-DD, required)
    - template_id: Template to apply (optional)
    - notes: Additional notes (optional)

    Returns the created schedule with metadata.
    Requires manager role.
    """
    from ..schemas import DepartmentScheduleCreate

    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Validate input
    try:
        validated_data = DepartmentScheduleCreate(**schedule_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Create the schedule
    try:
        schedule = await crud_department.create_department_schedule(
            db, department_id, validated_data.model_dump(), current_user["id"]
        )
        return schedule
    except Exception as e:
        logger.error(f"Error creating department schedule: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{department_id}/schedule-overview", response_model=Dict[str, Any])
async def get_department_schedule_overview(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    include_metrics: bool = Query(False, description="Include coverage analytics"),
):
    """
    Get consolidated schedule view for department.

    Returns a single view showing all employee schedules in the department
    for the specified date range.

    Response includes:
    - Department information
    - All employees with their scheduled shifts
    - Optional coverage metrics and analytics
    - Understaffed period detection

    Query Parameters:
    - start_date: Start of date range (required, YYYY-MM-DD)
    - end_date: End of date range (required, YYYY-MM-DD)
    - include_metrics: Include coverage analytics (default: false)
    """
    from datetime import date as date_type

    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Parse dates
    try:
        start_date_obj = date_type.fromisoformat(start_date)
        end_date_obj = date_type.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format")

    if end_date_obj <= start_date_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be after start_date")

    # Get the overview
    overview = await crud_department.get_schedule_overview(
        db, department_id, start_date_obj, end_date_obj, include_metrics
    )

    if not overview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    return overview


@router.get("/{department_id}/templates", response_model=PaginatedResponse)
async def get_department_templates(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """
    Get schedule templates for a department.

    Returns paginated list of reusable schedule templates that can be
    applied to create new schedules quickly.

    Templates include:
    - Template metadata (name, description, pattern type)
    - Template data (shift patterns, employee assignments)
    - Rotation configuration
    - Active status
    """
    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    skip = (page - 1) * size
    result = await crud_schedule_template.get_active_templates(db, skip, size)

    # Add department_id to each template in response
    for item in result["items"]:
        item.department_id = department_id

    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size,
    )


@router.post("/{department_id}/templates", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_department_template(
    department_id: int,
    template_data: Dict[str, Any],
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Create a new schedule template for a department.

    Request Body:
    - name: Template name (required)
    - description: Template description (optional)
    - template_data: Template data as JSON (required)
    - pattern_type: Pattern type - weekly, rotating, custom (default: custom)
    - rotation_days: Days in rotation cycle (optional, required for rotating)

    Templates can be reused to quickly create new schedules with
    consistent patterns.

    Requires manager role.
    """
    from ..schemas import ScheduleTemplateCreate

    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Validate input
    try:
        validated_data = ScheduleTemplateCreate(**template_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Create the template
    try:
        template = await crud_department.create_template(
            db, department_id, validated_data.model_dump(), current_user["id"]
        )
        return template
    except Exception as e:
        logger.error(f"Error creating department template: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{department_id}/templates/{template_id}/apply", response_model=Dict[str, Any])
async def apply_department_template(
    department_id: int,
    template_id: int,
    apply_data: Dict[str, Any],
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Apply a template to create a new schedule.

    Takes an existing schedule template and creates a new schedule
    for the specified date range.

    Request Body:
    - start_date: Schedule start date (YYYY-MM-DD, required)
    - end_date: Schedule end date (YYYY-MM-DD, required)
    - schedule_name: Custom schedule name (optional, uses template name if not provided)

    The template's shift patterns and assignments will be applied to
    create a complete schedule.

    Requires manager role.
    """
    from ..schemas import TemplateApplyRequest

    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Validate input
    try:
        validated_data = TemplateApplyRequest(**apply_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Apply the template
    try:
        schedule = await crud_department.apply_template(
            db, department_id, template_id, validated_data.model_dump(), current_user["id"]
        )
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return schedule
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying department template: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
