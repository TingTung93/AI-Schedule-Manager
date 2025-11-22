"""
Schedule conflict detection service for department-level assignments.

This module provides functions to detect and analyze scheduling conflicts including:
- Overlapping shifts for the same employee
- Double-booking conflicts
- Shift time constraints validation
- Department coverage requirements
- Rest period violations
"""

from datetime import datetime, time, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from ..models import Shift, ScheduleAssignment, Employee, Department


class ConflictType:
    """Enum-like class for conflict types"""
    OVERLAPPING_SHIFTS = "overlapping_shifts"
    DOUBLE_BOOKING = "double_booking"
    EXCESSIVE_HOURS = "excessive_hours"
    INSUFFICIENT_REST = "insufficient_rest"
    UNDERSTAFFED = "understaffed"
    OVERSTAFFED = "overstaffed"
    UNAVAILABLE_EMPLOYEE = "unavailable_employee"
    MISSING_QUALIFICATION = "missing_qualification"


class ConflictSeverity:
    """Enum-like class for conflict severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


async def detect_overlapping_shifts(
    db: AsyncSession,
    employee_id: int,
    shift_date: datetime.date,
    start_time: time,
    end_time: time,
    exclude_assignment_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Detect overlapping shifts for a specific employee on a given date.

    Args:
        db: Database session
        employee_id: Employee to check
        shift_date: Date of the shift
        start_time: Shift start time
        end_time: Shift end time
        exclude_assignment_id: Assignment ID to exclude from check (for updates)

    Returns:
        List of conflicting assignments with details
    """
    # Query for assignments on the same date for the employee
    query = (
        select(ScheduleAssignment)
        .join(Shift)
        .options(selectinload(ScheduleAssignment.shift))
        .where(
            and_(
                ScheduleAssignment.employee_id == employee_id,
                ScheduleAssignment.status == "assigned",
                Shift.date == shift_date
            )
        )
    )

    if exclude_assignment_id:
        query = query.where(ScheduleAssignment.id != exclude_assignment_id)

    result = await db.execute(query)
    existing_assignments = result.scalars().all()

    conflicts = []
    for assignment in existing_assignments:
        shift = assignment.shift

        # Check for time overlap
        if _times_overlap(start_time, end_time, shift.start_time, shift.end_time):
            conflicts.append({
                "assignment_id": assignment.id,
                "shift_id": shift.id,
                "shift_date": shift.date.isoformat(),
                "shift_start": shift.start_time.isoformat(),
                "shift_end": shift.end_time.isoformat(),
                "conflict_type": ConflictType.OVERLAPPING_SHIFTS,
                "severity": ConflictSeverity.CRITICAL,
                "message": f"Employee already assigned to overlapping shift on {shift.date}",
                "suggested_resolution": "Reassign employee or adjust shift times"
            })

    return conflicts


async def detect_double_booking(
    db: AsyncSession,
    employee_id: int,
    shift_id: int
) -> Optional[Dict[str, Any]]:
    """
    Check if an employee is already assigned to the specific shift.

    Args:
        db: Database session
        employee_id: Employee to check
        shift_id: Shift to check

    Returns:
        Conflict details if double-booked, None otherwise
    """
    query = (
        select(ScheduleAssignment)
        .where(
            and_(
                ScheduleAssignment.employee_id == employee_id,
                ScheduleAssignment.shift_id == shift_id,
                ScheduleAssignment.status == "assigned"
            )
        )
    )

    result = await db.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        return {
            "assignment_id": existing.id,
            "shift_id": shift_id,
            "conflict_type": ConflictType.DOUBLE_BOOKING,
            "severity": ConflictSeverity.CRITICAL,
            "message": "Employee already assigned to this shift",
            "suggested_resolution": "Remove duplicate assignment"
        }

    return None


