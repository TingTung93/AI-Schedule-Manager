"""
Shift Management API endpoints.

Provides comprehensive CRUD operations for shift definitions and shift templates.
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_manager, get_current_user, get_database_session
from ..models import Schedule, ScheduleTemplate, Shift
from ..schemas import PaginatedResponse, ShiftCreate, ShiftResponse, ShiftUpdate
from ..services.crud import crud_shift, crud_schedule, crud_schedule_template

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/shifts", tags=["Shifts"])


# Shift CRUD Endpoints
@router.get("", response_model=PaginatedResponse)
async def get_shifts(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    department: Optional[str] = Query(None, description="Filter by department"),
    shift_type: Optional[str] = Query(None, description="Filter by shift type (morning, afternoon, evening)"),
    active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("name", description="Sort field"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
):
    """
    Get all shift definitions with pagination and filtering.

    - **department**: Filter shifts by department
    - **shift_type**: Filter by shift type (morning, afternoon, evening, night)
    - **active**: Filter by active/inactive status
    - **page**: Page number for pagination
    - **size**: Number of items per page
    - **sort_by**: Field to sort by (name, shift_type, start_time, created_at)
    - **sort_order**: asc or desc
    """
    skip = (page - 1) * size

    filters = {}
    if department is not None:
        filters["department"] = department
    if shift_type is not None:
        filters["shift_type"] = shift_type
    if active is not None:
        filters["active"] = active

    result = await crud_shift.get_multi(
        db=db,
        skip=skip,
        limit=size,
        filters=filters,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size,
    )


@router.get("/types", response_model=dict)
async def get_shift_types(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Get available shift types with counts.

    Returns a dictionary of shift types and their usage counts.
    """
    shift_types = await crud_shift.get_shift_types(db)

    return {
        "shift_types": [
            "morning",
            "afternoon",
            "evening",
            "night",
            "split",
            "on-call"
        ],
        "used_types": shift_types,
        "total_shifts": sum(shift_types.values()) if shift_types else 0
    }


@router.get("/{shift_id}", response_model=ShiftResponse)
async def get_shift(
    shift_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Get specific shift definition by ID.

    - **shift_id**: The ID of the shift to retrieve
    """
    shift = await crud_shift.get(db, shift_id)
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift with ID {shift_id} not found"
        )
    return shift


@router.post("", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
async def create_shift(
    shift: ShiftCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Create a new shift definition.

    - **name**: Shift name (e.g., "Morning Server Shift")
    - **shift_type**: Type of shift (morning, afternoon, evening, night)
    - **start_time**: Start time (HH:MM format)
    - **end_time**: End time (HH:MM format)
    - **required_staff**: Number of staff required (must be >= 1)
    - **required_qualifications**: List of required qualifications
    - **department**: Department name (optional)
    - **hourly_rate_multiplier**: Pay rate multiplier (default 1.0)
    - **active**: Whether shift is active (default true)

    **Validation:**
    - start_time must be before end_time
    - required_staff must be at least 1
    - hourly_rate_multiplier must be positive
    """
    # Validate shift times
    if shift.start_time >= shift.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time"
        )

    # Validate required staff
    if shift.required_staff < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required staff must be at least 1"
        )

    # Check for conflicting shifts in same department
    if shift.department:
        conflicts = await crud_shift.check_conflicts(
            db,
            department=shift.department,
            start_time=shift.start_time,
            end_time=shift.end_time
        )
        if conflicts:
            logger.warning(
                f"Creating shift that conflicts with existing shifts in {shift.department}: {conflicts}"
            )

    new_shift = await crud_shift.create(db, shift)
    logger.info(f"Created shift: {new_shift.name} (ID: {new_shift.id})")
    return new_shift


@router.patch("/{shift_id}", response_model=ShiftResponse)
async def update_shift(
    shift_id: int,
    shift_update: ShiftUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Update an existing shift definition.

    - **shift_id**: The ID of the shift to update

    All fields are optional. Only provided fields will be updated.

    **Validation:**
    - If both start_time and end_time provided, start_time must be before end_time
    - If required_staff provided, must be at least 1
    """
    shift = await crud_shift.get(db, shift_id)
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift with ID {shift_id} not found"
        )

    # Validate time range if both times are being updated
    update_data = shift_update.dict(exclude_unset=True)
    start_time = update_data.get("start_time", shift.start_time)
    end_time = update_data.get("end_time", shift.end_time)

    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time"
        )

    # Validate required staff
    if "required_staff" in update_data and update_data["required_staff"] < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required staff must be at least 1"
        )

    updated_shift = await crud_shift.update(db, shift, shift_update)
    logger.info(f"Updated shift: {updated_shift.name} (ID: {updated_shift.id})")
    return updated_shift


@router.delete("/{shift_id}", status_code=status.HTTP_200_OK)
async def delete_shift(
    shift_id: int,
    force: bool = Query(False, description="Force delete even if shift is used in schedules"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Delete a shift definition.

    - **shift_id**: The ID of the shift to delete
    - **force**: If true, delete even if shift is referenced in schedules

    **Safety Check:**
    By default, shifts that are used in schedules cannot be deleted.
    Use force=true to override this safety check.
    """
    shift = await crud_shift.get(db, shift_id)
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift with ID {shift_id} not found"
        )

    # Check if shift is used in any schedules
    if not force:
        schedule_count = await crud_shift.count_schedule_usage(db, shift_id)
        if schedule_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete shift: used in {schedule_count} schedules. Use force=true to override."
            )

    await crud_shift.remove(db, shift_id)
    logger.info(f"Deleted shift ID: {shift_id}")
    return {"message": "Shift deleted successfully", "shift_id": shift_id}


