"""
Integration tests for AI schedule generation and validation API endpoints.

Tests AI-powered schedule generation, validation workflows, conflict detection,
and schedule publishing.
"""

import pytest
from datetime import date, time, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.src.models import (
    Employee,
    Schedule,
    ScheduleAssignment,
    Shift,
    Department,
    Rule,
)


@pytest.fixture
async def test_department(db: AsyncSession) -> Department:
    """Create test department for generation tests."""
    department = Department(
        name="Operations Department",
        description="Main operations team"
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@pytest.fixture
async def test_employees(db: AsyncSession, test_department: Department) -> list[Employee]:
    """Create test employees with varying qualifications and availability."""
    employees = [
        Employee(
            name="Manager Alice",
            email="alice@test.com",
            role="manager",
            qualifications=["management", "customer_service", "cashier"],
            is_active=True,
            max_hours_per_week=40,
            min_hours_per_week=35,
            availability_pattern={
                "monday": [{"start": "08:00", "end": "18:00"}],
                "tuesday": [{"start": "08:00", "end": "18:00"}],
                "wednesday": [{"start": "08:00", "end": "18:00"}],
                "thursday": [{"start": "08:00", "end": "18:00"}],
                "friday": [{"start": "08:00", "end": "18:00"}],
                "saturday": [{"start": "10:00", "end": "16:00"}],
            },
            department_id=test_department.id,
        ),
        Employee(
            name="Server Bob",
            email="bob@test.com",
            role="server",
            qualifications=["customer_service", "cashier"],
            is_active=True,
            max_hours_per_week=35,
            min_hours_per_week=20,
            availability_pattern={
                "monday": [{"start": "09:00", "end": "17:00"}],
                "tuesday": [{"start": "09:00", "end": "17:00"}],
                "wednesday": [{"start": "09:00", "end": "17:00"}],
                "thursday": [{"start": "09:00", "end": "17:00"}],
                "friday": [{"start": "09:00", "end": "17:00"}],
            },
            department_id=test_department.id,
        ),
        Employee(
            name="Cashier Carol",
            email="carol@test.com",
            role="cashier",
            qualifications=["cashier", "customer_service"],
            is_active=True,
            max_hours_per_week=30,
            min_hours_per_week=15,
            availability_pattern={
                "monday": [{"start": "14:00", "end": "22:00"}],
                "tuesday": [{"start": "14:00", "end": "22:00"}],
                "wednesday": [{"start": "14:00", "end": "22:00"}],
                "thursday": [{"start": "14:00", "end": "22:00"}],
                "friday": [{"start": "14:00", "end": "22:00"}],
                "saturday": [{"start": "12:00", "end": "20:00"}],
                "sunday": [{"start": "12:00", "end": "20:00"}],
            },
            department_id=test_department.id,
        ),
        Employee(
            name="Part-time David",
            email="david@test.com",
            role="server",
            qualifications=["customer_service"],
            is_active=True,
            max_hours_per_week=20,
            min_hours_per_week=10,
            availability_pattern={
                "saturday": [{"start": "10:00", "end": "18:00"}],
                "sunday": [{"start": "10:00", "end": "18:00"}],
            },
            department_id=test_department.id,
        ),
    ]

    for emp in employees:
        db.add(emp)

    await db.commit()
    for emp in employees:
        await db.refresh(emp)

    return employees


@pytest.fixture
async def test_shift_templates(db: AsyncSession, test_department: Department) -> list[Shift]:
    """Create shift templates for generation."""
    # Create shifts for the entire week
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    shifts = []
    for day_offset in range(7):
        shift_date = week_start + timedelta(days=day_offset)

        # Morning shift
        shifts.append(
            Shift(
                name=f"Morning {shift_date.strftime('%A')}",
                shift_type="morning",
                date=shift_date,
                start_time=time(8, 0),
                end_time=time(16, 0),
                required_staff=2,
                required_qualifications=["customer_service"],
                active=True,
                department_id=test_department.id,
            )
        )

        # Evening shift
        shifts.append(
            Shift(
                name=f"Evening {shift_date.strftime('%A')}",
                shift_type="evening",
                date=shift_date,
                start_time=time(14, 0),
                end_time=time(22, 0),
                required_staff=1,
                required_qualifications=["customer_service"],
                active=True,
                department_id=test_department.id,
            )
        )

    for shift in shifts:
        db.add(shift)

    await db.commit()
    for shift in shifts:
        await db.refresh(shift)

    return shifts


@pytest.fixture
async def test_schedule(db: AsyncSession, test_employees: list[Employee]) -> Schedule:
    """Create empty test schedule for generation."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        title="AI Generated Schedule",
        status="draft",
        created_by=test_employees[0].id,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@pytest.mark.asyncio
async def test_ai_schedule_generation(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shift_templates: list[Shift],
    test_department: Department,
):
    """Test AI schedule generation endpoint."""
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/generate",
        json={
            "department_id": test_department.id,
            "date_from": test_schedule.week_start.isoformat(),
            "date_to": test_schedule.week_end.isoformat(),
            "employee_ids": [emp.id for emp in test_employees],
            "shift_template_ids": [shift.id for shift in test_shift_templates[:5]],
            "constraints": {
                "max_hours_per_week": 40,
                "min_rest_hours": 12,
                "max_consecutive_days": 5,
            },
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert "assignments" in data
    assert "conflicts" in data
    assert "coverage" in data
    assert "status" in data

    # Verify assignments were generated
    assert isinstance(data["assignments"], list)
    assert len(data["assignments"]) > 0

    # Verify coverage information
    assert "totalShifts" in data["coverage"]
    assert "coveredShifts" in data["coverage"]
    assert "coveragePercentage" in data["coverage"]

    # Check that generation status is valid
    assert data["status"] in ["optimal", "feasible", "infeasible"]


@pytest.mark.asyncio
async def test_schedule_generation_with_constraints(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shift_templates: list[Shift],
    test_department: Department,
):
    """Test schedule generation respects custom constraints."""
    # Add a constraint/rule for one employee
    rule = Rule(
        rule_type="availability",
        original_text="No weekends",
        constraints={
            "type": "availability",
            "days": ["saturday", "sunday"],
            "action": "restrict"
        },
        priority=5,
        active=True,
        employee_id=test_employees[1].id,
    )
    db.add(rule)
    await db.commit()

    response = await client.post(
        f"/api/schedules/{test_schedule.id}/generate",
        json={
            "department_id": test_department.id,
            "date_from": test_schedule.week_start.isoformat(),
            "date_to": test_schedule.week_end.isoformat(),
            "employee_ids": [emp.id for emp in test_employees],
            "constraints": {
                "respect_rules": True,
                "max_hours_per_week": 40,
            },
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Verify employee with weekend restriction isn't assigned weekends
    weekend_assignments = [
        a for a in data["assignments"]
        if a["employeeId"] == test_employees[1].id
        and any(
            day in ["saturday", "sunday"]
            for day in [a.get("shiftDate", "").lower()]
        )
    ]

    assert len(weekend_assignments) == 0, "Employee should not be assigned weekends"


@pytest.mark.asyncio
async def test_schedule_validation(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test schedule validation endpoint."""
    # Create some assignments
    assignments = [
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=test_employees[0].id,
            shift_id=test_shifts[0].id,
            status="assigned",
            priority=1,
        ),
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=test_employees[1].id,
            shift_id=test_shifts[1].id,
            status="assigned",
            priority=1,
        ),
    ]

    for assignment in assignments:
        db.add(assignment)

    await db.commit()

    # Validate schedule
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/validate",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Verify validation response
    assert "isValid" in data
    assert "conflicts" in data
    assert "warnings" in data
    assert "coverage" in data

    assert isinstance(data["isValid"], bool)
    assert isinstance(data["conflicts"], list)
    assert isinstance(data["warnings"], list)


