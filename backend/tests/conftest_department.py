"""
Additional pytest fixtures for department enhancement tests.

Provides specialized fixtures for:
- Department test data
- Bulk operation testing
- Audit log testing
- Analytics testing
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models import Department, User


@pytest.fixture
async def test_departments(db: AsyncSession) -> Dict[str, Department]:
    """Create standard test departments."""
    departments = {
        "engineering": Department(
            name="Engineering",
            description="Software development team",
            active=True,
            settings={"budget": 100000, "team_size_target": 20}
        ),
        "sales": Department(
            name="Sales",
            description="Sales and marketing team",
            active=True,
            settings={"budget": 75000, "team_size_target": 15}
        ),
        "hr": Department(
            name="Human Resources",
            description="HR and recruitment",
            active=True,
            settings={"budget": 50000, "team_size_target": 5}
        ),
        "inactive": Department(
            name="Inactive Department",
            description="Deprecated department",
            active=False,
            settings={}
        )
    }

    db.add_all(departments.values())
    await db.commit()

    for dept in departments.values():
        await db.refresh(dept)

    return departments


@pytest.fixture
async def test_employees(db: AsyncSession, test_departments: Dict[str, Department]) -> List[User]:
    """Create test employees distributed across departments."""
    import bcrypt

    password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    employees = []

    # Engineering team (10 employees)
    for i in range(10):
        emp = User(
            email=f"eng{i}@test.com",
            password_hash=password_hash,
            first_name=f"Engineer",
            last_name=f"Test{i}",
            department_id=test_departments["engineering"].id,
            is_active=True
        )
        employees.append(emp)

    # Sales team (8 employees)
    for i in range(8):
        emp = User(
            email=f"sales{i}@test.com",
            password_hash=password_hash,
            first_name=f"Sales",
            last_name=f"Rep{i}",
            department_id=test_departments["sales"].id,
            is_active=True
        )
        employees.append(emp)

    # HR team (3 employees)
    for i in range(3):
        emp = User(
            email=f"hr{i}@test.com",
            password_hash=password_hash,
            first_name=f"HR",
            last_name=f"Staff{i}",
            department_id=test_departments["hr"].id,
            is_active=True
        )
        employees.append(emp)

    # Unassigned employees (5)
    for i in range(5):
        emp = User(
            email=f"unassigned{i}@test.com",
            password_hash=password_hash,
            first_name=f"Unassigned",
            last_name=f"Employee{i}",
            department_id=None,
            is_active=True
        )
        employees.append(emp)

    db.add_all(employees)
    await db.commit()

    for emp in employees:
        await db.refresh(emp)

    return employees


@pytest.fixture
async def bulk_test_employees(db: AsyncSession) -> List[User]:
    """Create large batch of employees for bulk operation testing."""
    import bcrypt

    password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    employees = []
    for i in range(100):
        emp = User(
            email=f"bulk_emp{i}@test.com",
            password_hash=password_hash,
            first_name=f"Bulk",
            last_name=f"Employee{i}",
            department_id=None,
            is_active=True
        )
        employees.append(emp)

    db.add_all(employees)
    await db.commit()

    for emp in employees:
        await db.refresh(emp)

    return employees


@pytest.fixture
async def audit_test_data(db: AsyncSession) -> Dict:
    """Create test data for audit log testing."""
    import bcrypt

    # Create departments
    dept1 = Department(name="Audit Dept 1", active=True)
    dept2 = Department(name="Audit Dept 2", active=True)
    db.add_all([dept1, dept2])
    await db.commit()
    await db.refresh(dept1)
    await db.refresh(dept2)

    # Create employees
    password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    employees = []
    for i in range(10):
        emp = User(
            email=f"audit_emp{i}@test.com",
            password_hash=password_hash,
            first_name=f"Audit",
            last_name=f"Employee{i}",
            department_id=dept1.id,
            is_active=True
        )
        employees.append(emp)

    db.add_all(employees)
    await db.commit()

    for emp in employees:
        await db.refresh(emp)

    return {
        "source_department": dept1,
        "target_department": dept2,
        "employees": employees
    }


@pytest.fixture
async def analytics_test_data(db: AsyncSession) -> Dict:
    """Create comprehensive test data for analytics."""
    import bcrypt

    # Create departments with different characteristics
    departments = []
    dept_configs = [
        ("Large Active", True, 50),
        ("Medium Active", True, 25),
        ("Small Active", True, 10),
        ("Inactive Dept", False, 5)
    ]

    password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    for dept_name, active, employee_count in dept_configs:
        dept = Department(name=dept_name, active=active)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        departments.append(dept)

        # Add employees
        employees = []
        for i in range(employee_count):
            emp = User(
                email=f"{dept_name.lower().replace(' ', '_')}_{i}@test.com",
                password_hash=password_hash,
                first_name=f"{dept_name}",
                last_name=f"Employee{i}",
                department_id=dept.id,
                is_active=(i % 5 != 0)  # 80% active
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

    return {
        "departments": departments,
        "total_employees": sum(config[2] for config in dept_configs)
    }


@pytest.fixture
def performance_timer():
    """Fixture for timing performance tests."""
    import time

    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None

        def start(self):
            self.start_time = time.time()

        def stop(self):
            self.end_time = time.time()

        @property
        def duration(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None

        def assert_under(self, max_seconds: float):
            """Assert operation completed under threshold."""
            assert self.duration is not None, "Timer not stopped"
            assert self.duration < max_seconds, (
                f"Operation took {self.duration:.3f}s, "
                f"expected under {max_seconds}s"
            )

    return Timer()


@pytest.fixture
async def mock_admin_user(db: AsyncSession) -> User:
    """Create mock admin user for authorization testing."""
    import bcrypt

    password_hash = bcrypt.hashpw("Admin123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    admin = User(
        email="admin@test.com",
        password_hash=password_hash,
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_admin=True
    )

    db.add(admin)
    await db.commit()
    await db.refresh(admin)

    return admin


@pytest.fixture
async def concurrent_test_departments(db: AsyncSession) -> Dict:
    """Create departments for concurrent operation testing."""
    import bcrypt

    # Create departments
    departments = []
    for i in range(5):
        dept = Department(name=f"Concurrent Dept {i}", active=True)
        departments.append(dept)

    db.add_all(departments)
    await db.commit()

    for dept in departments:
        await db.refresh(dept)

    # Create employees
    password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    employees = []
    for i in range(100):
        emp = User(
            email=f"concurrent_emp{i}@test.com",
            password_hash=password_hash,
            first_name=f"Concurrent",
            last_name=f"Employee{i}",
            is_active=True
        )
        employees.append(emp)

    db.add_all(employees)
    await db.commit()

    for emp in employees:
        await db.refresh(emp)

    return {
        "departments": departments,
        "employees": employees
    }


@pytest.fixture
def mock_bulk_assignment_data() -> Dict:
    """Mock data for bulk assignment API testing."""
    return {
        "employee_ids": [1, 2, 3, 4, 5],
        "department_id": 1,
        "reason": "Team restructuring",
        "effective_date": datetime.utcnow().isoformat()
    }


@pytest.fixture
def mock_transfer_data() -> Dict:
    """Mock data for department transfer API testing."""
    return {
        "source_department_id": 1,
        "target_department_id": 2,
        "employee_ids": [1, 2, 3],
        "transfer_date": datetime.utcnow().isoformat(),
        "reason": "Department consolidation"
    }


@pytest.fixture
def mock_analytics_filters() -> Dict:
    """Mock filters for analytics queries."""
    return {
        "start_date": (datetime.utcnow() - timedelta(days=30)).date().isoformat(),
        "end_date": datetime.utcnow().date().isoformat(),
        "department_ids": [1, 2, 3],
        "include_inactive": False
    }
