"""
Integration tests for schedule workflow.

Tests the complete schedule creation, assignment, conflict detection, and validation workflows.
"""

import pytest
from datetime import date, time, timedelta
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
from backend.src.services.schedule_service import schedule_service


@pytest.fixture
async def test_department(db: AsyncSession) -> Department:
    """Create test department."""
    department = Department(name="Test Department", description="Test")
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@pytest.fixture
async def test_employees(db: AsyncSession, test_department: Department) -> list[Employee]:
    """Create test employees with different roles and qualifications."""
    employees = [
        Employee(
            name="Alice Manager",
            email="alice@example.com",
            role="manager",
            qualifications=["management", "customer_service"],
            is_active=True,
            max_hours_per_week=40,
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
            name="Bob Server",
            email="bob@example.com",
            role="server",
            qualifications=["customer_service"],
            is_active=True,
            max_hours_per_week=35,
            availability_pattern={
                "monday": [{"start": "10:00", "end": "18:00"}],
                "tuesday": [{"start": "10:00", "end": "18:00"}],
                "wednesday": [{"start": "10:00", "end": "18:00"}],
                "thursday": [{"start": "10:00", "end": "18:00"}],
                "friday": [{"start": "10:00", "end": "18:00"}],
                "saturday": [{"start": "10:00", "end": "18:00"}],
            },
            department_id=test_department.id,
        ),
        Employee(
            name="Carol Cook",
            email="carol@example.com",
            role="cook",
            qualifications=["cooking", "food_safety"],
            is_active=True,
            max_hours_per_week=40,
            availability_pattern={
                "monday": [{"start": "06:00", "end": "14:00"}],
                "tuesday": [{"start": "06:00", "end": "14:00"}],
                "wednesday": [{"start": "06:00", "end": "14:00"}],
                "thursday": [{"start": "06:00", "end": "14:00"}],
                "friday": [{"start": "06:00", "end": "14:00"}],
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
async def test_shifts(db: AsyncSession, test_department: Department) -> list[Shift]:
    """Create test shift templates."""
    shifts = [
        Shift(
            name="Morning Shift",
            shift_type="morning",
            start_time=time(6, 0),
            end_time=time(14, 0),
            required_staff=1,
            required_qualifications=["cooking"],
            active=True,
            department_id=test_department.id,
        ),
        Shift(
            name="Afternoon Shift",
            shift_type="afternoon",
            start_time=time(10, 0),
            end_time=time(18, 0),
            required_staff=2,
            required_qualifications=["customer_service"],
            active=True,
            department_id=test_department.id,
        ),
        Shift(
            name="Evening Shift",
            shift_type="evening",
            start_time=time(14, 0),
            end_time=time(22, 0),
            required_staff=1,
            required_qualifications=["management"],
            active=True,
            department_id=test_department.id,
        ),
    ]

    for shift in shifts:
        db.add(shift)

    await db.commit()
    for shift in shifts:
        await db.refresh(shift)

    return shifts


@pytest.mark.asyncio
async def test_create_schedule_with_assignments(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test creating schedule with multiple assignments."""
    # Generate schedule for one week
    start_date = date.today()
    end_date = start_date + timedelta(days=6)

    result = await schedule_service.generate_schedule(db, start_date, end_date)

    # Verify schedule was created
    assert result["status"] in ["optimal", "feasible"], f"Schedule generation failed: {result.get('message')}"
    assert result["saved_assignments"] > 0, "No assignments were saved"

    # Verify assignments were created in database
    query = select(ScheduleAssignment)
    result_db = await db.execute(query)
    assignments = result_db.scalars().all()

    assert len(assignments) > 0, "No assignments found in database"
    assert assignments[0].schedule_id is not None, "Assignment not linked to schedule"
    assert assignments[0].employee_id is not None, "Assignment not linked to employee"
    assert assignments[0].shift_id is not None, "Assignment not linked to shift"


@pytest.mark.asyncio
async def test_schedule_with_qualifications(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test that employees are assigned to shifts matching their qualifications."""
    start_date = date.today()
    end_date = start_date + timedelta(days=2)

    result = await schedule_service.generate_schedule(db, start_date, end_date)

    assert result["status"] in ["optimal", "feasible"]

    # Check that assignments respect qualifications
    query = (
        select(ScheduleAssignment)
        .join(Employee, ScheduleAssignment.employee_id == Employee.id)
        .join(Shift, ScheduleAssignment.shift_id == Shift.id)
    )
    result_db = await db.execute(query)
    assignments = result_db.scalars().all()

    for assignment in assignments:
        # Load relationships if needed
        await db.refresh(assignment, ["employee", "shift"])

        shift = assignment.shift
        employee = assignment.employee

        # Check if employee has required qualifications
        if shift.required_qualifications:
            employee_quals = set(employee.qualifications or [])
            required_quals = set(shift.required_qualifications)

            assert required_quals.issubset(employee_quals), \
                f"Employee {employee.name} lacks required qualifications for shift {shift.name}"


@pytest.mark.asyncio
async def test_conflict_detection(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test conflict detection in schedule."""
    start_date = date.today()
    end_date = start_date + timedelta(days=6)

    # First, generate a schedule
    result = await schedule_service.generate_schedule(db, start_date, end_date)
    assert result["status"] in ["optimal", "feasible"]

    # Check for conflicts
    conflicts = await schedule_service.check_conflicts(db, start_date, end_date)

    assert "conflicts" in conflicts
    assert "conflict_count" in conflicts

    # A well-generated schedule should have no conflicts
    assert conflicts["conflict_count"] == 0, \
        f"Generated schedule has conflicts: {conflicts['conflicts']}"


@pytest.mark.asyncio
async def test_double_booking_detection(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test detection of double-booked employees."""
    employee = test_employees[0]
    shift_date = date.today()

    # Calculate week for this shift
    week_start = shift_date - timedelta(days=shift_date.weekday())
    week_end = week_start + timedelta(days=6)

    # Create schedule container
    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="draft",
        created_by=1,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Create two overlapping assignments for the same employee
    assignment1 = ScheduleAssignment(
        schedule_id=schedule.id,
        employee_id=employee.id,
        shift_id=test_shifts[1].id,  # Afternoon shift (10:00-18:00)
        status="assigned",
        priority=1,
    )

    assignment2 = ScheduleAssignment(
        schedule_id=schedule.id,
        employee_id=employee.id,
        shift_id=test_shifts[2].id,  # Evening shift (14:00-22:00)
        status="assigned",
        priority=1,
    )

    db.add(assignment1)
    db.add(assignment2)
    await db.commit()

    # Check for conflicts
    conflicts = await schedule_service.check_conflicts(db, shift_date, shift_date)

    # Should detect double booking
    assert conflicts["conflict_count"] > 0
    assert any(c["type"] == "double_booking" for c in conflicts["conflicts"])


@pytest.mark.asyncio
async def test_schedule_optimization(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test schedule optimization workflow."""
    start_date = date.today()
    end_date = start_date + timedelta(days=6)

    # Generate initial schedule
    result = await schedule_service.generate_schedule(db, start_date, end_date)
    assert result["status"] in ["optimal", "feasible"]

    # Get created schedule IDs
    query = select(Schedule).where(
        Schedule.week_start == start_date - timedelta(days=start_date.weekday())
    )
    result_db = await db.execute(query)
    schedules = result_db.scalars().all()
    schedule_ids = [s.id for s in schedules]

    # Optimize the schedule
    optimization_result = await schedule_service.optimize_schedule(db, schedule_ids)

    assert "status" in optimization_result
    assert optimization_result["status"] in ["optimal", "feasible"]

    if "improvements" in optimization_result:
        assert "total_assignments" in optimization_result["improvements"]
        assert "coverage_percentage" in optimization_result["improvements"]


@pytest.mark.asyncio
async def test_schedule_with_constraints(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test schedule generation with custom constraints."""
    # Create a rule/constraint
    rule = Rule(
        rule_type="availability",
        original_text="No morning shifts on Mondays",
        constraints={
            "type": "availability",
            "day": "monday",
            "shift_type": "morning",
            "action": "restrict"
        },
        priority=3,
        active=True,
        employee_id=test_employees[0].id,
    )
    db.add(rule)
    await db.commit()

    # Generate schedule
    start_date = date.today()
    end_date = start_date + timedelta(days=6)

    result = await schedule_service.generate_schedule(db, start_date, end_date)

    assert result["status"] in ["optimal", "feasible"]
    # Constraints should be considered during generation
    assert result["saved_assignments"] > 0


@pytest.mark.asyncio
async def test_schedule_status_transitions(db: AsyncSession):
    """Test schedule status transitions from draft to published."""
    # Create schedule
    schedule = Schedule(
        week_start=date.today(),
        week_end=date.today() + timedelta(days=6),
        status="draft",
        created_by=1,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Verify initial status
    assert schedule.status == "draft"

    # Update status to published
    schedule.status = "published"
    await db.commit()
    await db.refresh(schedule)

    assert schedule.status == "published"

    # Verify we can query by status
    query = select(Schedule).where(Schedule.status == "published")
    result = await db.execute(query)
    found_schedule = result.scalar_one_or_none()

    assert found_schedule is not None
    assert found_schedule.id == schedule.id


@pytest.mark.asyncio
async def test_assignment_status_workflow(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test assignment status transitions: assigned -> confirmed -> completed."""
    employee = test_employees[0]
    shift_date = date.today()
    week_start = shift_date - timedelta(days=shift_date.weekday())
    week_end = week_start + timedelta(days=6)

    # Create schedule and assignment
    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="draft",
        created_by=1,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    assignment = ScheduleAssignment(
        schedule_id=schedule.id,
        employee_id=employee.id,
        shift_id=test_shifts[0].id,
        status="assigned",
        priority=1,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    # Test status transitions
    assert assignment.status == "assigned"

    # Confirm assignment
    assignment.status = "confirmed"
    await db.commit()
    await db.refresh(assignment)
    assert assignment.status == "confirmed"

    # Complete assignment
    assignment.status = "completed"
    await db.commit()
    await db.refresh(assignment)
    assert assignment.status == "completed"


@pytest.mark.asyncio
async def test_multi_week_schedule_generation(
    db: AsyncSession, test_employees: list[Employee], test_shifts: list[Shift]
):
    """Test generating schedules spanning multiple weeks."""
    start_date = date.today()
    end_date = start_date + timedelta(days=20)  # ~3 weeks

    result = await schedule_service.generate_schedule(db, start_date, end_date)

    assert result["status"] in ["optimal", "feasible"]
    assert result["saved_assignments"] > 0

    # Verify multiple Schedule containers were created (one per week)
    query = select(Schedule)
    result_db = await db.execute(query)
    schedules = result_db.scalars().all()

    # Should have created 3 schedule containers (one per week)
    assert len(schedules) >= 3, "Should create separate Schedule container per week"
