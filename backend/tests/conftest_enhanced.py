"""
Enhanced test fixtures and configuration for comprehensive testing.
Provides reusable fixtures for auth, database, and HTTP clients.
"""

import asyncio
from typing import AsyncGenerator, Generator

import bcrypt
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from backend.src.core.database import Base, get_db
from backend.src.main import app
from backend.src.models.employee import User
from backend.src.models.department import Department
from backend.src.auth.auth import auth_service


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client with database override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def existing_user(db_session: AsyncSession) -> User:
    """Create a test user for authentication tests."""
    password_hash = bcrypt.hashpw(
        "TestPassword123!".encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    user = User(
        email="testuser@test.com",
        password_hash=password_hash,
        first_name="Test",
        last_name="User",
        is_active=True
    )

    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def manager_user(db_session: AsyncSession) -> User:
    """Create a test manager user."""
    password_hash = bcrypt.hashpw(
        "ManagerPass123!".encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    user = User(
        email="manager@test.com",
        password_hash=password_hash,
        first_name="Manager",
        last_name="User",
        is_manager=True,
        is_active=True
    )

    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_department(db_session: AsyncSession) -> Department:
    """Create a test department."""
    dept = Department(
        name="Test Department",
        description="Department for testing",
        active=True
    )

    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)

    return dept


@pytest.fixture
def auth_headers(existing_user: User) -> dict:
    """Generate authentication headers for test user."""
    access_token = auth_service.create_access_token(
        data={"sub": str(existing_user.id)}
    )

    return {
        "Authorization": f"Bearer {access_token}"
    }


@pytest.fixture
def manager_auth_headers(manager_user: User) -> dict:
    """Generate authentication headers for manager user."""
    access_token = auth_service.create_access_token(
        data={"sub": str(manager_user.id)}
    )

    return {
        "Authorization": f"Bearer {access_token}"
    }


@pytest_asyncio.fixture
async def multiple_users(db_session: AsyncSession) -> list[User]:
    """Create multiple test users."""
    password_hash = bcrypt.hashpw(
        "TestPass123!".encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    users = []
    for i in range(10):
        user = User(
            email=f"user{i}@test.com",
            password_hash=password_hash,
            first_name=f"User{i}",
            last_name=f"Test{i}",
            is_active=True
        )
        users.append(user)

    db_session.add_all(users)
    await db_session.commit()

    for user in users:
        await db_session.refresh(user)

    return users


@pytest_asyncio.fixture
async def multiple_departments(db_session: AsyncSession) -> list[Department]:
    """Create multiple test departments."""
    departments = []
    for i in range(5):
        dept = Department(
            name=f"Department {i}",
            description=f"Test department {i}",
            active=True
        )
        departments.append(dept)

    db_session.add_all(departments)
    await db_session.commit()

    for dept in departments:
        await db_session.refresh(dept)

    return departments


@pytest.fixture
def mock_email_service(monkeypatch):
    """Mock email service for testing."""
    async def mock_send_email(*args, **kwargs):
        return True

    monkeypatch.setattr(
        "backend.src.services.email.email_service.send_email",
        mock_send_email
    )


@pytest.fixture
def mock_redis(monkeypatch):
    """Mock Redis for testing."""
    class MockRedis:
        def __init__(self):
            self.data = {}

        async def get(self, key):
            return self.data.get(key)

        async def set(self, key, value, ex=None):
            self.data[key] = value

        async def delete(self, key):
            self.data.pop(key, None)

        async def exists(self, key):
            return key in self.data

    mock_redis = MockRedis()
    monkeypatch.setattr("backend.src.core.cache.redis_client", mock_redis)
    return mock_redis


@pytest.fixture
def tmp_path(tmp_path_factory):
    """Create temporary directory for file tests."""
    return tmp_path_factory.mktemp("test_data")


# Markers for different test categories
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "unit: Unit tests"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests"
    )
    config.addinivalue_line(
        "markers", "slow: Slow running tests"
    )
    config.addinivalue_line(
        "markers", "auth: Authentication tests"
    )
    config.addinivalue_line(
        "markers", "crud: CRUD operation tests"
    )
