"""
Assignment management API routes for ScheduleAssignment CRUD operations.

This module provides comprehensive endpoints for managing employee shift assignments,
including conflict detection, bulk operations, and employee confirmations.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..dependencies import get_current_user, get_database_session
from ..models.employee import Employee
from ..models.schedule import Schedule
from ..models.schedule_assignment import ScheduleAssignment
from ..models.shift import Shift
from ..schemas import (
    AssignmentBulkCreateRequest,
    AssignmentBulkCreateResponse,
    AssignmentConfirmRequest,
    AssignmentCreate,
    AssignmentDeclineRequest,
    AssignmentResponse,
    AssignmentUpdate,
    MessageResponse,
)

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.post("/schedules/{schedule_id}/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    schedule_id: int,
    assignment: AssignmentCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """
    Create a new schedule assignment.

    Validates:
    - Schedule exists and is editable
    - Employee exists and is active
    - Shift exists
    - No conflicts with existing assignments
    - Employee qualifications match shift requirements
    """
    try:
        # Validate schedule exists and is editable
        schedule_query = select(Schedule).where(Schedule.id == schedule_id)
        schedule_result = await db.execute(schedule_query)
        schedule = schedule_result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Schedule with ID {schedule_id} not found"
            )

        if not schedule.is_editable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Schedule is {schedule.status} and cannot be modified",
            )

        # Validate employee exists and is active
        employee_query = select(Employee).where(Employee.id == assignment.employee_id)
        employee_result = await db.execute(employee_query)
        employee = employee_result.scalar_one_or_none()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Employee with ID {assignment.employee_id} not found"
            )

        if not employee.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee {employee.name} is not active",
            )

        # Validate shift exists
        shift_query = (
            select(Shift)
            .options(selectinload(Shift.schedule_assignments))
            .where(Shift.id == assignment.shift_id)
        )
        shift_result = await db.execute(shift_query)
        shift = shift_result.scalar_one_or_none()

        if not shift:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Shift with ID {assignment.shift_id} not found"
            )

        # Check for duplicate assignment
        duplicate_query = select(ScheduleAssignment).where(
            and_(
                ScheduleAssignment.schedule_id == schedule_id,
                ScheduleAssignment.employee_id == assignment.employee_id,
                ScheduleAssignment.shift_id == assignment.shift_id,
            )
        )
        duplicate_result = await db.execute(duplicate_query)
        duplicate = duplicate_result.scalar_one_or_none()

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Employee {employee.name} is already assigned to this shift",
            )

        # Check for conflicts (overlapping shifts on same date)
        conflict_query = (
            select(ScheduleAssignment)
            .join(Shift, ScheduleAssignment.shift_id == Shift.id)
            .where(
                and_(
                    ScheduleAssignment.employee_id == assignment.employee_id,
                    ScheduleAssignment.status.in_(["assigned", "confirmed"]),
                    Shift.date == shift.date,
                )
            )
            .options(selectinload(ScheduleAssignment.shift))
        )
        conflict_result = await db.execute(conflict_query)
        existing_assignments = conflict_result.scalars().all()

        conflicts = []
        for existing in existing_assignments:
            if shift.conflicts_with(existing.shift):
                conflicts.append(
                    f"Conflicts with shift {existing.shift.id} ({existing.shift.start_time} - {existing.shift.end_time})"
                )

        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Assignment conflicts detected: {'; '.join(conflicts)}",
            )

        # Check employee qualifications
        can_assign, reason = shift.can_assign_employee(employee)
        if not can_assign:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

        # Create the assignment
        new_assignment = ScheduleAssignment(
            schedule_id=schedule_id,
            employee_id=assignment.employee_id,
            shift_id=assignment.shift_id,
            status=assignment.status or "assigned",
            priority=assignment.priority or 1,
            notes=assignment.notes,
            assigned_by=current_user["id"],
            assigned_at=datetime.utcnow(),
            auto_assigned=False,
            conflicts_resolved=True,  # Conflicts were checked
        )

        db.add(new_assignment)
        await db.commit()
        await db.refresh(new_assignment)

        # Reload with relationships
        reload_query = (
            select(ScheduleAssignment)
            .options(
                selectinload(ScheduleAssignment.employee),
                selectinload(ScheduleAssignment.shift),
                selectinload(ScheduleAssignment.schedule),
            )
            .where(ScheduleAssignment.id == new_assignment.id)
        )
        reload_result = await db.execute(reload_query)
        assignment_with_relations = reload_result.scalar_one()

        return assignment_with_relations

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create assignment: {str(e)}"
        )


@router.post("/bulk", response_model=AssignmentBulkCreateResponse, status_code=status.HTTP_201_CREATED)
async def bulk_create_assignments(
    bulk_data: AssignmentBulkCreateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """
    Create multiple assignments in a single transaction.

    Used by wizard PublishStep to create all assignments at once.
    Returns list of created assignments and any validation errors.
    """
    try:
        # Validate schedule exists and is editable
        schedule_query = select(Schedule).where(Schedule.id == bulk_data.schedule_id)
        schedule_result = await db.execute(schedule_query)
        schedule = schedule_result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Schedule with ID {bulk_data.schedule_id} not found"
            )

        if not schedule.is_editable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Schedule is {schedule.status} and cannot be modified",
            )

        created_assignments = []
        errors = []

        # Pre-load all employees and shifts for efficiency
        employee_ids = {a.employee_id for a in bulk_data.assignments}
        shift_ids = {a.shift_id for a in bulk_data.assignments}

        employees_query = select(Employee).where(Employee.id.in_(employee_ids))
        employees_result = await db.execute(employees_query)
        employees_map = {emp.id: emp for emp in employees_result.scalars().all()}

        shifts_query = select(Shift).where(Shift.id.in_(shift_ids))
        shifts_result = await db.execute(shifts_query)
        shifts_map = {shift.id: shift for shift in shifts_result.scalars().all()}

        # Get existing assignments for conflict detection
        existing_query = (
            select(ScheduleAssignment)
            .join(Shift, ScheduleAssignment.shift_id == Shift.id)
            .where(
                and_(
                    ScheduleAssignment.employee_id.in_(employee_ids),
                    ScheduleAssignment.status.in_(["assigned", "confirmed"]),
                )
            )
            .options(selectinload(ScheduleAssignment.shift))
        )
        existing_result = await db.execute(existing_query)
        existing_assignments = existing_result.scalars().all()

        # Group existing assignments by employee
        employee_assignments = {}
        for assignment in existing_assignments:
            if assignment.employee_id not in employee_assignments:
                employee_assignments[assignment.employee_id] = []
            employee_assignments[assignment.employee_id].append(assignment)

        # Process each assignment
        for idx, assignment_data in enumerate(bulk_data.assignments):
            try:
                # Validate employee
                employee = employees_map.get(assignment_data.employee_id)
                if not employee:
                    errors.append(
                        {
                            "index": idx,
                            "employee_id": assignment_data.employee_id,
                            "shift_id": assignment_data.shift_id,
                            "error": f"Employee with ID {assignment_data.employee_id} not found",
                        }
                    )
                    continue

                if not employee.is_active:
                    errors.append(
                        {
                            "index": idx,
                            "employee_id": assignment_data.employee_id,
                            "shift_id": assignment_data.shift_id,
                            "error": f"Employee {employee.name} is not active",
                        }
                    )
                    continue

                # Validate shift
                shift = shifts_map.get(assignment_data.shift_id)
                if not shift:
                    errors.append(
                        {
                            "index": idx,
                            "employee_id": assignment_data.employee_id,
                            "shift_id": assignment_data.shift_id,
                            "error": f"Shift with ID {assignment_data.shift_id} not found",
                        }
                    )
                    continue

                # Check conflicts if validation enabled
                if bulk_data.validate_conflicts:
                    conflicts = []
                    for existing in employee_assignments.get(assignment_data.employee_id, []):
                        if existing.shift.date == shift.date and shift.conflicts_with(existing.shift):
                            conflicts.append(f"Conflicts with shift {existing.shift_id}")

                    if conflicts:
                        errors.append(
                            {
                                "index": idx,
                                "employee_id": assignment_data.employee_id,
                                "shift_id": assignment_data.shift_id,
                                "error": f"Conflicts detected: {'; '.join(conflicts)}",
                            }
                        )
                        continue

                    # Check qualifications
                    can_assign, reason = shift.can_assign_employee(employee)
                    if not can_assign:
                        errors.append(
                            {
                                "index": idx,
                                "employee_id": assignment_data.employee_id,
                                "shift_id": assignment_data.shift_id,
                                "error": reason,
                            }
                        )
                        continue

                # Create assignment
                new_assignment = ScheduleAssignment(
                    schedule_id=bulk_data.schedule_id,
                    employee_id=assignment_data.employee_id,
                    shift_id=assignment_data.shift_id,
                    status=assignment_data.status or "assigned",
                    priority=assignment_data.priority or 1,
                    notes=assignment_data.notes,
                    assigned_by=current_user["id"],
                    assigned_at=datetime.utcnow(),
                    auto_assigned=False,
                    conflicts_resolved=bulk_data.validate_conflicts,
                )

                db.add(new_assignment)
                created_assignments.append(new_assignment)

            except Exception as e:
                errors.append(
                    {
                        "index": idx,
                        "employee_id": assignment_data.employee_id,
                        "shift_id": assignment_data.shift_id,
                        "error": f"Unexpected error: {str(e)}",
                    }
                )

        # Commit if any assignments were created
        if created_assignments:
            await db.commit()

            # Reload with relationships
            assignment_ids = [a.id for a in created_assignments]
            reload_query = (
                select(ScheduleAssignment)
                .options(
                    selectinload(ScheduleAssignment.employee),
                    selectinload(ScheduleAssignment.shift),
                    selectinload(ScheduleAssignment.schedule),
                )
                .where(ScheduleAssignment.id.in_(assignment_ids))
            )
            reload_result = await db.execute(reload_query)
            created_assignments = reload_result.scalars().all()

        return AssignmentBulkCreateResponse(
            created=created_assignments,
            errors=errors,
            total_processed=len(bulk_data.assignments),
            total_created=len(created_assignments),
            total_errors=len(errors),
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to bulk create assignments: {str(e)}"
        )


@router.get("/{id}", response_model=AssignmentResponse)
async def get_assignment(
    id: int, db: AsyncSession = Depends(get_database_session), current_user=Depends(get_current_user)
):
    """Get assignment by ID with full details."""
    try:
        query = (
            select(ScheduleAssignment)
            .options(
                selectinload(ScheduleAssignment.employee),
                selectinload(ScheduleAssignment.shift),
                selectinload(ScheduleAssignment.schedule),
            )
            .where(ScheduleAssignment.id == id)
        )

        result = await db.execute(query)
        assignment = result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment with ID {id} not found"
            )

        return assignment

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch assignment: {str(e)}"
        )


@router.put("/{id}", response_model=AssignmentResponse)
async def update_assignment(
    id: int,
    assignment: AssignmentUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """Update assignment (employee, shift, status, etc.)."""
    try:
        # Get existing assignment
        query = (
            select(ScheduleAssignment)
            .options(
                selectinload(ScheduleAssignment.employee),
                selectinload(ScheduleAssignment.shift),
                selectinload(ScheduleAssignment.schedule),
            )
            .where(ScheduleAssignment.id == id)
        )
        result = await db.execute(query)
        db_assignment = result.scalar_one_or_none()

        if not db_assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment with ID {id} not found"
            )

        # Check if schedule is editable
        if not db_assignment.schedule.is_editable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Schedule is {db_assignment.schedule.status} and cannot be modified",
            )

        # Update fields
        update_data = assignment.model_dump(exclude_unset=True)

        # If changing employee or shift, validate
        if "employee_id" in update_data or "shift_id" in update_data:
            new_employee_id = update_data.get("employee_id", db_assignment.employee_id)
            new_shift_id = update_data.get("shift_id", db_assignment.shift_id)

            # Validate employee
            employee_query = select(Employee).where(Employee.id == new_employee_id)
            employee_result = await db.execute(employee_query)
            employee = employee_result.scalar_one_or_none()

            if not employee or not employee.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Employee not found or not active"
                )

            # Validate shift
            shift_query = select(Shift).where(Shift.id == new_shift_id)
            shift_result = await db.execute(shift_query)
            shift = shift_result.scalar_one_or_none()

            if not shift:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")

            # Check qualifications
            can_assign, reason = shift.can_assign_employee(employee)
            if not can_assign:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

        # Apply updates
        for field, value in update_data.items():
            setattr(db_assignment, field, value)

        await db.commit()
        await db.refresh(db_assignment)

        return db_assignment

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update assignment: {str(e)}"
        )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    id: int, db: AsyncSession = Depends(get_database_session), current_user=Depends(get_current_user)
):
    """Delete assignment."""
    try:
        query = select(ScheduleAssignment).options(selectinload(ScheduleAssignment.schedule)).where(ScheduleAssignment.id == id)
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment with ID {id} not found"
            )

        # Check if schedule is editable
        if not assignment.schedule.is_editable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Schedule is {assignment.schedule.status} and cannot be modified",
            )

        await db.delete(assignment)
        await db.commit()

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete assignment: {str(e)}"
        )


@router.post("/{id}/confirm", response_model=AssignmentResponse)
async def confirm_assignment(
    id: int,
    confirm_data: Optional[AssignmentConfirmRequest] = None,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """Employee confirms they can work this assignment."""
    try:
        query = (
            select(ScheduleAssignment)
            .options(
                selectinload(ScheduleAssignment.employee),
                selectinload(ScheduleAssignment.shift),
                selectinload(ScheduleAssignment.schedule),
            )
            .where(ScheduleAssignment.id == id)
        )
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment with ID {id} not found"
            )

        # Check if user can confirm (only assigned employee can confirm)
        can_confirm, reason = assignment.can_confirm(assignment.employee)
        if not can_confirm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)

        # Confirm the assignment
        success, message = assignment.confirm_assignment(assignment.employee)
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

        if confirm_data and confirm_data.notes:
            assignment.notes = confirm_data.notes

        await db.commit()
        await db.refresh(assignment)

        return assignment

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to confirm assignment: {str(e)}"
        )


@router.post("/{id}/decline", response_model=MessageResponse)
async def decline_assignment(
    id: int,
    decline_data: AssignmentDeclineRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """Employee declines assignment with optional reason."""
    try:
        query = (
            select(ScheduleAssignment)
            .options(
                selectinload(ScheduleAssignment.employee),
                selectinload(ScheduleAssignment.shift),
                selectinload(ScheduleAssignment.schedule),
            )
            .where(ScheduleAssignment.id == id)
        )
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()

        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignment with ID {id} not found"
            )

        # Check if user can decline (only assigned employee can decline)
        can_decline, reason_text = assignment.can_decline(assignment.employee)
        if not can_decline:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason_text)

        # Decline the assignment
        success, message = assignment.decline_assignment(assignment.employee, decline_data.reason)
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

        await db.commit()

        return MessageResponse(message=f"Assignment declined: {decline_data.reason or 'No reason provided'}", success=True)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to decline assignment: {str(e)}"
        )


@router.get("/", response_model=List[AssignmentResponse])
async def list_assignments(
    schedule_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    shift_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """List assignments with filtering and pagination."""
    try:
        query = select(ScheduleAssignment).options(
            selectinload(ScheduleAssignment.employee),
            selectinload(ScheduleAssignment.shift),
            selectinload(ScheduleAssignment.schedule),
        )

        # Apply filters
        filters = []
        if schedule_id is not None:
            filters.append(ScheduleAssignment.schedule_id == schedule_id)
        if employee_id is not None:
            filters.append(ScheduleAssignment.employee_id == employee_id)
        if shift_id is not None:
            filters.append(ScheduleAssignment.shift_id == shift_id)
        if status is not None:
            filters.append(ScheduleAssignment.status == status)

        if filters:
            query = query.where(and_(*filters))

        # Filter by shift dates if provided
        if date_from or date_to:
            query = query.join(Shift, ScheduleAssignment.shift_id == Shift.id)
            if date_from:
                query = query.where(Shift.date >= date_from)
            if date_to:
                query = query.where(Shift.date <= date_to)

        # Apply pagination and sorting
        query = query.order_by(ScheduleAssignment.created_at.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        assignments = result.scalars().all()

        return assignments

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to list assignments: {str(e)}"
        )
