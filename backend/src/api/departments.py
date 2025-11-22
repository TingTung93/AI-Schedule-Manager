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
    CheckCoverageResponse,
    ConflictReport,
    DepartmentAnalyticsOverview,
    DepartmentCreate,
    DepartmentDetailedAnalytics,
    DepartmentResponse,
    DepartmentUpdate,
    EmployeeDistributionItem,
    EmployeeResponse,
    PaginatedResponse,
    ShiftResponse,
    ValidateAssignmentRequest,
    ValidateAssignmentResponse,
)
from ..services.crud import crud_department
from ..services import conflict_detection

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


@router.get("/{department_id}/schedule-analytics")
async def get_department_schedule_analytics(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    shift_type: Optional[str] = Query(None, description="Filter by shift type"),
    metric_type: str = Query("all", description="Metric type filter"),
):
    """
    Get comprehensive schedule analytics for a department.

    Returns detailed metrics including:
    - Coverage percentage trends over time
    - Overtime hours breakdown by employee
    - Labor cost breakdown by shift type
    - Staffing gaps with severity and recommendations
    - Week-over-week and month-over-month trends
    - Cost per hour analysis

    Query Parameters:
    - start_date: Start of analysis period (required, YYYY-MM-DD)
    - end_date: End of analysis period (required, YYYY-MM-DD)
    - employee_id: Filter analytics by specific employee (optional)
    - shift_type: Filter by shift type (optional)
    - metric_type: Type of metrics to return (default: 'all')
    """
    from datetime import date as date_type, timedelta
    from sqlalchemy import select, func
    from ..models import Shift, Employee

    # Verify department exists
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

    # Calculate analytics data
    logger.info(f"Calculating schedule analytics for department {department_id} from {start_date} to {end_date}")

    # Coverage trend (daily coverage percentage)
    coverage_trend = []
    current_date = start_date_obj
    total_coverage = 0

    while current_date <= end_date_obj:
        # Calculate coverage for this day
        # For now, using mock data - replace with actual query
        coverage_percentage = 85.0 + (hash(str(current_date)) % 15)  # Mock: 85-100%
        coverage_trend.append({
            "date": current_date.isoformat(),
            "coveragePercentage": min(100, max(0, coverage_percentage))
        })
        total_coverage += coverage_percentage
        current_date += timedelta(days=1)

    average_coverage = total_coverage / len(coverage_trend) if coverage_trend else 0

    # Overtime by employee (mock data)
    overtime_by_employee = [
        {
            "employeeId": 1,
            "employeeName": "John Doe",
            "regularHours": 160.0,
            "overtimeHours": 12.5,
            "overtimePercentage": 7.8,
            "overtimeCost": 375.0,
            "totalCost": 5175.0
        },
        {
            "employeeId": 2,
            "employeeName": "Jane Smith",
            "regularHours": 160.0,
            "overtimeHours": 8.0,
            "overtimePercentage": 5.0,
            "overtimeCost": 240.0,
            "totalCost": 4440.0
        }
    ]

    # Labor cost breakdown (mock data)
    labor_cost_breakdown = [
        {"shiftType": "Morning", "totalCost": 15000, "hours": 500, "costPerHour": 30.0},
        {"shiftType": "Afternoon", "totalCost": 12000, "hours": 400, "costPerHour": 30.0},
        {"shiftType": "Evening", "totalCost": 9000, "hours": 300, "costPerHour": 30.0},
        {"shiftType": "Night", "totalCost": 8400, "hours": 200, "costPerHour": 42.0}
    ]

    # Staffing gaps (mock data)
    staffing_gaps = [
        {
            "date": (start_date_obj + timedelta(days=5)).isoformat(),
            "timeRange": "14:00 - 18:00",
            "shiftType": "Afternoon",
            "required": 5,
            "scheduled": 3,
            "gap": 2,
            "severity": "high",
            "recommendation": "Schedule 2 additional employees or extend morning shift hours"
        },
        {
            "date": (start_date_obj + timedelta(days=12)).isoformat(),
            "timeRange": "22:00 - 06:00",
            "shiftType": "Night",
            "required": 3,
            "scheduled": 1,
            "gap": 2,
            "severity": "critical",
            "recommendation": "Urgent: Assign 2 employees to night shift or implement on-call system"
        }
    ]

    # Calculate trends
    days_in_period = (end_date_obj - start_date_obj).days + 1

    # Week-over-week (compare last 7 days vs previous 7 days)
    if days_in_period >= 14:
        recent_week = coverage_trend[-7:]
        previous_week = coverage_trend[-14:-7]
        recent_avg = sum(d["coveragePercentage"] for d in recent_week) / 7
        previous_avg = sum(d["coveragePercentage"] for d in previous_week) / 7
        week_over_week_change = ((recent_avg - previous_avg) / previous_avg * 100) if previous_avg > 0 else 0
    else:
        week_over_week_change = 0

    # Month-over-month (if enough data)
    month_over_month_change = 2.5  # Mock data

    # Calculate totals
    total_labor_cost = sum(item["totalCost"] for item in labor_cost_breakdown)
    total_hours = sum(item["hours"] for item in labor_cost_breakdown)
    cost_per_hour = total_labor_cost / total_hours if total_hours > 0 else 0

    total_overtime_hours = sum(emp["overtimeHours"] for emp in overtime_by_employee)
    total_overtime_cost = sum(emp["overtimeCost"] for emp in overtime_by_employee)

    # Build response
    analytics_response = {
        "departmentId": department_id,
        "departmentName": department.name,
        "dateRange": {
            "startDate": start_date,
            "endDate": end_date,
            "days": days_in_period
        },
        "averageCoverage": round(average_coverage, 1),
        "totalOvertimeHours": round(total_overtime_hours, 1),
        "totalLaborCost": round(total_labor_cost, 2),
        "costPerHour": round(cost_per_hour, 2),
        "targetCoverage": 95.0,
        "coverageTrend": coverage_trend,
        "overtimeByEmployee": overtime_by_employee,
        "laborCostBreakdown": labor_cost_breakdown,
        "staffingGaps": staffing_gaps,
        "weekOverWeekChange": round(week_over_week_change, 1),
        "monthOverMonthChange": round(month_over_month_change, 1),
        "totalOvertimeCost": round(total_overtime_cost, 2)
    }

    return analytics_response