async def validate_shift_duration_limits(
    db: AsyncSession,
    employee_id: int,
    shift_date: datetime.date,
    shift_duration_hours: float,
    max_hours_per_day: float = 12.0,
    max_hours_per_week: float = 40.0
) -> List[Dict[str, Any]]:
    """
    Validate that shift assignments don't exceed duration limits.

    Args:
        db: Database session
        employee_id: Employee to check
        shift_date: Date of the shift
        shift_duration_hours: Duration of the new shift in hours
        max_hours_per_day: Maximum hours per day (default: 12)
        max_hours_per_week: Maximum hours per week (default: 40)

    Returns:
        List of conflicts if limits exceeded
    """
    conflicts = []

    # Check daily hours
    daily_hours = await _get_employee_daily_hours(db, employee_id, shift_date)
    total_daily_hours = daily_hours + shift_duration_hours

    if total_daily_hours > max_hours_per_day:
        conflicts.append({
            "conflict_type": ConflictType.EXCESSIVE_HOURS,
            "severity": ConflictSeverity.HIGH,
            "period": "daily",
            "current_hours": daily_hours,
            "new_shift_hours": shift_duration_hours,
            "total_hours": total_daily_hours,
            "limit": max_hours_per_day,
            "excess_hours": total_daily_hours - max_hours_per_day,
            "message": f"Exceeds maximum daily hours ({max_hours_per_day}h)",
            "suggested_resolution": "Reduce shift duration or reassign to another employee"
        })

    # Check weekly hours
    week_start = shift_date - timedelta(days=shift_date.weekday())
    week_end = week_start + timedelta(days=6)

    weekly_hours = await _get_employee_weekly_hours(db, employee_id, week_start, week_end)
    total_weekly_hours = weekly_hours + shift_duration_hours

    if total_weekly_hours > max_hours_per_week:
        conflicts.append({
            "conflict_type": ConflictType.EXCESSIVE_HOURS,
            "severity": ConflictSeverity.MEDIUM,
            "period": "weekly",
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "current_hours": weekly_hours,
            "new_shift_hours": shift_duration_hours,
            "total_hours": total_weekly_hours,
            "limit": max_hours_per_week,
            "excess_hours": total_weekly_hours - max_hours_per_week,
            "message": f"Exceeds maximum weekly hours ({max_hours_per_week}h)",
            "suggested_resolution": "Redistribute hours across multiple employees"
        })

    return conflicts


async def validate_rest_period(
    db: AsyncSession,
    employee_id: int,
    shift_date: datetime.date,
    start_time: time,
    end_time: time,
    minimum_rest_hours: float = 8.0
) -> List[Dict[str, Any]]:
    """
    Check that employee has minimum rest period between shifts.

    Args:
        db: Database session
        employee_id: Employee to check
        shift_date: Date of the shift
        start_time: Shift start time
        end_time: Shift end time
        minimum_rest_hours: Minimum rest hours required (default: 8)

    Returns:
        List of conflicts if rest period insufficient
    """
    conflicts = []

    # Check previous day's shifts
    prev_date = shift_date - timedelta(days=1)
    prev_query = (
        select(Shift)
        .join(ScheduleAssignment)
        .where(
            and_(
                ScheduleAssignment.employee_id == employee_id,
                ScheduleAssignment.status == "assigned",
                Shift.date == prev_date
            )
        )
    )

    result = await db.execute(prev_query)
    prev_shifts = result.scalars().all()

    for prev_shift in prev_shifts:
        # Calculate rest hours
        prev_end = datetime.combine(prev_date, prev_shift.end_time)
        curr_start = datetime.combine(shift_date, start_time)

        # Handle shifts crossing midnight
        if prev_shift.end_time < prev_shift.start_time:
            prev_end += timedelta(days=1)

        rest_hours = (curr_start - prev_end).total_seconds() / 3600

        if rest_hours < minimum_rest_hours:
            conflicts.append({
                "conflict_type": ConflictType.INSUFFICIENT_REST,
                "severity": ConflictSeverity.HIGH,
                "previous_shift_id": prev_shift.id,
                "previous_shift_date": prev_date.isoformat(),
                "previous_shift_end": prev_shift.end_time.isoformat(),
                "current_shift_start": start_time.isoformat(),
                "rest_hours": round(rest_hours, 2),
                "required_rest_hours": minimum_rest_hours,
                "shortage_hours": round(minimum_rest_hours - rest_hours, 2),
                "message": f"Insufficient rest period ({rest_hours:.1f}h < {minimum_rest_hours}h)",
                "suggested_resolution": "Delay shift start time or reassign employee"
            })

    # Check next day's shifts
    next_date = shift_date + timedelta(days=1)
    next_query = (
        select(Shift)
        .join(ScheduleAssignment)
        .where(
            and_(
                ScheduleAssignment.employee_id == employee_id,
                ScheduleAssignment.status == "assigned",
                Shift.date == next_date
            )
        )
    )

    result = await db.execute(next_query)
    next_shifts = result.scalars().all()

    for next_shift in next_shifts:
        # Calculate rest hours
        curr_end = datetime.combine(shift_date, end_time)
        next_start = datetime.combine(next_date, next_shift.start_time)

        # Handle shifts crossing midnight
        if end_time < start_time:
            curr_end += timedelta(days=1)

        rest_hours = (next_start - curr_end).total_seconds() / 3600

        if rest_hours < minimum_rest_hours:
            conflicts.append({
                "conflict_type": ConflictType.INSUFFICIENT_REST,
                "severity": ConflictSeverity.HIGH,
                "next_shift_id": next_shift.id,
                "next_shift_date": next_date.isoformat(),
                "next_shift_start": next_shift.start_time.isoformat(),
                "current_shift_end": end_time.isoformat(),
                "rest_hours": round(rest_hours, 2),
                "required_rest_hours": minimum_rest_hours,
                "shortage_hours": round(minimum_rest_hours - rest_hours, 2),
                "message": f"Insufficient rest before next shift ({rest_hours:.1f}h < {minimum_rest_hours}h)",
                "suggested_resolution": "Adjust shift end time or reassign next shift"
            })

    return conflicts


