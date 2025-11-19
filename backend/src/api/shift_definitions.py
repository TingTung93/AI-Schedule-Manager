"""
Shift Definition Management API endpoints.

Provides CRUD operations for reusable shift templates (e.g., AM, PM, Night shifts).
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_manager, get_current_user, get_database_session
from ..auth.models import User
from ..models import ShiftDefinition
from ..schemas import (
    PaginatedResponse,
    ShiftDefinitionCreate,
    ShiftDefinitionResponse,
    ShiftDefinitionUpdate,
)
from ..services.crud_shift_definition import crud_shift_definition

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/shift-definitions", tags=["Shift Definitions"])


@router.get("", response_model=PaginatedResponse)
async def get_shift_definitions(
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    shift_type: Optional[str] = Query(None, description="Filter by shift type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search in name, abbreviation, description"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("name", description="Sort field"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order"),
):
    """
    Get all shift definitions with pagination and filtering.

    Shift definitions are reusable templates (e.g., "AM Shift", "PM Shift")
    that can be used to create actual shift instances in schedules.

    - **department_id**: Filter by department (null for organization-wide)
    - **shift_type**: Filter by type (morning, afternoon, evening, night, etc.)
    - **is_active**: Filter by active/inactive status
    - **search**: Search in name, abbreviation, or description
    - **page**: Page number for pagination
    - **size**: Number of items per page
    - **sort_by**: Field to sort by
    - **sort_order**: asc or desc
    """
    skip = (page - 1) * size

    filters = {}
    if department_id is not None:
        filters["department_id"] = department_id
    if shift_type is not None:
        filters["shift_type"] = shift_type
    if is_active is not None:
        filters["is_active"] = is_active
    if search:
        filters["search"] = search

    result = await crud_shift_definition.get_multi(
        db=db,
        skip=skip,
        limit=size,
        filters=filters,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=[item.to_dict() for item in result["items"]],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size if result["total"] > 0 else 0,
    )


@router.get("/active", response_model=list)
async def get_active_shift_definitions(
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
    department_id: Optional[int] = Query(None, description="Filter by department"),
):
    """
    Get all active shift definitions.

    Returns only active (enabled) shift definitions, optionally filtered by department.
    Includes both department-specific and organization-wide shifts.

    - **department_id**: Department ID (includes organization-wide shifts if specified)
    """
    shifts = await crud_shift_definition.get_active(db, department_id=department_id)
    return [shift.to_dict() for shift in shifts]


@router.get("/types", response_model=dict)
async def get_shift_types_summary(
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get shift type summary with counts.

    Returns available shift types and how many active shifts exist for each type.
    """
    type_counts = await crud_shift_definition.get_shift_types_with_counts(db)

    return {
        "available_types": [
            "morning",
            "afternoon",
            "evening",
            "night",
            "split",
            "on-call",
            "custom"
        ],
        "type_counts": type_counts,
        "total_active": sum(type_counts.values()) if type_counts else 0
    }


