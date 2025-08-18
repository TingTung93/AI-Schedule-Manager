"""
Pytest configuration and shared fixtures for backend tests.
"""

import pytest
import asyncio
from typing import Generator, AsyncGenerator
from unittest.mock import Mock, AsyncMock
import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Configure async test support
pytest_plugins = ('pytest_asyncio',)


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_database():
    """Mock database connection for testing."""
    db = Mock()
    db.query = Mock()
    db.add = Mock()
    db.commit = Mock()
    db.refresh = Mock()
    db.delete = Mock()
    return db


@pytest.fixture
def mock_redis():
    """Mock Redis connection for testing."""
    redis = Mock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=True)
    redis.exists = AsyncMock(return_value=False)
    return redis


@pytest.fixture
def sample_employee_data():
    """Sample employee data for testing."""
    return {
        "id": "emp-001",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "role": "Cashier",
        "hourly_rate": 15.50,
        "min_hours_week": 20,
        "max_hours_week": 40,
        "skills": ["cash_handling", "customer_service"],
        "availability": {
            "monday": [{"start": "09:00", "end": "17:00"}],
            "tuesday": [{"start": "09:00", "end": "17:00"}],
            "wednesday": [{"start": "09:00", "end": "17:00"}],
            "thursday": [{"start": "09:00", "end": "17:00"}],
            "friday": [{"start": "09:00", "end": "17:00"}]
        }
    }


@pytest.fixture
def sample_rule_data():
    """Sample scheduling rule data for testing."""
    return {
        "id": "rule-001",
        "employee_id": "emp-001",
        "rule_text": "John can't work past 5pm on weekdays",
        "rule_type": "availability",
        "parsed_constraint": {
            "type": "time_restriction",
            "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "end_time": "17:00"
        },
        "priority": 10,
        "active": True
    }


@pytest.fixture
def sample_shift_data():
    """Sample shift data for testing."""
    return {
        "id": "shift-001",
        "employee_id": "emp-001",
        "date": "2024-01-15",
        "start_time": "09:00",
        "end_time": "17:00",
        "position": "Cashier",
        "status": "scheduled",
        "break_duration": 30
    }


@pytest.fixture
def mock_spacy_nlp():
    """Mock spaCy NLP model for testing."""
    nlp = Mock()
    doc = Mock()
    doc.text = "test text"
    doc.ents = []
    doc.sents = [Mock(text="test sentence")]
    doc.__iter__ = Mock(return_value=iter([]))
    nlp.return_value = doc
    return nlp


@pytest.fixture
def mock_ortools_solver():
    """Mock OR-Tools solver for testing."""
    solver = Mock()
    solver.Solve = Mock(return_value=0)  # OPTIMAL status
    solver.Value = Mock(return_value=1)
    solver.BooleanValue = Mock(return_value=True)
    solver.ObjectiveValue = Mock(return_value=100.0)
    solver.WallTime = Mock(return_value=1.5)
    return solver


@pytest.fixture
async def mock_celery_task():
    """Mock Celery task for testing."""
    task = AsyncMock()
    task.delay = AsyncMock()
    task.apply_async = AsyncMock()
    task.AsyncResult = Mock()
    return task


@pytest.fixture
def auth_headers():
    """Mock authentication headers for API testing."""
    return {
        "Authorization": "Bearer test-token-123456789",
        "Content-Type": "application/json"
    }


@pytest.fixture
def mock_jwt_payload():
    """Mock JWT payload for testing."""
    return {
        "sub": "user-001",
        "email": "test@example.com",
        "role": "manager",
        "exp": 9999999999
    }


# Test configuration
@pytest.fixture(autouse=True)
def reset_singleton_instances():
    """Reset singleton instances between tests."""
    # Add any singleton resets here if needed
    yield
    # Cleanup after test


@pytest.fixture
def mock_env_variables(monkeypatch):
    """Set mock environment variables for testing."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@localhost/testdb")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-testing-only")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("ENVIRONMENT", "test")
    yield
    # Environment variables are automatically cleaned up by monkeypatch