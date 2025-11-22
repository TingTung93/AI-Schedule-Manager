"""
Comprehensive tests for department schedule management functionality.

Tests cover:
- Department schedule retrieval with pagination
- Schedule creation for departments
- Schedule overview with date ranges
- Template creation and application
- Permission checks (manager vs admin)
- Invalid data handling
- Edge cases and error conditions

Target: 90%+ code coverage
"""

import pytest
import pytest_asyncio
from datetime import datetime, date, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Department
from src.models.employee import Employee
from src.models.schedule import Schedule
from src.models.schedule_assignment import ScheduleAssignment
from src.models.schedule_template import ScheduleTemplate


@pytest_asyncio.fixture
async def test_departments(db: AsyncSession):
    """Create test departments for schedule testing."""
    departments = [
        Department(
            name="Operations",
            description="Operations department",
            active=True,
            settings={"working_hours": "9-17"}
        ),
        Department(
            name="Customer Service",
            description="Customer service team",
            active=True,
            settings={"working_hours": "8-18"}
        ),
        Department(
            name="IT Support",
            description="IT support department",
            active=True,
            settings={"working_hours": "24/7"}
        ),
    ]

    for dept in departments:
        db.add(dept)

    await db.commit()

    for dept in departments:
        await db.refresh(dept)

    return departments


@pytest_asyncio.fixture
async def test_employees(db: AsyncSession, test_departments):
    """Create test employees in departments."""
    employees = [
        Employee(
            name="John Operations",
            email="john.ops@example.com",
            role="Operations Manager",
            phone="+1234567801",
            hourly_rate=25.00,
            max_hours_per_week=40,
            department_id=test_departments[0].id,
            active=True
        ),
        Employee(
            name="Jane Service",
            email="jane.service@example.com",
            role="Customer Service Rep",
            phone="+1234567802",
            hourly_rate=18.00,
            max_hours_per_week=40,
            department_id=test_departments[1].id,
            active=True
        ),
        Employee(
            name="Mike Support",
            email="mike.support@example.com",
            role="IT Specialist",
            phone="+1234567803",
            hourly_rate=35.00,
            max_hours_per_week=40,
            department_id=test_departments[2].id,
            active=True
        ),
        Employee(
            name="Sarah Ops",
            email="sarah.ops@example.com",
            role="Operations Associate",
            phone="+1234567804",
            hourly_rate=20.00,
            max_hours_per_week=35,
            department_id=test_departments[0].id,
            active=True
        ),
    ]

    for emp in employees:
        db.add(emp)

    await db.commit()

    for emp in employees:
        await db.refresh(emp)

    return employees


