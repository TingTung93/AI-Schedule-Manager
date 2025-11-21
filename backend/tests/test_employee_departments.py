"""
Comprehensive tests for department assignment in employee/user management.
Tests cover creating, updating, removing department assignments and filtering.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import User
from src.models.department import Department


# Note: Fixtures must use pytest_asyncio.fixture for async support
import pytest_asyncio


@pytest_asyncio.fixture
async def test_departments(db: AsyncSession):
    """Create test departments for testing."""
    departments = [
        Department(
            name="Engineering",
            description="Software development team",
            active=True
        ),
        Department(
            name="Marketing",
            description="Marketing and communications",
            active=True
        ),
        Department(
            name="Sales",
            description="Sales department",
            active=True
        ),
        Department(
            name="Inactive Dept",
            description="Inactive department for testing",
            active=False
        ),
    ]

    for dept in departments:
        db.add(dept)

    await db.commit()

    # Refresh to get IDs
    for dept in departments:
        await db.refresh(dept)

    return departments


@pytest_asyncio.fixture
async def test_employees(db: AsyncSession, test_departments):
    """Create test employees with various department assignments."""
    import bcrypt

    password_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode('utf-8')

    employees = [
        User(
            email="john.doe@example.com",
            password_hash=password_hash,
            first_name="John",
            last_name="Doe",
            department_id=test_departments[0].id,  # Engineering
            is_active=True
        ),
        User(
            email="jane.smith@example.com",
            password_hash=password_hash,
            first_name="Jane",
            last_name="Smith",
            department_id=test_departments[1].id,  # Marketing
            is_active=True
        ),
        User(
            email="bob.wilson@example.com",
            password_hash=password_hash,
            first_name="Bob",
            last_name="Wilson",
            department_id=None,  # No department
            is_active=True
        ),
    ]

    for emp in employees:
        db.add(emp)

    await db.commit()

    # Refresh to get IDs
    for emp in employees:
        await db.refresh(emp)

    return employees


# Use the client fixture from conftest.py which already handles auth and db overrides


# Test 1: Create employee with valid department_id
@pytest.mark.asyncio
async def test_create_employee_with_valid_department(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test creating an employee with a valid department_id."""
    engineering_dept = test_departments[0]

    employee_data = {
        "first_name": "Alice",
        "last_name": "Johnson",
        "email": "alice.johnson@example.com",
        "department_id": engineering_dept.id
    }

    response = await client.post(
        "/api/employees",
        json=employee_data
    )

    assert response.status_code == 201
    data = response.json()

    # Verify response structure
    assert data["first_name"] == "Alice"
    assert data["last_name"] == "Johnson"
    assert data["email"] == "alice.johnson@example.com"
    assert data["department_id"] == engineering_dept.id
    assert "id" in data

    # Verify in database
    result = await db.execute(
        select(User).where(User.email == "alice.johnson@example.com")
    )
    created_user = result.scalar_one_or_none()

    assert created_user is not None
    assert created_user.department_id == engineering_dept.id


# Test 2: Create employee with invalid department_id (should fail)
@pytest.mark.asyncio
async def test_create_employee_with_invalid_department(
    client: AsyncClient,
    db: AsyncSession
):
    """Test creating an employee with an invalid/non-existent department_id should fail."""
    employee_data = {
        "first_name": "Invalid",
        "last_name": "Department",
        "email": "invalid.dept@example.com",
        "department_id": 99999  # Non-existent department
    }

    response = await client.post(
        "/api/employees",
        json=employee_data
    )

    # Should fail with appropriate error
    assert response.status_code in [400, 404, 422, 500]

    # Verify employee was NOT created
    result = await db.execute(
        select(User).where(User.email == "invalid.dept@example.com")
    )
    user = result.scalar_one_or_none()
    assert user is None


# Test 3: Create employee without department_id (should succeed)
@pytest.mark.asyncio
async def test_create_employee_without_department(
    client: AsyncClient,
    db: AsyncSession
):
    """Test creating an employee without a department_id should succeed."""
    employee_data = {
        "first_name": "No",
        "last_name": "Department",
        "email": "no.department@example.com"
        # department_id is intentionally omitted
    }

    response = await client.post(
        "/api/employees",
        json=employee_data
    )

    assert response.status_code == 201
    data = response.json()

    assert data["first_name"] == "No"
    assert data["last_name"] == "Department"
    assert data["department_id"] is None

    # Verify in database
    result = await db.execute(
        select(User).where(User.email == "no.department@example.com")
    )
    created_user = result.scalar_one_or_none()

    assert created_user is not None
    assert created_user.department_id is None