async def check_department_coverage(
    db: AsyncSession,
    department_id: int,
    shift_date: datetime.date,
    start_time: time,
    end_time: time,
    required_staff: int = 1
) -> List[Dict[str, Any]]:
    """
    Check if department has adequate coverage for a time period.

    Args:
        db: Database session
        department_id: Department to check
        shift_date: Date to check
        start_time: Period start time
        end_time: Period end time
        required_staff: Number of staff required

    Returns:
        List of coverage conflicts (understaffed/overstaffed)
    """
    conflicts = []

    # Get all shifts for the department on this date that overlap with the time period
    query = (
        select(Shift)
        .options(selectinload(Shift.schedule_assignments))
        .where(
            and_(
                Shift.department_id == department_id,
                Shift.date == shift_date
            )
        )
    )

    result = await db.execute(query)
    shifts = result.scalars().all()

    # Filter to overlapping shifts
    overlapping_shifts = [
        shift for shift in shifts
        if _times_overlap(start_time, end_time, shift.start_time, shift.end_time)
    ]

    for shift in overlapping_shifts:
        assigned_count = len([
            a for a in shift.schedule_assignments
            if a.status == "assigned"
        ])

        if assigned_count < shift.required_staff:
            conflicts.append({
                "conflict_type": ConflictType.UNDERSTAFFED,
                "severity": ConflictSeverity.HIGH,
                "shift_id": shift.id,
                "shift_date": shift.date.isoformat(),
                "shift_start": shift.start_time.isoformat(),
                "shift_end": shift.end_time.isoformat(),
                "required_staff": shift.required_staff,
                "assigned_staff": assigned_count,
                "shortage": shift.required_staff - assigned_count,
                "message": f"Understaffed: {assigned_count}/{shift.required_staff} staff assigned",
                "suggested_resolution": f"Assign {shift.required_staff - assigned_count} more employee(s)"
            })
        elif assigned_count > shift.required_staff:
            conflicts.append({
                "conflict_type": ConflictType.OVERSTAFFED,
                "severity": ConflictSeverity.LOW,
                "shift_id": shift.id,
                "shift_date": shift.date.isoformat(),
                "shift_start": shift.start_time.isoformat(),
                "shift_end": shift.end_time.isoformat(),
                "required_staff": shift.required_staff,
                "assigned_staff": assigned_count,
                "excess": assigned_count - shift.required_staff,
                "message": f"Overstaffed: {assigned_count}/{shift.required_staff} staff assigned",
                "suggested_resolution": f"Reassign {assigned_count - shift.required_staff} employee(s)"
            })

    return conflicts