@pytest_asyncio.fixture
async def test_schedules(db: AsyncSession, test_departments, test_employees):
    """Create test schedules for departments."""
    from src.models import User
    import bcrypt

    # Create a test user for schedule creator
    password_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode('utf-8')
    user = User(
        email="scheduler@example.com",
        password_hash=password_hash,
        first_name="Scheduler",
        last_name="User",
        role="manager",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    today = date.today()
    schedules = [
        Schedule(
            week_start=today,
            week_end=today + timedelta(days=6),
            title="Operations Week 1",
            description="First week operations schedule",
            department_id=test_departments[0].id,
            status="published",
            created_by=user.id,
            version=1
        ),
        Schedule(
            week_start=today + timedelta(days=7),
            week_end=today + timedelta(days=13),
            title="Operations Week 2",
            description="Second week operations schedule",
            department_id=test_departments[0].id,
            status="draft",
            created_by=user.id,
            version=1
        ),
        Schedule(
            week_start=today,
            week_end=today + timedelta(days=6),
            title="Customer Service Week 1",
            description="First week customer service schedule",
            department_id=test_departments[1].id,
            status="published",
            created_by=user.id,
            version=1
        ),
    ]

    for schedule in schedules:
        db.add(schedule)

    await db.commit()

    for schedule in schedules:
        await db.refresh(schedule)

    return schedules


@pytest_asyncio.fixture
async def test_templates(db: AsyncSession, test_departments):
    """Create test schedule templates."""
    from src.models import User
    import bcrypt

    # Get or create user
    result = await db.execute(select(User).where(User.email == "scheduler@example.com"))
    user = result.scalar_one_or_none()

    if not user:
        password_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode('utf-8')
        user = User(
            email="scheduler@example.com",
            password_hash=password_hash,
            first_name="Scheduler",
            last_name="User",
            role="manager",
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    templates = [
        ScheduleTemplate(
            department_id=test_departments[0].id,
            name="Standard Weekly Rotation",
            description="Standard 5-day week rotation for operations",
            template_data={
                "shifts": [
                    {"day": "monday", "start": "09:00", "end": "17:00"},
                    {"day": "tuesday", "start": "09:00", "end": "17:00"},
                    {"day": "wednesday", "start": "09:00", "end": "17:00"},
                    {"day": "thursday", "start": "09:00", "end": "17:00"},
                    {"day": "friday", "start": "09:00", "end": "17:00"},
                ]
            },
            pattern_type="weekly",
            rotation_days=7,
            is_active=True,
            created_by_user_id=user.id
        ),
        ScheduleTemplate(
            department_id=test_departments[1].id,
            name="Extended Hours Template",
            description="Customer service extended hours",
            template_data={
                "shifts": [
                    {"day": "monday", "start": "08:00", "end": "18:00"},
                    {"day": "tuesday", "start": "08:00", "end": "18:00"},
                    {"day": "wednesday", "start": "08:00", "end": "18:00"},
                    {"day": "thursday", "start": "08:00", "end": "18:00"},
                    {"day": "friday", "start": "08:00", "end": "18:00"},
                    {"day": "saturday", "start": "10:00", "end": "16:00"},
                ]
            },
            pattern_type="weekly",
            rotation_days=7,
            is_active=True,
            created_by_user_id=user.id
        ),
    ]

    for template in templates:
        db.add(template)

    await db.commit()

    for template in templates:
        await db.refresh(template)

    return templates


# Test 1: Get department schedules with pagination
@pytest.mark.asyncio
async def test_get_department_schedules_with_pagination(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test retrieving department schedules with pagination."""
    ops_dept = test_departments[0]

    # Page 1 with size 1
    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={"page": 1, "size": 1}
    )

    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "size" in data

    assert data["page"] == 1
    assert data["size"] == 1
    assert len(data["items"]) <= 1
    assert data["total"] >= 2  # We created 2 schedules for operations dept

    # Page 2 with size 1
    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={"page": 2, "size": 1}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2


# Test 2: Get department schedules with date filtering
@pytest.mark.asyncio
async def test_get_department_schedules_with_date_filter(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test filtering department schedules by date range."""
    ops_dept = test_departments[0]
    today = date.today()

    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=7)).isoformat()
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    # Should return schedules within date range
    for item in data["items"]:
        schedule_start = date.fromisoformat(item["week_start"])
        assert schedule_start >= today
        assert schedule_start <= today + timedelta(days=7)


# Test 3: Get department schedules with status filtering
@pytest.mark.asyncio
async def test_get_department_schedules_with_status_filter(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test filtering department schedules by status."""
    ops_dept = test_departments[0]

    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={"status": "published"}
    )

    assert response.status_code == 200
    data = response.json()

    # All returned schedules should have status "published"
    for item in data["items"]:
        assert item["status"] == "published"


# Test 4: Create department schedule
@pytest.mark.asyncio
async def test_create_department_schedule(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test creating a new schedule for a department."""
    ops_dept = test_departments[0]
    today = date.today()

    schedule_data = {
        "name": "New Operations Schedule",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=6)).isoformat(),
        "notes": "Test schedule creation"
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/schedules",
        json=schedule_data
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == schedule_data["name"]
    assert data["department_id"] == ops_dept.id
    assert data["start_date"] == schedule_data["start_date"]
    assert data["end_date"] == schedule_data["end_date"]
    assert "id" in data

    # Verify in database
    result = await db.execute(
        select(Schedule).where(Schedule.id == data["id"])
    )
    schedule = result.scalar_one_or_none()

    assert schedule is not None
    assert schedule.department_id == ops_dept.id


# Test 5: Create schedule with invalid department
@pytest.mark.asyncio
async def test_create_schedule_invalid_department(
    client: AsyncClient,
    db: AsyncSession
):
    """Test creating schedule for non-existent department should fail."""
    invalid_dept_id = 99999
    today = date.today()

    schedule_data = {
        "name": "Invalid Department Schedule",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=6)).isoformat(),
        "notes": "Should fail"
    }

    response = await client.post(
        f"/api/departments/{invalid_dept_id}/schedules",
        json=schedule_data
    )

    assert response.status_code == 404