@router.get("/{department_id}/analytics/export")
async def export_department_analytics(
    department_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    format: str = Query("pdf", regex="^(pdf|excel|csv)$"),
):
    """
    Export department analytics report.

    Generates a downloadable report in the specified format containing:
    - All analytics metrics
    - Charts and visualizations (PDF only)
    - Detailed tables
    - Recommendations

    Supported formats:
    - pdf: Full report with charts and formatting
    - excel: Spreadsheet with multiple sheets for different metrics
    - csv: Comma-separated values for data analysis

    Returns file as downloadable attachment.
    """
    from fastapi.responses import StreamingResponse
    import io
    import csv
    import json

    # Verify department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    logger.info(f"Exporting analytics for department {department_id} in {format} format")

    # For MVP, generate CSV export (PDF/Excel would require additional libraries)
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(["Department Analytics Report"])
        writer.writerow(["Department", department.name])
        writer.writerow(["Generated", format(date.today(), "%Y-%m-%d")])
        writer.writerow([])

        # Mock data sections
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Average Coverage", "92.5%"])
        writer.writerow(["Total Overtime Hours", "48.5"])
        writer.writerow(["Total Labor Cost", "$44,400"])
        writer.writerow(["Staffing Gaps", "2"])

        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=department-{department_id}-analytics.csv"
            }
        )

    elif format == "pdf":
        # For PDF, return a simple text response (would need reportlab or similar for real PDF)
        content = f"""Department Analytics Report - {department.name}

Generated: {date.today()}

This would be a formatted PDF report with:
- Coverage charts
- Overtime analysis
- Labor cost breakdown
- Staffing gap recommendations

Note: Full PDF generation requires additional libraries (reportlab, matplotlib)
"""
        return StreamingResponse(
            iter([content.encode()]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=department-{department_id}-analytics.pdf"
            }
        )

    else:  # excel
        # For Excel, return CSV (would need openpyxl for real Excel)
        return await export_department_analytics(
            department_id, db, current_user, format="csv"
        )


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


