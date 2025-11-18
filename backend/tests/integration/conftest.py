"""
Integration test configuration and fixtures.

Provides shared fixtures for integration tests including:
- Test database setup and teardown
- Test client with authentication
- Sample data fixtures
- Mock services
"""

import pytest
import asyncio
from datetime import datetime, date, timedelta
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from src.database import Base
from src.models import Employee, Department, Shift, Schedule
from src.auth.models import User, Role, Permission, create_default_roles_and_permissions

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        # Create default roles and permissions
        create_default_roles_and_permissions(session)
        await session.commit()

        yield session
        await session.rollback()


@pytest.fixture
async def client(db: AsyncSession) -> AsyncGenerator:
    """Create test HTTP client with database override."""
    from httpx import AsyncClient
    from src.main import app
    from src.database import get_database_session

    # Override database dependency
    async def override_get_db():
        yield db

    app.dependency_overrides[get_database_session] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """Mock authentication headers for testing."""
    return {
        "Authorization": "Bearer test-token-123456789",
        "Content-Type": "application/json"
    }


@pytest.fixture
async def test_user(db: AsyncSession):
    """Create test user with default role."""
    from src.auth.auth import auth_service

    user = User(
        email="testuser@example.com",
        password_hash=auth_service.hash_password("TestPassword123!"),
        first_name="Test",
        last_name="User",
        is_active=True,
        is_verified=True
    )

    # Get user role
    role = await db.query(Role).filter_by(name="user").first()
    if role:
        user.roles.append(role)

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@pytest.fixture
async def test_admin(db: AsyncSession):
    """Create test admin user."""
    from src.auth.auth import auth_service

    admin = User(
        email="admin@example.com",
        password_hash=auth_service.hash_password("AdminPassword123!"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_verified=True
    )

    # Get admin role
    admin_role = await db.query(Role).filter_by(name="admin").first()
    if admin_role:
        admin.roles.append(admin_role)

    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    return admin


@pytest.fixture
async def test_departments(db: AsyncSession):
    """Create test departments."""
    departments = [
        Department(
            name="Engineering",
            description="Software development team",
            active=True
        ),
        Department(
            name="Operations",
            description="Operations and support team",
            active=True
        ),
        Department(
            name="Management",
            description="Management team",
            active=True
        )
    ]

    for dept in departments:
        db.add(dept)

    await db.commit()

    for dept in departments:
        await db.refresh(dept)

    return departments


@pytest.fixture
async def test_employees(db: AsyncSession, test_departments):
    """Create test employees."""
    employees = [
        Employee(
            name="John Doe",
            email="john.doe@company.com",
            role="Software Engineer",
            phone="+1234567890",
            hourly_rate=50.00,
            max_hours_per_week=40,
            qualifications=["Python", "React", "SQL"],
            department_id=test_departments[0].id,
            active=True
        ),
        Employee(
            name="Jane Smith",
            email="jane.smith@company.com",
            role="Manager",
            phone="+1234567891",
            hourly_rate=60.00,
            max_hours_per_week=40,
            qualifications=["Leadership", "Project Management"],
            department_id=test_departments[2].id,
            active=True
        ),
        Employee(
            name="Bob Johnson",
            email="bob.johnson@company.com",
            role="Operations Specialist",
            phone="+1234567892",
            hourly_rate=45.00,
            max_hours_per_week=40,
            qualifications=["Support", "Documentation"],
            department_id=test_departments[1].id,
            active=True
        )
    ]

    for emp in employees:
        db.add(emp)

    await db.commit()

    for emp in employees:
        await db.refresh(emp)

    return employees


@pytest.fixture
async def test_shifts(db: AsyncSession, test_departments):
    """Create test shifts."""
    shifts = [
        Shift(
            name="Morning Shift",
            shift_type="morning",
            start_time="09:00:00",
            end_time="17:00:00",
            required_staff=2,
            department_id=test_departments[0].id,
            active=True
        ),
        Shift(
            name="Evening Shift",
            shift_type="evening",
            start_time="17:00:00",
            end_time="01:00:00",
            required_staff=1,
            department_id=test_departments[0].id,
            active=True
        ),
        Shift(
            name="Day Shift",
            shift_type="day",
            start_time="08:00:00",
            end_time="16:00:00",
            required_staff=3,
            department_id=test_departments[1].id,
            active=True
        )
    ]

    for shift in shifts:
        db.add(shift)

    await db.commit()

    for shift in shifts:
        await db.refresh(shift)

    return shifts


@pytest.fixture
async def test_schedules(db: AsyncSession, test_employees, test_shifts):
    """Create test schedule assignments."""
    today = date.today()

    schedules = [
        Schedule(
            employee_id=test_employees[0].id,
            shift_id=test_shifts[0].id,
            date=today,
            status="scheduled",
            notes="Regular shift"
        ),
        Schedule(
            employee_id=test_employees[1].id,
            shift_id=test_shifts[0].id,
            date=today + timedelta(days=1),
            status="scheduled"
        ),
        Schedule(
            employee_id=test_employees[2].id,
            shift_id=test_shifts[2].id,
            date=today,
            status="scheduled"
        ),
        Schedule(
            employee_id=test_employees[0].id,
            shift_id=test_shifts[1].id,
            date=today + timedelta(days=2),
            status="scheduled",
            overtime_approved=True
        )
    ]

    for schedule in schedules:
        db.add(schedule)

    await db.commit()

    for schedule in schedules:
        await db.refresh(schedule)

    return schedules


@pytest.fixture
def sample_employee_data():
    """Sample employee data for creating new employees."""
    return {
        "name": "Sample Employee",
        "email": "sample@company.com",
        "role": "Developer",
        "phone": "+1234567890",
        "hourlyRate": 45.00,
        "maxHoursPerWeek": 40,
        "qualifications": ["Python", "JavaScript"],
        "active": True
    }


@pytest.fixture
def sample_schedule_data():
    """Sample schedule data for creating new schedules."""
    return {
        "employeeId": 1,
        "shiftId": 1,
        "date": str(date.today()),
        "status": "scheduled",
        "notes": "Test schedule"
    }


@pytest.fixture
def sample_shift_data():
    """Sample shift data for creating new shifts."""
    return {
        "name": "Test Shift",
        "shiftType": "day",
        "startTime": "10:00:00",
        "endTime": "18:00:00",
        "requiredStaff": 2,
        "active": True
    }


@pytest.fixture(autouse=True)
async def cleanup_test_data(db: AsyncSession):
    """Automatically cleanup test data after each test."""
    yield

    # Cleanup is handled by session rollback in db fixture


@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    from unittest.mock import AsyncMock, Mock

    redis = Mock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=True)
    redis.exists = AsyncMock(return_value=False)
    redis.setex = AsyncMock(return_value=True)

    return redis


@pytest.fixture
def mock_email_service():
    """Mock email service for testing."""
    from unittest.mock import AsyncMock, Mock

    email_service = Mock()
    email_service.send_email = AsyncMock(return_value=True)
    email_service.send_password_reset = AsyncMock(return_value=True)
    email_service.send_verification = AsyncMock(return_value=True)

    return email_service


# Custom markers for test categorization
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "auth: mark test as authentication integration test"
    )
    config.addinivalue_line(
        "markers", "employee: mark test as employee CRUD integration test"
    )
    config.addinivalue_line(
        "markers", "schedule: mark test as schedule CRUD integration test"
    )
    config.addinivalue_line(
        "markers", "transformation: mark test as data transformation test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
