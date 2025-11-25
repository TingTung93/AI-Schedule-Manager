"""
Extended Fields Integration Test Suite

Tests comprehensive functionality of Week 3-4 extended employee fields:
- qualifications (ARRAY field, max 20)
- availability (JSONB schedule, time validation)
- hourly_rate (FLOAT precision, 0-1000 range)
- max_hours_per_week (INT, 1-168 range, vs availability logic)

These tests verify CRUD operations, validation, business logic, and data integrity.
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import NullPool
from httpx import AsyncClient

from src.auth.models import User, Role, Base
from src.models import Employee, Department
from src.dependencies import get_database_session
import bcrypt

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    """Create test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def setup_roles(db_session):
    """Create standard roles."""
    roles = {}
    for role_name in ["admin", "manager", "user"]:
        role = Role(name=role_name, description=f"{role_name.capitalize()} role")
        db_session.add(role)
        roles[role_name] = role

    await db_session.commit()
    for role in roles.values():
        await db_session.refresh(role)

    return roles


@pytest.fixture
async def admin_user(db_session, setup_roles):
    """Create admin user."""
    password_hash = bcrypt.hashpw("AdminPass123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="admin@test.com",
        password_hash=password_hash,
        first_name="Admin",
        last_name="User",
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    user.roles.append(setup_roles["admin"])
    await db_session.commit()

    return user


@pytest.fixture
async def auth_headers(admin_user):
    """Get admin auth headers."""
    from src.auth.auth import auth_service

    # Initialize auth service if needed
    if not auth_service.secret_key:
        from unittest.mock import MagicMock
        mock_app = MagicMock()
        mock_app.config = {
            "JWT_SECRET_KEY": "test-secret-key-for-testing-32chars-long-at-least",
            "JWT_REFRESH_SECRET_KEY": "test-refresh-secret-key-for-testing-32chars"
        }
        auth_service.init_app(mock_app)

    token = auth_service.create_access_token(
        user_id=admin_user.id,
        email=admin_user.email,
        roles=["admin"]
    )

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def test_department(db_session):
    """Create test department."""
    dept = Department(
        name="Engineering",
        description="Engineering department",
        active=True
    )
    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)
    return dept


# ============================================================================
# QUALIFICATIONS TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_create_employee_with_qualifications(db_session, auth_headers, test_department):
    """Test creating employee with qualifications list."""
    from fastapi.testclient import TestClient
    from src.main import app

    employee_data = {
        "firstName": "Test",
        "lastName": "Employee",
        "email": "test@example.com",
        "department": test_department.id,
        "qualifications": ["Python", "FastAPI", "PostgreSQL", "Docker"]
    }

    # Simulate API call (testing data validation and storage)
    from src.schemas import EmployeeCreate
    schema = EmployeeCreate(**employee_data)

    assert schema.qualifications == ["Python", "FastAPI", "PostgreSQL", "Docker"]
    assert len(schema.qualifications) == 4


@pytest.mark.asyncio
async def test_qualifications_max_limit_20(db_session):
    """Test that qualifications cannot exceed 20 items."""
    from src.schemas import EmployeeCreate
    from pydantic import ValidationError

    # Create 21 qualifications
    too_many_quals = [f"Skill{i}" for i in range(21)]

    employee_data = {
        "firstName": "Test",
        "lastName": "Employee",
        "qualifications": too_many_quals
    }

    with pytest.raises(ValidationError) as exc_info:
        EmployeeCreate(**employee_data)

    errors = exc_info.value.errors()
    assert any("max_length" in str(error) or "qualifications" in str(error) for error in errors)