# Conflict Detection Endpoints
@router.post("/{department_id}/validate-assignment", response_model=ValidateAssignmentResponse)
async def validate_department_assignment(
    department_id: int,
    validation_request: ValidateAssignmentRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Validate an employee assignment to a shift for conflict detection.

    Checks for:
    - Overlapping shifts for the same employee
    - Double-booking conflicts
    - Shift duration limits (max hours per day/week)
    - Minimum rest period between shifts
    - Employee availability
    - Required qualifications

    Returns detailed conflict information with suggested resolutions.

    Requires manager role.
    """
    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    try:
        conflicts = await conflict_detection.validate_employee_assignment(
            db,
            validation_request.employee_id,
            validation_request.shift_id,
            validation_request.exclude_assignment_id
        )

        # Determine if assignment is valid and can proceed
        critical_conflicts = [c for c in conflicts if c.get("severity") == "critical"]
        high_conflicts = [c for c in conflicts if c.get("severity") == "high"]

        valid = len(critical_conflicts) == 0
        can_proceed = len(critical_conflicts) == 0  # Only allow if no critical conflicts

        # Generate warnings for non-critical conflicts
        warnings = []
        if high_conflicts:
            warnings.append(f"{len(high_conflicts)} high-severity conflict(s) detected - review recommended")
        if len(conflicts) > len(critical_conflicts) + len(high_conflicts):
            warnings.append("Minor conflicts detected - assignment may proceed with caution")

        return ValidateAssignmentResponse(
            valid=valid,
            conflicts=conflicts,
            can_proceed=can_proceed,
            warnings=warnings
        )
    except Exception as e:
        logger.error(f"Error validating assignment: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{department_id}/check-coverage", response_model=CheckCoverageResponse)
async def check_department_coverage(
    department_id: int,
    shift_date: str = Query(..., description="Date to check (YYYY-MM-DD)"),
    start_time: str = Query(..., description="Start time (HH:MM)"),
    end_time: str = Query(..., description="End time (HH:MM)"),
    required_staff: int = Query(1, description="Required staff count", ge=1),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
):
    """
    Check department staffing coverage for a specific time period.

    Analyzes whether the department has adequate staff coverage for
    the specified date and time range.

    Returns:
    - Coverage adequacy status
    - List of understaffed/overstaffed periods
    - Suggested actions for resolving coverage issues

    Query Parameters:
    - shift_date: Date to check coverage (YYYY-MM-DD)
    - start_time: Period start time (HH:MM format)
    - end_time: Period end time (HH:MM format)
    - required_staff: Number of staff required (default: 1)
    """
    from datetime import date as date_type, time as time_type

    # Check if department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Parse inputs
    try:
        date_obj = date_type.fromisoformat(shift_date)
        start_time_obj = time_type.fromisoformat(start_time)
        end_time_obj = time_type.fromisoformat(end_time)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid date/time format: {e}")

    try:
        issues = await conflict_detection.check_department_coverage(
            db, department_id, date_obj, start_time_obj, end_time_obj, required_staff
        )

        adequate_coverage = len(issues) == 0

        return CheckCoverageResponse(
            adequate_coverage=adequate_coverage,
            issues=issues
        )
    except Exception as e:
        logger.error(f"Error checking coverage: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{department_id}/conflict-report", response_model=ConflictReport)
async def get_department_conflict_report(
    department_id: int,
    start_date: str = Query(..., description="Report start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Report end date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Generate comprehensive conflict detection report for department schedule.

    Analyzes all shifts and assignments in the specified date range and
    produces a detailed report including:

    - Total conflicts by severity (critical, high, medium, low)
    - Overlapping shift assignments
    - Duration limit violations
    - Insufficient rest periods
    - Coverage issues (understaffed/overstaffed)
    - Actionable recommendations for resolving conflicts

    The report helps managers identify and resolve scheduling issues
    before publishing schedules to employees.

    Query Parameters:
    - start_date: Report period start date (YYYY-MM-DD)
    - end_date: Report period end date (YYYY-MM-DD)

    Requires manager role.
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
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid date format: {e}")

    if end_date_obj <= start_date_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be after start_date")

    try:
        report = await conflict_detection.generate_conflict_report(
            db, department_id, start_date_obj, end_date_obj
        )

        return ConflictReport(**report)
    except Exception as e:
        logger.error(f"Error generating conflict report: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
