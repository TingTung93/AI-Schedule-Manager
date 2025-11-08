"""
Analytics API endpoints with real database queries
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from typing import Optional
from ..dependencies import get_database_session, get_current_user
from ..models import Employee, Schedule, Shift, ScheduleAssignment
from ..schemas import (
    AnalyticsOverviewResponse,
    LaborCostsResponse,
    LaborCostData,
    PerformanceMetricsResponse,
    EfficiencyMetricsResponse
)
from datetime import datetime, timedelta, date

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get analytics overview with real data from database."""

    # Count total active employees
    total_employees = await db.scalar(
        select(func.count(Employee.id)).where(Employee.is_active == True)
    ) or 0

    # Count total published schedules
    total_schedules = await db.scalar(
        select(func.count(Schedule.id)).where(
            Schedule.status.in_(['published', 'approved'])
        )
    ) or 0

    # Calculate total hours from assigned shifts
    # Join assignments to shifts and sum duration
    total_hours_result = await db.execute(
        select(func.sum(
            func.extract('epoch', Shift.end_time - Shift.start_time) / 3600
        ))
        .select_from(ScheduleAssignment)
        .join(Shift, ScheduleAssignment.shift_id == Shift.id)
        .where(ScheduleAssignment.status.in_(['assigned', 'confirmed', 'completed']))
    )
    total_hours = total_hours_result.scalar() or 0

    # Calculate efficiency: confirmed assignments / total assignments
    total_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
    ) or 1  # Avoid division by zero

    confirmed_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
        .where(ScheduleAssignment.status.in_(['confirmed', 'completed']))
    ) or 0

    efficiency = (confirmed_assignments / total_assignments * 100) if total_assignments > 0 else 0

    # Calculate overtime hours (shifts > 8 hours)
    overtime_result = await db.execute(
        select(func.sum(
            func.greatest(
                (func.extract('epoch', Shift.end_time - Shift.start_time) / 3600) - 8,
                0
            )
        ))
        .select_from(ScheduleAssignment)
        .join(Shift, ScheduleAssignment.shift_id == Shift.id)
        .where(
            and_(
                ScheduleAssignment.status.in_(['assigned', 'confirmed', 'completed']),
                func.extract('epoch', Shift.end_time - Shift.start_time) / 3600 > 8
            )
        )
    )
    overtime_hours = overtime_result.scalar() or 0

    return {
        "totalEmployees": total_employees,
        "totalSchedules": total_schedules,
        "totalHours": round(total_hours, 2),
        "efficiency": round(efficiency, 2),
        "overtimeHours": round(overtime_hours, 2)
    }

@router.get("/labor-costs", response_model=LaborCostsResponse)
async def get_labor_costs(
    timeRange: str = Query("7d"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get labor costs for time range based on actual shift hours."""
    # Parse time range
    days = 7
    if timeRange == "30d" or timeRange == "30days":
        days = 30
    elif timeRange == "90d" or timeRange == "90days":
        days = 90

    # Calculate date range
    today = date.today()
    start_date = today - timedelta(days=days-1)

    # Assumed hourly rate (in a real system, this would come from employee records)
    HOURLY_RATE = 25.0

    # Query shifts grouped by date with total hours
    result = await db.execute(
        select(
            Shift.date,
            func.sum(func.extract('epoch', Shift.end_time - Shift.start_time) / 3600).label('total_hours')
        )
        .select_from(ScheduleAssignment)
        .join(Shift, ScheduleAssignment.shift_id == Shift.id)
        .where(
            and_(
                Shift.date >= start_date,
                Shift.date <= today,
                ScheduleAssignment.status.in_(['assigned', 'confirmed', 'completed'])
            )
        )
        .group_by(Shift.date)
        .order_by(Shift.date)
    )

    shifts_by_date = {row[0]: row[1] for row in result}

    # Build data array with all dates (fill missing dates with 0)
    data = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        hours = shifts_by_date.get(current_date, 0) or 0
        cost = hours * HOURLY_RATE

        data.append({
            "date": current_date.isoformat(),
            "cost": round(cost, 2),
            "hours": round(hours, 2)
        })

    total_cost = sum(d["cost"] for d in data)
    average_cost = total_cost / len(data) if data else 0

    return {
        "data": data,
        "total": round(total_cost, 2),
        "average": round(average_cost, 2)
    }

@router.get("/performance", response_model=PerformanceMetricsResponse)
async def get_performance_metrics(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get employee performance metrics based on assignment completion."""

    # Total assignments
    total_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
    ) or 1

    # Completed assignments
    completed_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
        .where(ScheduleAssignment.status == 'completed')
    ) or 0

    # Confirmed assignments (accepted their shifts)
    confirmed_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
        .where(ScheduleAssignment.status.in_(['confirmed', 'completed']))
    ) or 0

    # Calculate completion rate
    completion_rate = (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0

    # Calculate acceptance rate (as proxy for "rating")
    acceptance_rate = (confirmed_assignments / total_assignments * 100) if total_assignments > 0 else 0

    # Calculate punctuality (assignments that were completed vs declined)
    declined_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
        .where(ScheduleAssignment.status == 'declined')
    ) or 0

    punctuality = ((total_assignments - declined_assignments) / total_assignments * 100) if total_assignments > 0 else 100

    return {
        "averageRating": round(acceptance_rate / 20, 2),  # Convert to 1-5 scale
        "completionRate": round(completion_rate, 2),
        "punctuality": round(punctuality, 2)
    }

@router.get("/efficiency", response_model=EfficiencyMetricsResponse)
async def get_efficiency_metrics(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get schedule efficiency metrics based on staffing and assignments."""

    # Count total shifts
    total_shifts = await db.scalar(
        select(func.count(Shift.id))
    ) or 1

    # Count shifts with at least one assignment
    assigned_shifts = await db.scalar(
        select(func.count(func.distinct(ScheduleAssignment.shift_id)))
        .where(ScheduleAssignment.status.in_(['assigned', 'confirmed', 'completed']))
    ) or 0

    # Utilization rate: assigned shifts / total shifts
    utilization_rate = (assigned_shifts / total_shifts * 100) if total_shifts > 0 else 0

    # Scheduling accuracy: confirmed/completed assignments / total assignments
    total_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
    ) or 1

    accurate_assignments = await db.scalar(
        select(func.count(ScheduleAssignment.id))
        .where(ScheduleAssignment.status.in_(['confirmed', 'completed']))
    ) or 0

    scheduling_accuracy = (accurate_assignments / total_assignments * 100) if total_assignments > 0 else 0

    # Check if shifts meet required staffing levels
    fully_staffed_result = await db.execute(
        select(
            Shift.id,
            Shift.required_staff,
            func.count(ScheduleAssignment.id).label('assigned_count')
        )
        .outerjoin(
            ScheduleAssignment,
            and_(
                ScheduleAssignment.shift_id == Shift.id,
                ScheduleAssignment.status.in_(['assigned', 'confirmed', 'completed'])
            )
        )
        .group_by(Shift.id, Shift.required_staff)
    )

    shifts_data = list(fully_staffed_result)
    fully_staffed_count = sum(1 for shift in shifts_data if shift[2] >= shift[1])

    # Cost efficiency: fully staffed shifts / total shifts
    cost_efficiency = (fully_staffed_count / len(shifts_data) * 100) if shifts_data else 0

    return {
        "utilizationRate": round(utilization_rate, 2),
        "schedulingAccuracy": round(scheduling_accuracy, 2),
        "costEfficiency": round(cost_efficiency, 2)
    }