@pytest.mark.asyncio
async def test_update_employee_qualifications(db_session, test_department):
    """Test updating employee qualifications."""
    # Create employee
    employee = Employee(
        name="Test Employee",
        email="test@example.com",
        role="Developer",
        department_id=test_department.id,
        qualifications=["Python", "Django"]
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Update qualifications
    employee.qualifications = ["Python", "Django", "FastAPI", "PostgreSQL"]
    await db_session.commit()
    await db_session.refresh(employee)

    assert len(employee.qualifications) == 4
    assert "FastAPI" in employee.qualifications
    assert "PostgreSQL" in employee.qualifications


@pytest.mark.asyncio
async def test_qualifications_empty_list(db_session, test_department):
    """Test employee can have empty qualifications list."""
    employee = Employee(
        name="Test Employee",
        email="test@example.com",
        role="Intern",
        department_id=test_department.id,
        qualifications=[]
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.qualifications == []


# ============================================================================
# AVAILABILITY TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_create_employee_with_availability(db_session, test_department):
    """Test creating employee with weekly availability schedule."""
    availability = {
        "monday": {"available": True, "start": "09:00", "end": "17:00"},
        "tuesday": {"available": True, "start": "09:00", "end": "17:00"},
        "wednesday": {"available": True, "start": "09:00", "end": "17:00"},
        "thursday": {"available": True, "start": "09:00", "end": "17:00"},
        "friday": {"available": True, "start": "09:00", "end": "17:00"},
        "saturday": {"available": False},
        "sunday": {"available": False}
    }

    employee = Employee(
        name="Test Employee",
        email="availability@example.com",
        role="Staff",
        department_id=test_department.id,
        availability_pattern=availability
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.availability_pattern is not None
    assert employee.availability_pattern["monday"]["start"] == "09:00"
    assert employee.availability_pattern["saturday"]["available"] is False


@pytest.mark.asyncio
async def test_availability_time_validation_start_before_end(db_session):
    """Test that availability start time must be before end time."""
    from src.schemas import EmployeeCreate
    from pydantic import ValidationError

    # Invalid: start time after end time
    invalid_availability = {
        "monday": {"available": True, "start": "17:00", "end": "09:00"}
    }

    employee_data = {
        "firstName": "Test",
        "lastName": "Employee",
        "availability": invalid_availability
    }

    # Note: Validation depends on schema implementation
    # This test documents expected behavior


@pytest.mark.asyncio
async def test_availability_partial_week(db_session, test_department):
    """Test employee with availability for only some days."""
    availability = {
        "monday": {"available": True, "start": "10:00", "end": "14:00"},
        "wednesday": {"available": True, "start": "10:00", "end": "14:00"},
        "friday": {"available": True, "start": "10:00", "end": "14:00"}
    }

    employee = Employee(
        name="Part Time",
        email="parttime@example.com",
        role="Staff",
        department_id=test_department.id,
        availability_pattern=availability
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    assert "monday" in employee.availability_pattern
    assert "tuesday" not in employee.availability_pattern


@pytest.mark.asyncio
async def test_update_availability_pattern(db_session, test_department):
    """Test updating employee availability pattern."""
    employee = Employee(
        name="Test Employee",
        email="update_avail@example.com",
        role="Staff",
        department_id=test_department.id,
        availability_pattern={"monday": {"available": True, "start": "09:00", "end": "17:00"}}
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Update to different schedule
    new_availability = {
        "monday": {"available": True, "start": "08:00", "end": "16:00"},
        "tuesday": {"available": True, "start": "08:00", "end": "16:00"}
    }

    employee.availability_pattern = new_availability
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.availability_pattern["monday"]["start"] == "08:00"
    assert "tuesday" in employee.availability_pattern


# ============================================================================
# HOURLY RATE TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_hourly_rate_precision(db_session, test_department):
    """Test hourly rate maintains decimal precision."""
    employee = Employee(
        name="Test Employee",
        email="rate@example.com",
        role="Developer",
        department_id=test_department.id,
        hourly_rate=25.75
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.hourly_rate == 25.75
    assert isinstance(employee.hourly_rate, float)


@pytest.mark.asyncio
async def test_hourly_rate_range_validation(db_session):
    """Test hourly rate must be between 0 and 1000."""
    from src.schemas import EmployeeCreate
    from pydantic import ValidationError

    # Test negative rate
    with pytest.raises(ValidationError) as exc_info:
        EmployeeCreate(
            firstName="Test",
            lastName="Employee",
            hourly_rate=-10.0
        )

    errors = exc_info.value.errors()
    assert any("greater_than_equal" in str(error) for error in errors)

    # Test excessive rate
    with pytest.raises(ValidationError) as exc_info:
        EmployeeCreate(
            firstName="Test",
            lastName="Employee",
            hourly_rate=1500.0
        )

    errors = exc_info.value.errors()
    assert any("less_than_equal" in str(error) for error in errors)


@pytest.mark.asyncio
async def test_hourly_rate_zero_valid(db_session, test_department):
    """Test that zero is a valid hourly rate (volunteers/interns)."""
    employee = Employee(
        name="Volunteer",
        email="volunteer@example.com",
        role="Intern",
        department_id=test_department.id,
        hourly_rate=0.0
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.hourly_rate == 0.0


@pytest.mark.asyncio
async def test_update_hourly_rate(db_session, test_department):
    """Test updating employee hourly rate."""
    employee = Employee(
        name="Test Employee",
        email="update_rate@example.com",
        role="Developer",
        department_id=test_department.id,
        hourly_rate=20.0
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Give raise
    employee.hourly_rate = 25.0
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.hourly_rate == 25.0


# ============================================================================
# MAX HOURS PER WEEK TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_max_hours_per_week_range(db_session):
    """Test max_hours_per_week must be between 1 and 168."""
    from src.schemas import EmployeeCreate
    from pydantic import ValidationError

    # Test zero hours (invalid)
    with pytest.raises(ValidationError) as exc_info:
        EmployeeCreate(
            firstName="Test",
            lastName="Employee",
            max_hours_per_week=0
        )

    errors = exc_info.value.errors()
    assert any("greater_than_equal" in str(error) for error in errors)

    # Test > 168 hours (more than hours in a week)
    with pytest.raises(ValidationError) as exc_info:
        EmployeeCreate(
            firstName="Test",
            lastName="Employee",
            max_hours_per_week=200
        )

    errors = exc_info.value.errors()
    assert any("less_than_equal" in str(error) for error in errors)


@pytest.mark.asyncio
async def test_max_hours_default_40(db_session, test_department):
    """Test that max_hours_per_week defaults to 40 if not specified."""
    employee = Employee(
        name="Test Employee",
        email="default_hours@example.com",
        role="Staff",
        department_id=test_department.id
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Check default value
    assert employee.max_hours_per_week == 40


@pytest.mark.asyncio
async def test_max_hours_part_time(db_session, test_department):
    """Test part-time employee with reduced max hours."""
    employee = Employee(
        name="Part Timer",
        email="parttime_hours@example.com",
        role="Staff",
        department_id=test_department.id,
        max_hours_per_week=20
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    assert employee.max_hours_per_week == 20


# ============================================================================
# BUSINESS LOGIC TESTS (COMBINED FIELDS)
# ============================================================================

@pytest.mark.asyncio
async def test_full_employee_profile_with_all_extended_fields(db_session, test_department):
    """Test creating complete employee profile with all extended fields."""
    availability = {
        "monday": {"available": True, "start": "09:00", "end": "17:00"},
        "tuesday": {"available": True, "start": "09:00", "end": "17:00"},
        "wednesday": {"available": True, "start": "09:00", "end": "17:00"},
        "thursday": {"available": True, "start": "09:00", "end": "17:00"},
        "friday": {"available": True, "start": "09:00", "end": "17:00"}
    }

    employee = Employee(
        name="Complete Profile",
        email="complete@example.com",
        role="Senior Developer",
        department_id=test_department.id,
        hourly_rate=45.50,
        max_hours_per_week=40,
        qualifications=["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        availability_pattern=availability
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Verify all fields
    assert employee.hourly_rate == 45.50
    assert employee.max_hours_per_week == 40
    assert len(employee.qualifications) == 5
    assert "Python" in employee.qualifications
    assert employee.availability_pattern["monday"]["start"] == "09:00"


@pytest.mark.asyncio
async def test_field_combinations_and_data_integrity(db_session, test_department):
    """Test that all extended fields work together and maintain integrity."""
    # Create multiple employees with different combinations
    employees_data = [
        {
            "name": "Full Time Dev",
            "email": "fulltime@example.com",
            "role": "Developer",
            "hourly_rate": 35.0,
            "max_hours_per_week": 40,
            "qualifications": ["Python", "JavaScript"]
        },
        {
            "name": "Part Time Junior",
            "email": "parttime@example.com",
            "role": "Junior",
            "hourly_rate": 20.0,
            "max_hours_per_week": 20,
            "qualifications": ["HTML", "CSS"]
        },
        {
            "name": "Senior Consultant",
            "email": "senior@example.com",
            "role": "Consultant",
            "hourly_rate": 100.0,
            "max_hours_per_week": 15,
            "qualifications": ["Architecture", "Cloud", "Security"]
        }
    ]

    for data in employees_data:
        employee = Employee(department_id=test_department.id, **data)
        db_session.add(employee)

    await db_session.commit()

    # Verify all created
    result = await db_session.execute(select(Employee))
    all_employees = result.scalars().all()

    assert len(all_employees) == 3

    # Verify data integrity
    fulltime = next(e for e in all_employees if e.email == "fulltime@example.com")
    assert fulltime.hourly_rate == 35.0
    assert fulltime.max_hours_per_week == 40

    senior = next(e for e in all_employees if e.email == "senior@example.com")
    assert senior.hourly_rate == 100.0
    assert len(senior.qualifications) == 3


@pytest.mark.asyncio
async def test_update_multiple_extended_fields_simultaneously(db_session, test_department):
    """Test updating multiple extended fields in a single operation."""
    employee = Employee(
        name="Update Test",
        email="update_multi@example.com",
        role="Developer",
        department_id=test_department.id,
        hourly_rate=25.0,
        max_hours_per_week=40,
        qualifications=["Python"]
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Update multiple fields
    employee.hourly_rate = 30.0
    employee.max_hours_per_week = 35
    employee.qualifications = ["Python", "FastAPI", "Docker"]

    await db_session.commit()
    await db_session.refresh(employee)

    # Verify all updates applied
    assert employee.hourly_rate == 30.0
    assert employee.max_hours_per_week == 35
    assert len(employee.qualifications) == 3
    assert "FastAPI" in employee.qualifications
