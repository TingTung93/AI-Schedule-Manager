"""
Schedule management API routes
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..dependencies import get_current_user, get_database_session
from ..models.schedule import Schedule
from ..models.schedule_assignment import ScheduleAssignment
from ..schemas import (
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
    ScheduleStatus
)

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("/", response_model=List[ScheduleResponse])
async def get_schedules(
    status: Optional[ScheduleStatus] = None,
    week_start: Optional[str] = None,
    week_end: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get all schedules with optional filtering.

    - **status**: Filter by schedule status
    - **week_start**: Filter by week start date (YYYY-MM-DD)
    - **week_end**: Filter by week end date (YYYY-MM-DD)
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    try:
        # Build query with eager loading
        query = select(Schedule).options(
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.employee),
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.shift),
            selectinload(Schedule.creator)
        )

        # Apply filters
        if status:
            query = query.where(Schedule.status == status.value)

        if week_start:
            query = query.where(Schedule.week_start >= week_start)

        if week_end:
            query = query.where(Schedule.week_end <= week_end)

        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(Schedule.created_at.desc())

        # Execute query
        result = await db.execute(query)
        schedules = result.scalars().all()

        return schedules

    except Exception as e:
        print(f"Error fetching schedules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch schedules: {str(e)}"
        )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """Get a specific schedule by ID."""
    try:
        query = select(Schedule).options(
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.employee),
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.shift),
            selectinload(Schedule.creator)
        ).where(Schedule.id == schedule_id)

        result = await db.execute(query)
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule with ID {schedule_id} not found"
            )

        return schedule

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch schedule: {str(e)}"
        )


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """Create a new schedule."""
    try:
        # Create new schedule
        new_schedule = Schedule(
            week_start=schedule_data.week_start,
            week_end=schedule_data.week_end,
            title=schedule_data.title,
            description=schedule_data.description,
            notes=schedule_data.notes,
            status="draft",
            created_by=current_user.id,
            version=1
        )

        db.add(new_schedule)
        await db.commit()
        await db.refresh(new_schedule)

        # Reload with relationships
        query = select(Schedule).options(
            selectinload(Schedule.assignments),
            selectinload(Schedule.creator)
        ).where(Schedule.id == new_schedule.id)

        result = await db.execute(query)
        schedule = result.scalar_one()

        return schedule

    except Exception as e:
        await db.rollback()
        print(f"Error creating schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create schedule: {str(e)}"
        )


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """Update an existing schedule."""
    try:
        # Find schedule
        result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule with ID {schedule_id} not found"
            )

        # Update fields
        update_data = schedule_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(schedule, field):
                setattr(schedule, field, value)

        await db.commit()
        await db.refresh(schedule)

        # Reload with relationships
        query = select(Schedule).options(
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.employee),
            selectinload(Schedule.assignments).selectinload(ScheduleAssignment.shift),
            selectinload(Schedule.creator)
        ).where(Schedule.id == schedule_id)

        result = await db.execute(query)
        schedule = result.scalar_one()

        return schedule

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error updating schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update schedule: {str(e)}"
        )


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """Delete a schedule."""
    try:
        result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule with ID {schedule_id} not found"
            )

        await db.delete(schedule)
        await db.commit()

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error deleting schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete schedule: {str(e)}"
        )