@router.get("/{shift_definition_id}", response_model=ShiftDefinitionResponse)
async def get_shift_definition(
    shift_definition_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get specific shift definition by ID.

    - **shift_definition_id**: The ID of the shift definition to retrieve
    """
    shift_def = await crud_shift_definition.get(db, shift_definition_id)
    if not shift_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift definition with ID {shift_definition_id} not found"
        )
    return shift_def


@router.post("", response_model=ShiftDefinitionResponse, status_code=status.HTTP_201_CREATED)
async def create_shift_definition(
    shift_def: ShiftDefinitionCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_manager),
):
    """
    Create a new shift definition template.

    - **name**: Unique shift name (e.g., "Morning Shift")
    - **abbreviation**: Unique abbreviation (e.g., "AM", "PM")
    - **shift_type**: Type (morning, afternoon, evening, night, split, on-call, custom)
    - **start_time**: Start time (HH:MM format)
    - **end_time**: End time (HH:MM format)
    - **color**: Hex color code (e.g., "#1976d2")
    - **required_staff**: Number of staff required (must be >= 1)
    - **department_id**: Department ID (optional, null for organization-wide)
    - **hourly_rate_multiplier**: Pay rate multiplier (default 1.0)
    - **required_qualifications**: Dict of required qualifications (optional)
    - **is_active**: Whether shift is active (default true)
    - **description**: Description (optional)

    **Validation:**
    - Name must be unique
    - Abbreviation must be unique
    - For same-day shifts: start_time must be before end_time
    - Overnight shifts (end_time < start_time) are allowed
    """
    # Check if name already exists
    if await crud_shift_definition.check_name_exists(db, shift_def.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Shift definition with name '{shift_def.name}' already exists"
        )

    # Check if abbreviation already exists
    if await crud_shift_definition.check_abbreviation_exists(db, shift_def.abbreviation):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Shift definition with abbreviation '{shift_def.abbreviation}' already exists"
        )

    # Create shift definition
    new_shift_def = await crud_shift_definition.create(
        db,
        shift_def,
        created_by_id=current_user.id
    )

    logger.info(
        f"Created shift definition: {new_shift_def.name} ({new_shift_def.abbreviation}) "
        f"by user {current_user.id}"
    )

    return new_shift_def


@router.patch("/{shift_definition_id}", response_model=ShiftDefinitionResponse)
async def update_shift_definition(
    shift_definition_id: int,
    shift_def_update: ShiftDefinitionUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_manager),
):
    """
    Update an existing shift definition.

    - **shift_definition_id**: The ID of the shift definition to update

    All fields are optional. Only provided fields will be updated.

    **Validation:**
    - Name must be unique (if changed)
    - Abbreviation must be unique (if changed)
    - Times must be valid (if both provided)
    """
    shift_def = await crud_shift_definition.get(db, shift_definition_id)
    if not shift_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift definition with ID {shift_definition_id} not found"
        )

    update_data = shift_def_update.dict(exclude_unset=True)

    # Check if name is being changed and if new name already exists
    if "name" in update_data and update_data["name"] != shift_def.name:
        if await crud_shift_definition.check_name_exists(
            db,
            update_data["name"],
            exclude_id=shift_definition_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shift definition with name '{update_data['name']}' already exists"
            )

    # Check if abbreviation is being changed and if new abbreviation already exists
    if "abbreviation" in update_data and update_data["abbreviation"] != shift_def.abbreviation:
        if await crud_shift_definition.check_abbreviation_exists(
            db,
            update_data["abbreviation"],
            exclude_id=shift_definition_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shift definition with abbreviation '{update_data['abbreviation']}' already exists"
            )

    # Update shift definition
    updated_shift_def = await crud_shift_definition.update(db, shift_def, shift_def_update)

    logger.info(
        f"Updated shift definition: {updated_shift_def.name} (ID: {shift_definition_id}) "
        f"by user {current_user.id}"
    )

    return updated_shift_def


@router.delete("/{shift_definition_id}", status_code=status.HTTP_200_OK)
async def delete_shift_definition(
    shift_definition_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_manager),
):
    """
    Delete a shift definition.

    - **shift_definition_id**: The ID of the shift definition to delete

    **Note:** This deletes the template, not actual shift instances in schedules.
    """
    shift_def = await crud_shift_definition.get(db, shift_definition_id)
    if not shift_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift definition with ID {shift_definition_id} not found"
        )

    await crud_shift_definition.remove(db, shift_definition_id)

    logger.info(
        f"Deleted shift definition: {shift_def.name} (ID: {shift_definition_id}) "
        f"by user {current_user.id}"
    )

    return {
        "message": "Shift definition deleted successfully",
        "id": shift_definition_id,
        "name": shift_def.name
    }


@router.post("/{shift_definition_id}/toggle", response_model=ShiftDefinitionResponse)
async def toggle_shift_definition(
    shift_definition_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: User = Depends(get_current_manager),
):
    """
    Toggle the active status of a shift definition.

    Convenience endpoint to activate/deactivate a shift definition.

    - **shift_definition_id**: The ID of the shift definition to toggle
    """
    shift_def = await crud_shift_definition.get(db, shift_definition_id)
    if not shift_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift definition with ID {shift_definition_id} not found"
        )

    # Toggle active status
    update_data = ShiftDefinitionUpdate(is_active=not shift_def.is_active)
    updated_shift_def = await crud_shift_definition.update(db, shift_def, update_data)

    action = "activated" if updated_shift_def.is_active else "deactivated"
    logger.info(
        f"{action.capitalize()} shift definition: {updated_shift_def.name} "
        f"(ID: {shift_definition_id}) by user {current_user.id}"
    )

    return updated_shift_def
