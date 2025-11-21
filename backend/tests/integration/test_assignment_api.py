"""
Integration tests for schedule assignment API endpoints.

Tests assignment CRUD operations, bulk creation, conflict detection,
assignment confirmation, and validation workflows.
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
)


@pytest.fixture
async def test_department(db: AsyncSession) -> Department:
    """Create test department for assignments."""
    department = Department(
        name="Test Department",
        description="Integration test department"
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@pytest.fixture
async def test_employees(db: AsyncSession, test_department: Department) -> list[Employee]:
    """Create test employees with different availability."""
    employees = [
        Employee(
            name="Test Employee 1",
            email="emp1@test.com",
            role="employee",
            qualifications=["customer_service", "cashier"],
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
            name="Test Employee 2",
            email="emp2@test.com",
            role="employee",
            qualifications=["customer_service"],
            is_active=True,
            max_hours_per_week=35,
            availability_pattern={
                "monday": [{"start": "14:00", "end": "22:00"}],
                "tuesday": [{"start": "14:00", "end": "22:00"}],
                "wednesday": [{"start": "14:00", "end": "22:00"}],
                "thursday": [{"start": "14:00", "end": "22:00"}],
                "friday": [{"start": "14:00", "end": "22:00"}],
            },
            department_id=test_department.id,
        ),
        Employee(
            name="Test Employee 3",
            email="emp3@test.com",
            role="manager",
            qualifications=["management", "customer_service"],
            is_active=True,
            max_hours_per_week=40,
            availability_pattern={
                "monday": [{"start": "08:00", "end": "18:00"}],
                "tuesday": [{"start": "08:00", "end": "18:00"}],
                "wednesday": [{"start": "08:00", "end": "18:00"}],
                "thursday": [{"start": "08:00", "end": "18:00"}],
                "friday": [{"start": "08:00", "end": "18:00"}],
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
    today = date.today()
    shifts = [
        Shift(
            name="Morning Shift",
            shift_type="morning",
            date=today,
            start_time=time(9, 0),
            end_time=time(17, 0),
            required_staff=1,
            required_qualifications=["customer_service"],
            active=True,
            department_id=test_department.id,
        ),
        Shift(
            name="Afternoon Shift",
            shift_type="afternoon",
            date=today,
            start_time=time(14, 0),
            end_time=time(22, 0),
            required_staff=1,
            required_qualifications=["customer_service"],
            active=True,
            department_id=test_department.id,
        ),
        Shift(
            name="Evening Shift",
            shift_type="evening",
            date=today + timedelta(days=1),
            start_time=time(17, 0),
            end_time=time(23, 0),
            required_staff=1,
            required_qualifications=["customer_service"],
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


@pytest.fixture
async def test_schedule(db: AsyncSession, test_employees: list[Employee]) -> Schedule:
    """Create test schedule."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        title="Test Schedule",
        status="draft",
        created_by=test_employees[0].id,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@pytest.mark.asyncio