@pytest.mark.asyncio
async def test_schedule_validation_with_conflicts(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shift_templates: list[Shift],
):
    """Test validation detects conflicts."""
    # Create conflicting assignments (same employee, overlapping times)
    employee = test_employees[0]

    # Find two overlapping shifts
    overlapping_shifts = [
        shift for shift in test_shift_templates
        if shift.start_time < time(17, 0)
    ][:2]

    assignments = [
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=employee.id,
            shift_id=overlapping_shifts[0].id,
            status="assigned",
            priority=1,
        ),
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=employee.id,
            shift_id=overlapping_shifts[1].id,
            status="assigned",
            priority=1,
        ),
    ]

    for assignment in assignments:
        db.add(assignment)

    await db.commit()

    # Validate schedule
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/validate",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Should detect conflicts
    assert data["isValid"] is False
    assert len(data["conflicts"]) > 0
    assert any("conflict" in str(conflict).lower() for conflict in data["conflicts"])


@pytest.mark.asyncio
async def test_publish_schedule(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test publishing a schedule."""
    # Schedule must be approved first
    test_schedule.status = "approved"
    test_schedule.approved_by = test_employees[0].id
    test_schedule.approved_at = date.today()
    await db.commit()

    # Publish schedule
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/publish",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "published"
    assert "publishedAt" in data
    assert data["publishedAt"] is not None

    # Verify in database
    await db.refresh(test_schedule)
    assert test_schedule.status == "published"
    assert test_schedule.published_at is not None


@pytest.mark.asyncio
async def test_publish_unapproved_schedule_fails(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
):
    """Test that unapproved schedule cannot be published."""
    # Schedule is in draft status
    assert test_schedule.status == "draft"

    # Try to publish
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/publish",
        headers=auth_headers,
    )

    # Should fail
    assert response.status_code == 400
    assert "approved" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_schedule_approval_workflow(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
):
    """Test schedule approval workflow."""
    # Submit for approval
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/submit-approval",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "pending_approval"

    # Approve schedule
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/approve",
        json={"notes": "Looks good"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "approved"
    assert "approvedBy" in data
    assert "approvedAt" in data


@pytest.mark.asyncio
async def test_schedule_rejection_workflow(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
):
    """Test schedule rejection workflow."""
    # Submit for approval
    test_schedule.status = "pending_approval"
    await db.commit()

    # Reject schedule
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/reject",
        json={"reason": "Insufficient coverage"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "rejected"
    assert "notes" in data
    assert "Insufficient coverage" in data["notes"]


@pytest.mark.asyncio
async def test_generate_schedule_with_optimization(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shift_templates: list[Shift],
    test_department: Department,
):
    """Test schedule generation with optimization objectives."""
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/generate",
        json={
            "department_id": test_department.id,
            "date_from": test_schedule.week_start.isoformat(),
            "date_to": test_schedule.week_end.isoformat(),
            "employee_ids": [emp.id for emp in test_employees],
            "optimization": {
                "objective": "balanced_hours",
                "preferences": {
                    "minimize_overtime": True,
                    "balance_workload": True,
                    "respect_preferences": True,
                },
            },
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Verify optimization results
    assert "status" in data
    assert data["status"] in ["optimal", "feasible"]

    # Check that hours are relatively balanced
    if "employeeHours" in data:
        hours = list(data["employeeHours"].values())
        if len(hours) > 1:
            max_hours = max(hours)
            min_hours = min(hours)
            # Hours should be reasonably balanced
            assert (max_hours - min_hours) <= 10


@pytest.mark.asyncio
async def test_schedule_coverage_report(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shift_templates: list[Shift],
):
    """Test getting schedule coverage report."""
    # Create some assignments
    assignments = [
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=test_employees[i % len(test_employees)].id,
            shift_id=test_shift_templates[i].id,
            status="assigned",
            priority=1,
        )
        for i in range(min(5, len(test_shift_templates)))
    ]

    for assignment in assignments:
        db.add(assignment)

    await db.commit()

    # Get coverage report
    response = await client.get(
        f"/api/schedules/{test_schedule.id}/coverage",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Verify coverage report structure
    assert "totalShifts" in data
    assert "coveredShifts" in data
    assert "uncoveredShifts" in data
    assert "coveragePercentage" in data
    assert "byDay" in data
    assert "byShiftType" in data

    assert isinstance(data["totalShifts"], int)
    assert isinstance(data["coveragePercentage"], (int, float))


@pytest.mark.asyncio
async def test_schedule_conflicts_report(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shift_templates: list[Shift],
):
    """Test getting detailed conflicts report."""
    # Create conflicting assignments
    employee = test_employees[0]

    assignments = [
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=employee.id,
            shift_id=test_shift_templates[0].id,
            status="assigned",
            priority=1,
        ),
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=employee.id,
            shift_id=test_shift_templates[1].id,
            status="assigned",
            priority=1,
        ),
    ]

    for assignment in assignments:
        db.add(assignment)

    await db.commit()

    # Get conflicts report
    response = await client.get(
        f"/api/schedules/{test_schedule.id}/conflicts",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Verify conflicts report structure
    assert "conflictCount" in data
    assert "conflicts" in data
    assert "byType" in data

    assert isinstance(data["conflicts"], list)

    if data["conflictCount"] > 0:
        # Verify conflict structure
        conflict = data["conflicts"][0]
        assert "type" in conflict
        assert "severity" in conflict
        assert "description" in conflict