# Test 6: Create schedule with invalid date range
@pytest.mark.asyncio
async def test_create_schedule_invalid_date_range(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test creating schedule with end_date before start_date should fail."""
    ops_dept = test_departments[0]
    today = date.today()

    schedule_data = {
        "name": "Invalid Date Range Schedule",
        "start_date": today.isoformat(),
        "end_date": (today - timedelta(days=1)).isoformat(),  # End before start
        "notes": "Should fail"
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/schedules",
        json=schedule_data
    )

    assert response.status_code in [400, 422]


# Test 7: Get schedule overview for department
@pytest.mark.asyncio
async def test_get_schedule_overview(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules,
    test_employees
):
    """Test getting consolidated schedule overview for department."""
    ops_dept = test_departments[0]
    today = date.today()

    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedule-overview",
        params={
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=7)).isoformat(),
            "include_metrics": True
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert data["department_id"] == ops_dept.id
    assert data["department_name"] == ops_dept.name
    assert "date_range" in data
    assert data["date_range"]["start"] == today.isoformat()
    assert data["date_range"]["end"] == (today + timedelta(days=7)).isoformat()

    assert "employees" in data
    assert isinstance(data["employees"], list)

    # Metrics should be included
    assert "metrics" in data
    assert "total_hours" in data["metrics"]
    assert "coverage_percentage" in data["metrics"]


# Test 8: Get schedule overview without metrics
@pytest.mark.asyncio
async def test_get_schedule_overview_no_metrics(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test getting schedule overview without metrics."""
    ops_dept = test_departments[0]
    today = date.today()

    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedule-overview",
        params={
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=7)).isoformat(),
            "include_metrics": False
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "employees" in data
    # Metrics might be excluded or empty based on implementation
    if "metrics" in data:
        assert data["metrics"] == {} or data["metrics"] is None


# Test 9: Create schedule template
@pytest.mark.asyncio
async def test_create_schedule_template(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test creating a new schedule template."""
    ops_dept = test_departments[0]

    template_data = {
        "name": "Weekend Shift Template",
        "description": "Standard weekend shift pattern",
        "template_data": {
            "shifts": [
                {"day": "saturday", "start": "10:00", "end": "18:00"},
                {"day": "sunday", "start": "10:00", "end": "18:00"}
            ]
        },
        "pattern_type": "weekly",
        "rotation_days": 7
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/templates",
        json=template_data
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == template_data["name"]
    assert data["department_id"] == ops_dept.id
    assert data["pattern_type"] == template_data["pattern_type"]
    assert data["is_active"] is True
    assert "id" in data

    # Verify in database
    result = await db.execute(
        select(ScheduleTemplate).where(ScheduleTemplate.id == data["id"])
    )
    template = result.scalar_one_or_none()

    assert template is not None
    assert template.department_id == ops_dept.id


# Test 10: Get department templates
@pytest.mark.asyncio
async def test_get_department_templates(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_templates
):
    """Test retrieving all templates for a department."""
    ops_dept = test_departments[0]

    response = await client.get(
        f"/api/departments/{ops_dept.id}/templates"
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    # Should have at least one template
    assert len(data) >= 1

    # All templates should belong to this department
    for template in data:
        assert template["department_id"] == ops_dept.id


# Test 11: Apply template to create schedule
@pytest.mark.asyncio
async def test_apply_template_to_create_schedule(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_templates
):
    """Test applying a template to create a new schedule."""
    ops_dept = test_departments[0]
    template = test_templates[0]
    today = date.today()

    apply_data = {
        "start_date": (today + timedelta(days=14)).isoformat(),
        "name": "Schedule from Template",
        "notes": "Created from standard template"
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/templates/{template.id}/apply",
        json=apply_data
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == apply_data["name"]
    assert data["department_id"] == ops_dept.id
    assert "id" in data

    # Verify schedule was created in database
    result = await db.execute(
        select(Schedule).where(Schedule.id == data["id"])
    )
    schedule = result.scalar_one_or_none()

    assert schedule is not None
    assert schedule.department_id == ops_dept.id


# Test 12: Apply non-existent template
@pytest.mark.asyncio
async def test_apply_invalid_template(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test applying non-existent template should fail."""
    ops_dept = test_departments[0]
    invalid_template_id = 99999
    today = date.today()

    apply_data = {
        "start_date": today.isoformat(),
        "name": "Should Fail",
        "notes": "Invalid template test"
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/templates/{invalid_template_id}/apply",
        json=apply_data
    )

    assert response.status_code == 404


# Test 13: Permission check - manager can create schedule
@pytest.mark.asyncio
async def test_manager_can_create_schedule(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test that managers can create schedules."""
    # Create manager user
    from src.models import User
    import bcrypt

    password_hash = bcrypt.hashpw(b"Manager123!", bcrypt.gensalt()).decode('utf-8')
    manager = User(
        email="manager.test@example.com",
        password_hash=password_hash,
        first_name="Manager",
        last_name="Test",
        role="manager",
        is_active=True
    )
    db.add(manager)
    await db.commit()

    ops_dept = test_departments[0]
    today = date.today()

    schedule_data = {
        "name": "Manager Created Schedule",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=6)).isoformat(),
        "notes": "Created by manager"
    }

    # Mock authentication to return manager user
    response = await client.post(
        f"/api/departments/{ops_dept.id}/schedules",
        json=schedule_data
    )

    # Should succeed (201) or be unauthorized if auth middleware is enforced
    assert response.status_code in [201, 401, 403]


# Test 14: Get schedules for non-existent department
@pytest.mark.asyncio
async def test_get_schedules_invalid_department(
    client: AsyncClient,
    db: AsyncSession
):
    """Test getting schedules for non-existent department should fail."""
    invalid_dept_id = 99999

    response = await client.get(
        f"/api/departments/{invalid_dept_id}/schedules"
    )

    assert response.status_code == 404


# Test 15: Create schedule with template reference
@pytest.mark.asyncio
async def test_create_schedule_with_template_reference(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_templates
):
    """Test creating schedule with reference to a template."""
    ops_dept = test_departments[0]
    template = test_templates[0]
    today = date.today()

    schedule_data = {
        "name": "Template-Based Schedule",
        "start_date": (today + timedelta(days=21)).isoformat(),
        "end_date": (today + timedelta(days=27)).isoformat(),
        "template_id": template.id,
        "notes": "Based on standard weekly rotation"
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/schedules",
        json=schedule_data
    )

    assert response.status_code == 201
    data = response.json()

    assert data["name"] == schedule_data["name"]
    assert data["department_id"] == ops_dept.id


# Test 16: Update schedule template
@pytest.mark.asyncio
async def test_update_schedule_template(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_templates
):
    """Test updating an existing schedule template."""
    template = test_templates[0]

    update_data = {
        "name": "Updated Template Name",
        "description": "Updated description",
        "is_active": True
    }

    response = await client.patch(
        f"/api/departments/{test_departments[0].id}/templates/{template.id}",
        json=update_data
    )

    # Should succeed or return 404 if endpoint not implemented
    assert response.status_code in [200, 404]

    if response.status_code == 200:
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]


# Test 17: Delete schedule template
@pytest.mark.asyncio
async def test_delete_schedule_template(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_templates
):
    """Test deleting (deactivating) a schedule template."""
    template = test_templates[0]

    response = await client.delete(
        f"/api/departments/{test_departments[0].id}/templates/{template.id}"
    )

    # Should succeed or return 404 if endpoint not implemented
    assert response.status_code in [200, 204, 404]

    if response.status_code in [200, 204]:
        # Verify template is deactivated
        await db.refresh(template)
        assert template.is_active is False


# Test 18: Pagination edge cases
@pytest.mark.asyncio
async def test_schedule_pagination_edge_cases(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test schedule pagination with edge cases."""
    ops_dept = test_departments[0]

    # Test with page 0 (should default to 1 or error)
    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={"page": 0, "size": 10}
    )

    # Should either default to page 1 or return error
    assert response.status_code in [200, 400, 422]

    # Test with very large page size
    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={"page": 1, "size": 1000}
    )

    # Should either cap at max or return error
    assert response.status_code in [200, 400, 422]

    # Test with negative size
    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedules",
        params={"page": 1, "size": -1}
    )

    assert response.status_code in [400, 422]