async def test_create_assignment(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test creating a schedule assignment via API."""
    response = await client.post(
        f"/api/schedules/{test_schedule.id}/assignments",
        json={
            "employee_id": test_employees[0].id,
            "shift_id": test_shifts[0].id,
            "status": "assigned",
            "priority": 1,
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()

    # Verify response structure
    assert data["employeeId"] == test_employees[0].id
    assert data["shiftId"] == test_shifts[0].id
    assert data["status"] == "assigned"
    assert data["scheduleId"] == test_schedule.id

    # Verify in database
    query = select(ScheduleAssignment).where(ScheduleAssignment.id == data["id"])
    result = await db.execute(query)
    assignment = result.scalar_one_or_none()

    assert assignment is not None
    assert assignment.employee_id == test_employees[0].id
    assert assignment.shift_id == test_shifts[0].id


@pytest.mark.asyncio
async def test_get_assignments_for_schedule(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test getting all assignments for a schedule."""
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

    # Get assignments via API
    response = await client.get(
        f"/api/schedules/{test_schedule.id}/assignments",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert all("employeeId" in item for item in data)
    assert all("shiftId" in item for item in data)


@pytest.mark.asyncio
async def test_bulk_create_assignments(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test bulk assignment creation."""
    response = await client.post(
        "/api/assignments/bulk",
        json={
            "schedule_id": test_schedule.id,
            "assignments": [
                {
                    "employee_id": test_employees[0].id,
                    "shift_id": test_shifts[0].id,
                    "priority": 1,
                },
                {
                    "employee_id": test_employees[1].id,
                    "shift_id": test_shifts[1].id,
                    "priority": 1,
                },
                {
                    "employee_id": test_employees[2].id,
                    "shift_id": test_shifts[2].id,
                    "priority": 1,
                },
            ],
            "validate_conflicts": True,
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()

    # Verify bulk creation response
    assert "totalCreated" in data
    assert "created" in data
    assert "errors" in data

    assert data["totalCreated"] == 3
    assert len(data["created"]) == 3
    assert len(data["errors"]) == 0

    # Verify in database
    query = select(ScheduleAssignment).where(
        ScheduleAssignment.schedule_id == test_schedule.id
    )
    result = await db.execute(query)
    assignments = result.scalars().all()

    assert len(assignments) == 3


@pytest.mark.asyncio
async def test_bulk_create_with_conflicts(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test bulk assignment creation with conflict validation."""
    # Create assignments that will conflict (same employee, overlapping shifts)
    response = await client.post(
        "/api/assignments/bulk",
        json={
            "schedule_id": test_schedule.id,
            "assignments": [
                {
                    "employee_id": test_employees[0].id,
                    "shift_id": test_shifts[0].id,  # 9am-5pm
                    "priority": 1,
                },
                {
                    "employee_id": test_employees[0].id,  # Same employee
                    "shift_id": test_shifts[1].id,  # 2pm-10pm (overlaps)
                    "priority": 1,
                },
            ],
            "validate_conflicts": True,
        },
        headers=auth_headers,
    )

    # Should return 400 or partial success with errors
    assert response.status_code in [201, 400]
    data = response.json()

    if response.status_code == 201:
        # Partial success - one created, one errored
        assert data["totalCreated"] < 2
        assert len(data["errors"]) > 0
        assert any("conflict" in error.lower() for error in data["errors"])
    else:
        # Complete failure
        assert "conflict" in data["detail"].lower()


@pytest.mark.asyncio
async def test_conflict_detection(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test that conflicting assignments are detected."""
    # Create first assignment
    response1 = await client.post(
        f"/api/schedules/{test_schedule.id}/assignments",
        json={
            "employee_id": test_employees[0].id,
            "shift_id": test_shifts[0].id,  # Morning shift 9-5
            "status": "assigned",
        },
        headers=auth_headers,
    )

    assert response1.status_code == 201

    # Try to create conflicting assignment (overlapping time)
    response2 = await client.post(
        f"/api/schedules/{test_schedule.id}/assignments",
        json={
            "employee_id": test_employees[0].id,  # Same employee
            "shift_id": test_shifts[1].id,  # Afternoon shift 2-10 (overlaps)
            "status": "assigned",
        },
        headers=auth_headers,
    )

    # Should be rejected due to conflict
    assert response2.status_code == 400
    assert "conflict" in response2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_assignment_confirmation(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test employee confirming assignment."""
    # Create assignment
    assignment = ScheduleAssignment(
        schedule_id=test_schedule.id,
        employee_id=test_employees[0].id,
        shift_id=test_shifts[0].id,
        status="assigned",
        priority=1,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    # Confirm assignment
    response = await client.post(
        f"/api/assignments/{assignment.id}/confirm",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "confirmed"

    # Verify in database
    await db.refresh(assignment)
    assert assignment.status == "confirmed"


@pytest.mark.asyncio
async def test_assignment_decline(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test employee declining assignment."""
    # Create assignment
    assignment = ScheduleAssignment(
        schedule_id=test_schedule.id,
        employee_id=test_employees[0].id,
        shift_id=test_shifts[0].id,
        status="assigned",
        priority=1,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    # Decline assignment
    response = await client.post(
        f"/api/assignments/{assignment.id}/decline",
        json={"reason": "Personal conflict"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "declined"

    # Verify in database
    await db.refresh(assignment)
    assert assignment.status == "declined"


@pytest.mark.asyncio
async def test_update_assignment(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test updating an assignment."""
    # Create assignment
    assignment = ScheduleAssignment(
        schedule_id=test_schedule.id,
        employee_id=test_employees[0].id,
        shift_id=test_shifts[0].id,
        status="assigned",
        priority=1,
        notes="Initial notes",
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    # Update assignment
    response = await client.put(
        f"/api/assignments/{assignment.id}",
        json={
            "priority": 5,
            "notes": "Updated notes",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["priority"] == 5
    assert data["notes"] == "Updated notes"

    # Verify in database
    await db.refresh(assignment)
    assert assignment.priority == 5
    assert assignment.notes == "Updated notes"


@pytest.mark.asyncio
async def test_delete_assignment(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test deleting an assignment."""
    # Create assignment
    assignment = ScheduleAssignment(
        schedule_id=test_schedule.id,
        employee_id=test_employees[0].id,
        shift_id=test_shifts[0].id,
        status="assigned",
        priority=1,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    assignment_id = assignment.id

    # Delete assignment
    response = await client.delete(
        f"/api/assignments/{assignment_id}",
        headers=auth_headers,
    )

    assert response.status_code == 204

    # Verify deleted from database
    query = select(ScheduleAssignment).where(
        ScheduleAssignment.id == assignment_id
    )
    result = await db.execute(query)
    deleted_assignment = result.scalar_one_or_none()

    assert deleted_assignment is None


@pytest.mark.asyncio
async def test_get_employee_assignments(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test getting all assignments for a specific employee."""
    # Create multiple assignments for one employee
    employee = test_employees[0]

    assignments = [
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=employee.id,
            shift_id=test_shifts[0].id,
            status="assigned",
            priority=1,
        ),
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=employee.id,
            shift_id=test_shifts[2].id,
            status="confirmed",
            priority=1,
        ),
    ]

    for assignment in assignments:
        db.add(assignment)

    await db.commit()

    # Get employee assignments
    response = await client.get(
        f"/api/employees/{employee.id}/assignments",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert all(item["employeeId"] == employee.id for item in data)


@pytest.mark.asyncio
async def test_assignment_status_filtering(
    client: AsyncClient,
    db: AsyncSession,
    auth_headers: dict,
    test_schedule: Schedule,
    test_employees: list[Employee],
    test_shifts: list[Shift],
):
    """Test filtering assignments by status."""
    # Create assignments with different statuses
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
            status="confirmed",
            priority=1,
        ),
        ScheduleAssignment(
            schedule_id=test_schedule.id,
            employee_id=test_employees[2].id,
            shift_id=test_shifts[2].id,
            status="declined",
            priority=1,
        ),
    ]

    for assignment in assignments:
        db.add(assignment)

    await db.commit()

    # Filter by 'confirmed' status
    response = await client.get(
        f"/api/schedules/{test_schedule.id}/assignments?status=confirmed",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 1
    assert data[0]["status"] == "confirmed"