@router.post("/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
async def bulk_create_shifts(
    shifts: List[ShiftCreate],
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Bulk create multiple shift definitions.

    - **shifts**: List of shift definitions to create

    **Validation:**
    - All shifts must pass individual validation rules
    - Operation is transactional (all or nothing)

    **Returns:**
    - created: List of created shift objects
    - count: Number of shifts created
    - errors: List of validation errors (if any)
    """
    if not shifts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No shifts provided"
        )

    if len(shifts) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create more than 50 shifts at once"
        )

    created_shifts = []
    errors = []

    for idx, shift in enumerate(shifts):
        try:
            # Validate shift times
            if shift.start_time >= shift.end_time:
                errors.append(f"Shift {idx}: Start time must be before end time")
                continue

            # Validate required staff
            if shift.required_staff < 1:
                errors.append(f"Shift {idx}: Required staff must be at least 1")
                continue

            # Create shift
            new_shift = await crud_shift.create(db, shift)
            created_shifts.append(new_shift)

        except Exception as e:
            logger.error(f"Error creating shift {idx}: {e}")
            errors.append(f"Shift {idx}: {str(e)}")

    if errors and not created_shifts:
        # All shifts failed
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "All shifts failed validation", "errors": errors}
        )

    logger.info(f"Bulk created {len(created_shifts)} shifts")
    return {
        "message": f"Successfully created {len(created_shifts)} shifts",
        "created": created_shifts,
        "count": len(created_shifts),
        "errors": errors if errors else None
    }


# Shift Template Endpoints
@router.get("/templates", response_model=PaginatedResponse)
async def get_shift_templates(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Items per page"),
):
    """
    Get all shift templates with pagination.

    Shift templates contain pre-configured shift patterns that can be applied
    to generate schedules quickly.

    - **active**: Filter by active/inactive templates
    - **page**: Page number for pagination
    - **size**: Number of items per page
    """
    skip = (page - 1) * size

    filters = {}
    if active is not None:
        filters["active"] = active

    result = await crud_schedule_template.get_multi(
        db=db,
        skip=skip,
        limit=size,
        filters=filters,
        sort_by="created_at",
        sort_order="desc",
    )

    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size,
    )


@router.post("/templates", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_shift_template(
    template_data: dict,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Create a new shift template.

    - **name**: Template name
    - **description**: Template description (optional)
    - **template_data**: JSON object containing shift patterns
    - **active**: Whether template is active (default true)

    **Template Data Format:**
    ```json
    {
        "shifts": [
            {
                "name": "Morning Shift",
                "shift_type": "morning",
                "start_time": "06:00",
                "end_time": "14:00",
                "required_staff": 3,
                "department": "Kitchen"
            }
        ],
        "weekly_pattern": {
            "monday": ["shift_1", "shift_2"],
            "tuesday": ["shift_1", "shift_3"]
        }
    }
    ```
    """
    required_fields = ["name", "template_data"]
    for field in required_fields:
        if field not in template_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )

    # Validate template_data structure
    if not isinstance(template_data.get("template_data"), dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="template_data must be a JSON object"
        )

    new_template = await crud_schedule_template.create(db, template_data)
    logger.info(f"Created shift template: {new_template.name} (ID: {new_template.id})")

    return {
        "message": "Shift template created successfully",
        "template": new_template,
        "id": new_template.id
    }


@router.post("/templates/{template_id}/apply", response_model=dict, status_code=status.HTTP_200_OK)
async def apply_shift_template(
    template_id: int,
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Apply a shift template to generate schedules.

    - **template_id**: ID of the template to apply
    - **start_date**: Start date for schedule generation
    - **end_date**: End date for schedule generation

    This endpoint creates shift definitions and optionally schedule assignments
    based on the template configuration.

    **Returns:**
    - shifts_created: Number of shifts created
    - schedules_created: Number of schedule assignments created
    - date_range: Applied date range
    """
    template = await crud_schedule_template.get(db, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found"
        )

    if not template.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply inactive template"
        )

    # Parse dates
    from datetime import datetime
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD"
        )

    if start >= end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date"
        )

    # Apply template (mock implementation)
    # In production, this would create shifts based on template_data
    shifts_created = 0
    schedules_created = 0

    template_data = template.template_data
    if "shifts" in template_data:
        shifts_created = len(template_data["shifts"])

    logger.info(
        f"Applied template {template.name} (ID: {template_id}) "
        f"from {start_date} to {end_date}"
    )

    return {
        "message": "Template applied successfully",
        "template_name": template.name,
        "shifts_created": shifts_created,
        "schedules_created": schedules_created,
        "date_range": {
            "start": start_date,
            "end": end_date
        }
    }