async def validate_employee_assignment(
    db: AsyncSession,
    employee_id: int,
    shift_id: int,
    exclude_assignment_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Comprehensive validation of employee assignment to a shift.

    Checks:
    - Employee availability
    - Required qualifications
    - Overlapping shifts
    - Double booking
    - Duration limits
    - Rest periods

    Args:
        db: Database session
        employee_id: Employee to assign
        shift_id: Shift to assign to
        exclude_assignment_id: Assignment ID to exclude (for updates)

    Returns:
        List of all detected conflicts
    """
    conflicts = []

    # Get employee and shift details
    employee_query = select(Employee).where(Employee.id == employee_id)
    shift_query = select(Shift).where(Shift.id == shift_id)

    employee_result = await db.execute(employee_query)
    shift_result = await db.execute(shift_query)

    employee = employee_result.scalar_one_or_none()
    shift = shift_result.scalar_one_or_none()

    if not employee:
        return [{
            "conflict_type": "invalid_employee",
            "severity": ConflictSeverity.CRITICAL,
            "message": "Employee not found"
        }]

    if not shift:
        return [{
            "conflict_type": "invalid_shift",
            "severity": ConflictSeverity.CRITICAL,
            "message": "Shift not found"
        }]

    # Check double booking
    double_booking = await detect_double_booking(db, employee_id, shift_id)
    if double_booking:
        conflicts.append(double_booking)

    # Check overlapping shifts
    overlapping = await detect_overlapping_shifts(
        db, employee_id, shift.date, shift.start_time, shift.end_time, exclude_assignment_id
    )
    conflicts.extend(overlapping)

    # Check duration limits
    shift_duration = shift.duration_hours
    duration_conflicts = await validate_shift_duration_limits(
        db, employee_id, shift.date, shift_duration
    )
    conflicts.extend(duration_conflicts)

    # Check rest periods
    rest_conflicts = await validate_rest_period(
        db, employee_id, shift.date, shift.start_time, shift.end_time
    )
    conflicts.extend(rest_conflicts)

    # Check employee availability
    day_name = shift.date.strftime("%A").lower()
    shift_start = shift.start_time.strftime("%H:%M")

    if not employee.is_available_at(day_name, shift_start):
        conflicts.append({
            "conflict_type": ConflictType.UNAVAILABLE_EMPLOYEE,
            "severity": ConflictSeverity.MEDIUM,
            "day": day_name,
            "time": shift_start,
            "message": f"Employee not available on {day_name} at {shift_start}",
            "suggested_resolution": "Choose an available employee or update availability"
        })

    # Check qualifications if shift has requirements
    if shift.requirements:
        required_quals = shift.requirements.get("qualifications", [])
        if required_quals:
            missing_quals = [
                qual for qual in required_quals
                if not employee.has_qualification(qual)
            ]

            if missing_quals:
                conflicts.append({
                    "conflict_type": ConflictType.MISSING_QUALIFICATION,
                    "severity": ConflictSeverity.HIGH,
                    "required_qualifications": required_quals,
                    "missing_qualifications": missing_quals,
                    "message": f"Employee missing qualifications: {', '.join(missing_quals)}",
                    "suggested_resolution": "Assign employee with required qualifications"
                })

    return conflicts


async def generate_conflict_report(
    db: AsyncSession,
    department_id: int,
    start_date: datetime.date,
    end_date: datetime.date
) -> Dict[str, Any]:
    """
    Generate comprehensive conflict report for department schedule.

    Args:
        db: Database session
        department_id: Department to analyze
        start_date: Start of date range
        end_date: End of date range

    Returns:
        Detailed conflict report with summary and actionable items
    """
    # Get all shifts in the date range
    query = (
        select(Shift)
        .options(selectinload(Shift.schedule_assignments).selectinload(ScheduleAssignment.employee))
        .where(
            and_(
                Shift.department_id == department_id,
                Shift.date >= start_date,
                Shift.date <= end_date
            )
        )
    )

    result = await db.execute(query)
    shifts = result.scalars().all()

    all_conflicts = []
    coverage_issues = []

    # Check coverage for each shift
    for shift in shifts:
        coverage_conflicts = await check_department_coverage(
            db, department_id, shift.date, shift.start_time, shift.end_time, shift.required_staff
        )
        coverage_issues.extend(coverage_conflicts)

        # Check each assignment for conflicts
        for assignment in shift.schedule_assignments:
            if assignment.status != "assigned":
                continue

            assignment_conflicts = await validate_employee_assignment(
                db, assignment.employee_id, shift.id, assignment.id
            )

            # Add context to conflicts
            for conflict in assignment_conflicts:
                conflict["employee_id"] = assignment.employee_id
                conflict["employee_name"] = f"{assignment.employee.first_name} {assignment.employee.last_name}"
                conflict["shift_id"] = shift.id
                conflict["shift_date"] = shift.date.isoformat()
                all_conflicts.append(conflict)

    # Categorize conflicts by severity
    critical_conflicts = [c for c in all_conflicts if c.get("severity") == ConflictSeverity.CRITICAL]
    high_conflicts = [c for c in all_conflicts if c.get("severity") == ConflictSeverity.HIGH]
    medium_conflicts = [c for c in all_conflicts if c.get("severity") == ConflictSeverity.MEDIUM]
    low_conflicts = [c for c in all_conflicts if c.get("severity") == ConflictSeverity.LOW]

    return {
        "department_id": department_id,
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "summary": {
            "total_shifts": len(shifts),
            "total_conflicts": len(all_conflicts),
            "critical_conflicts": len(critical_conflicts),
            "high_conflicts": len(high_conflicts),
            "medium_conflicts": len(medium_conflicts),
            "low_conflicts": len(low_conflicts),
            "coverage_issues": len(coverage_issues)
        },
        "conflicts_by_severity": {
            "critical": critical_conflicts,
            "high": high_conflicts,
            "medium": medium_conflicts,
            "low": low_conflicts
        },
        "coverage_issues": coverage_issues,
        "recommendations": _generate_recommendations(all_conflicts, coverage_issues)
    }


# Helper functions

def _times_overlap(start1: time, end1: time, start2: time, end2: time) -> bool:
    """
    Check if two time ranges overlap.

    Handles shifts that cross midnight.
    """
    # Convert times to minutes for easier comparison
    start1_mins = start1.hour * 60 + start1.minute
    end1_mins = end1.hour * 60 + end1.minute
    start2_mins = start2.hour * 60 + start2.minute
    end2_mins = end2.hour * 60 + end2.minute

    # Handle midnight crossing
    if end1_mins < start1_mins:
        end1_mins += 24 * 60
    if end2_mins < start2_mins:
        end2_mins += 24 * 60

    # Check overlap
    return start1_mins < end2_mins and end1_mins > start2_mins


async def _get_employee_daily_hours(
    db: AsyncSession,
    employee_id: int,
    date: datetime.date
) -> float:
    """Get total hours employee is scheduled for on a specific date."""
    query = (
        select(Shift)
        .join(ScheduleAssignment)
        .where(
            and_(
                ScheduleAssignment.employee_id == employee_id,
                ScheduleAssignment.status == "assigned",
                Shift.date == date
            )
        )
    )

    result = await db.execute(query)
    shifts = result.scalars().all()

    return sum(shift.duration_hours for shift in shifts)


async def _get_employee_weekly_hours(
    db: AsyncSession,
    employee_id: int,
    week_start: datetime.date,
    week_end: datetime.date
) -> float:
    """Get total hours employee is scheduled for in a week."""
    query = (
        select(Shift)
        .join(ScheduleAssignment)
        .where(
            and_(
                ScheduleAssignment.employee_id == employee_id,
                ScheduleAssignment.status == "assigned",
                Shift.date >= week_start,
                Shift.date <= week_end
            )
        )
    )

    result = await db.execute(query)
    shifts = result.scalars().all()

    return sum(shift.duration_hours for shift in shifts)


def _generate_recommendations(
    conflicts: List[Dict[str, Any]],
    coverage_issues: List[Dict[str, Any]]
) -> List[str]:
    """Generate actionable recommendations based on detected conflicts."""
    recommendations = []

    # Count conflict types
    conflict_counts = {}
    for conflict in conflicts:
        conflict_type = conflict.get("conflict_type", "unknown")
        conflict_counts[conflict_type] = conflict_counts.get(conflict_type, 0) + 1

    # Generate recommendations based on common issues
    if conflict_counts.get(ConflictType.OVERLAPPING_SHIFTS, 0) > 0:
        recommendations.append(
            f"Review {conflict_counts[ConflictType.OVERLAPPING_SHIFTS]} overlapping shift assignments"
        )

    if conflict_counts.get(ConflictType.EXCESSIVE_HOURS, 0) > 0:
        recommendations.append(
            f"Redistribute workload for {conflict_counts[ConflictType.EXCESSIVE_HOURS]} employees exceeding hour limits"
        )

    if conflict_counts.get(ConflictType.INSUFFICIENT_REST, 0) > 0:
        recommendations.append(
            f"Adjust shift times to ensure proper rest periods for {conflict_counts[ConflictType.INSUFFICIENT_REST]} violations"
        )

    understaffed = [c for c in coverage_issues if c.get("conflict_type") == ConflictType.UNDERSTAFFED]
    if understaffed:
        recommendations.append(
            f"Assign additional staff to {len(understaffed)} understaffed shifts"
        )

    overstaffed = [c for c in coverage_issues if c.get("conflict_type") == ConflictType.OVERSTAFFED]
    if overstaffed:
        recommendations.append(
            f"Consider reassigning {len(overstaffed)} overstaffed shifts to optimize labor costs"
        )

    if not recommendations:
        recommendations.append("No conflicts detected - schedule looks good!")

    return recommendations