# Test 4: Update employee's department
@pytest.mark.asyncio
async def test_update_employee_department(
    client: AsyncClient,
    db: AsyncSession,
    test_employees,
    test_departments
):
    """Test updating an employee's department assignment."""
    employee = test_employees[2]  # Bob Wilson (no department)
    sales_dept = test_departments[2]

    # Bob starts with no department
    assert employee.department_id is None

    update_data = {
        "department_id": sales_dept.id
    }

    response = await client.patch(
        f"/api/employees/{employee.id}",
        json=update_data
    )

    assert response.status_code == 200
    data = response.json()

    assert data["department_id"] == sales_dept.id

    # Verify in database
    await db.refresh(employee)
    assert employee.department_id == sales_dept.id


# Test 5: Update to invalid department (should fail)
@pytest.mark.asyncio
async def test_update_employee_to_invalid_department(
    client: AsyncClient,
    db: AsyncSession,
    test_employees
):
    """Test updating an employee to an invalid department should fail."""
    employee = test_employees[0]  # John Doe
    original_dept_id = employee.department_id

    update_data = {
        "department_id": 99999  # Non-existent department
    }

    response = await client.patch(
        f"/api/employees/{employee.id}",
        json=update_data
    )

    # Should fail with appropriate error
    assert response.status_code in [400, 404, 422, 500]

    # Verify department was NOT changed
    await db.refresh(employee)
    assert employee.department_id == original_dept_id


# Test 6: Remove department assignment (set to null)
@pytest.mark.asyncio
async def test_remove_department_assignment(
    client: AsyncClient,
    db: AsyncSession,
    test_employees
):
    """Test removing an employee's department assignment by setting it to null."""
    employee = test_employees[0]  # John Doe (has Engineering dept)

    # John starts with a department
    assert employee.department_id is not None

    update_data = {
        "department_id": None
    }

    response = await client.patch(
        f"/api/employees/{employee.id}",
        json=update_data
    )

    assert response.status_code == 200
    data = response.json()

    assert data["department_id"] is None

    # Verify in database
    await db.refresh(employee)
    assert employee.department_id is None


# Test 7: Employee response includes department details
@pytest.mark.asyncio
async def test_employee_response_includes_department_details(
    client: AsyncClient,
    test_employees,
    test_departments
):
    """Test that employee response includes department details when present."""
    employee = test_employees[0]  # John Doe with Engineering dept

    response = await client.get(
        f"/api/employees/{employee.id}"
    )

    assert response.status_code == 200
    data = response.json()

    # Verify employee data
    assert data["id"] == employee.id
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["department_id"] == test_departments[0].id

    # Note: The actual department object might be included depending on schema
    # This test verifies at minimum the department_id is present


# Test 8: Filter employees by department
@pytest.mark.asyncio
async def test_filter_employees_by_department(
    client: AsyncClient,
    test_employees,
    test_departments
):
    """Test filtering employees by department_id."""
    engineering_dept = test_departments[0]
    marketing_dept = test_departments[1]

    # Filter for Engineering department
    response = await client.get(
        f"/api/employees?department_id={engineering_dept.id}"
    )

    assert response.status_code == 200
    data = response.json()

    # Should only return employees in Engineering
    assert isinstance(data, list)
    assert len(data) >= 1

    # All returned employees should be in Engineering
    for employee in data:
        assert employee["department_id"] == engineering_dept.id

    # Filter for Marketing department
    response = await client.get(
        f"/api/employees?department_id={marketing_dept.id}"
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= 1

    # All returned employees should be in Marketing
    for employee in data:
        assert employee["department_id"] == marketing_dept.id


# Test 9: Filter employees with no department
@pytest.mark.asyncio
async def test_filter_employees_with_no_department(
    client: AsyncClient,
    test_employees
):
    """Test getting employees that have no department assigned."""
    # Get all employees
    response = await client.get(
        "/api/employees"
    )

    assert response.status_code == 200
    all_employees = response.json()

    # Filter for employees with no department
    no_dept_employees = [e for e in all_employees if e["department_id"] is None]

    # Should have at least Bob Wilson who has no department
    assert len(no_dept_employees) >= 1
    assert any(e["first_name"] == "Bob" and e["last_name"] == "Wilson" for e in no_dept_employees)


# Test 10: Verify department relationship integrity
@pytest.mark.asyncio
async def test_department_relationship_integrity(
    db: AsyncSession,
    test_employees,
    test_departments
):
    """Test that the relationship between employee and department is properly maintained."""
    employee = test_employees[0]  # John Doe with Engineering

    # Load employee with department relationship
    result = await db.execute(
        select(User).where(User.id == employee.id)
    )
    user = result.scalar_one()

    # Load department
    dept_result = await db.execute(
        select(Department).where(Department.id == user.department_id)
    )
    department = dept_result.scalar_one_or_none()

    assert department is not None
    assert department.name == "Engineering"
    assert user.department_id == department.id