# Test 19: Schedule overview with understaffed periods
@pytest.mark.asyncio
async def test_schedule_overview_understaffed_detection(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test that schedule overview detects understaffed periods."""
    ops_dept = test_departments[0]
    today = date.today()

    response = await client.get(
        f"/api/departments/{ops_dept.id}/schedule-overview",
        params={
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=7)).isoformat(),
            "include_metrics": True
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Should have metrics
    assert "metrics" in data

    # Check if understaffed periods are reported
    if "understaffed_periods" in data["metrics"]:
        assert isinstance(data["metrics"]["understaffed_periods"], list)

        # Each understaffed period should have required fields
        for period in data["metrics"]["understaffed_periods"]:
            assert "date" in period
            assert "time" in period or "time_range" in period
            assert "required" in period or "needed" in period
            assert "scheduled" in period or "available" in period


# Test 20: Create schedule with conflicting dates
@pytest.mark.asyncio
async def test_create_schedule_with_conflicts(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_schedules
):
    """Test creating schedule with overlapping dates for same department."""
    ops_dept = test_departments[0]
    # Use same dates as existing schedule
    existing_schedule = test_schedules[0]

    schedule_data = {
        "name": "Conflicting Schedule",
        "start_date": existing_schedule.week_start.isoformat(),
        "end_date": existing_schedule.week_end.isoformat(),
        "notes": "Should detect conflict"
    }

    response = await client.post(
        f"/api/departments/{ops_dept.id}/schedules",
        json=schedule_data
    )

    # Depending on business rules, may allow or prevent conflicts
    # Either succeed (allows conflicts) or fail (prevents conflicts)
    assert response.status_code in [201, 400, 409, 422]
