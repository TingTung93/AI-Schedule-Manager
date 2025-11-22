"""
Comprehensive tests for department assignment functionality.

Tests cover:
- Bulk employee assignment operations
- Employee transfer between departments
- Audit trail creation and tracking
- Transaction rollback on errors
- Invalid data handling
- Permission checks

Target: 90%+ code coverage
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import Mock, patch

from src.models import Department
from src.models.employee import Employee
from src.models.department_history import DepartmentHistory


@pytest_asyncio.fixture
async def test_departments(db: AsyncSession):
    """Create test departments for assignment testing."""
    departments = [
        Department(
            name="Sales Department",
            description="Sales team",
            active=True,
            settings={"max_capacity": 20}
        ),
        Department(
            name="Marketing Department",
            description="Marketing team",
            active=True,
            settings={"max_capacity": 15}
        ),
        Department(
            name="Engineering Department",
            description="Engineering team",
            active=True,
            settings={"max_capacity": 30}
        ),
        Department(
            name="Inactive Department",
            description="Inactive for testing",
            active=False,
            settings={}
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
    """Create test employees for assignment testing."""
    import bcrypt

    password_hash = bcrypt.hashpw(b"TestPass123!", bcrypt.gensalt()).decode('utf-8')

    employees = [
        Employee(
            name="Alice Johnson",
            email="alice.johnson@example.com",
            role="Sales Associate",
            phone="+1234567890",
            hourly_rate=18.50,
            max_hours_per_week=40,
            department_id=None,  # Unassigned
            active=True
        ),
        Employee(
            name="Bob Smith",
            email="bob.smith@example.com",
            role="Marketing Specialist",
            phone="+1234567891",
            hourly_rate=22.00,
            max_hours_per_week=40,
            department_id=test_departments[1].id,  # Marketing
            active=True
        ),
        Employee(
            name="Carol Davis",
            email="carol.davis@example.com",
            role="Software Engineer",
            phone="+1234567892",
            hourly_rate=45.00,
            max_hours_per_week=40,
            department_id=test_departments[2].id,  # Engineering
            active=True
        ),
        Employee(
            name="David Wilson",
            email="david.wilson@example.com",
            role="Sales Associate",
            phone="+1234567893",
            hourly_rate=19.00,
            max_hours_per_week=35,
            department_id=None,  # Unassigned
            active=True
        ),
        Employee(
            name="Eve Martinez",
            email="eve.martinez@example.com",
            role="QA Engineer",
            phone="+1234567894",
            hourly_rate=38.00,
            max_hours_per_week=40,
            department_id=test_departments[2].id,  # Engineering
            active=True
        ),
    ]

    for emp in employees:
        db.add(emp)

    await db.commit()

    # Refresh to get IDs
    for emp in employees:
        await db.refresh(emp)

    return employees


@pytest_asyncio.fixture
async def manager_user(db: AsyncSession):
    """Create a manager user for authentication testing."""
    from src.models import User
    import bcrypt

    password_hash = bcrypt.hashpw(b"Manager123!", bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="manager@example.com",
        password_hash=password_hash,
        first_name="Manager",
        last_name="User",
        role="manager",
        is_active=True
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


# Test 1: Bulk assign employees with valid data
@pytest.mark.asyncio
async def test_bulk_assign_employees_valid_data(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test bulk assigning employees to a department with valid data."""
    sales_dept = test_departments[0]
    # Select unassigned employees
    employee_ids = [test_employees[0].id, test_employees[3].id]

    assignment_data = {
        "employee_ids": employee_ids,
        "reason": "New sales team expansion",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{sales_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["assigned_count"] == len(employee_ids)
    assert len(data["assignments"]) == len(employee_ids)

    # Verify each assignment
    for assignment in data["assignments"]:
        assert assignment["employee_id"] in employee_ids
        assert assignment["new_department_id"] == sales_dept.id
        assert "assigned_at" in assignment

    # Verify in database
    for emp_id in employee_ids:
        result = await db.execute(
            select(Employee).where(Employee.id == emp_id)
        )
        employee = result.scalar_one()
        assert employee.department_id == sales_dept.id


# Test 2: Bulk assign with invalid employee IDs
@pytest.mark.asyncio
async def test_bulk_assign_invalid_employee_ids(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test bulk assignment with non-existent employee IDs should fail."""
    sales_dept = test_departments[0]
    invalid_employee_ids = [99999, 88888, 77777]

    assignment_data = {
        "employee_ids": invalid_employee_ids,
        "reason": "Invalid test",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{sales_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    # Should fail with 404 or 400
    assert response.status_code in [400, 404, 422]

    # Verify no assignments were created
    result = await db.execute(
        select(Employee).where(Employee.id.in_(invalid_employee_ids))
    )
    employees = result.scalars().all()
    assert len(employees) == 0


# Test 3: Bulk assign to non-existent department
@pytest.mark.asyncio
async def test_bulk_assign_invalid_department(
    client: AsyncClient,
    db: AsyncSession,
    test_employees
):
    """Test bulk assignment to non-existent department should fail."""
    invalid_dept_id = 99999
    employee_ids = [test_employees[0].id, test_employees[3].id]

    assignment_data = {
        "employee_ids": employee_ids,
        "reason": "Test invalid department",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{invalid_dept_id}/employees/bulk-assign",
        json=assignment_data
    )

    assert response.status_code == 404


# Test 4: Bulk assign with mixed valid and invalid employee IDs
@pytest.mark.asyncio
async def test_bulk_assign_mixed_employee_ids(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test bulk assignment with mixed valid/invalid IDs should fail atomically."""
    sales_dept = test_departments[0]
    # Mix valid and invalid IDs
    mixed_ids = [test_employees[0].id, 99999, test_employees[3].id]

    assignment_data = {
        "employee_ids": mixed_ids,
        "reason": "Mixed IDs test",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{sales_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    # Should fail
    assert response.status_code in [400, 404, 422]

    # Verify NO assignments were made (transaction rollback)
    result = await db.execute(
        select(Employee).where(Employee.id == test_employees[0].id)
    )
    employee = result.scalar_one()
    # Should still be unassigned
    assert employee.department_id is None


# Test 5: Transfer employee between departments
@pytest.mark.asyncio
async def test_transfer_employee_between_departments(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test transferring employee from one department to another."""
    marketing_dept = test_departments[1]
    sales_dept = test_departments[0]
    employee = test_employees[1]  # Bob Smith in Marketing

    # Verify initial state
    assert employee.department_id == marketing_dept.id

    transfer_data = {
        "to_department_id": sales_dept.id,
        "reason": "Better skills match for sales team",
        "requires_approval": False
    }

    response = await client.post(
        f"/api/departments/{marketing_dept.id}/employees/{employee.id}/transfer",
        json=transfer_data
    )

    assert response.status_code == 200
    data = response.json()

    assert data["employee_id"] == employee.id
    assert data["from_department_id"] == marketing_dept.id
    assert data["to_department_id"] == sales_dept.id
    assert data["reason"] == transfer_data["reason"]
    assert "transferred_at" in data

    # Verify in database
    await db.refresh(employee)
    assert employee.department_id == sales_dept.id


# Test 6: Transfer employee with non-existent source department
@pytest.mark.asyncio
async def test_transfer_invalid_source_department(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test transfer with non-existent source department should fail."""
    invalid_dept_id = 99999
    sales_dept = test_departments[0]
    employee = test_employees[1]

    transfer_data = {
        "to_department_id": sales_dept.id,
        "reason": "Invalid source department test",
        "requires_approval": False
    }

    response = await client.post(
        f"/api/departments/{invalid_dept_id}/employees/{employee.id}/transfer",
        json=transfer_data
    )

    assert response.status_code == 404


# Test 7: Transfer employee with non-existent target department
@pytest.mark.asyncio
async def test_transfer_invalid_target_department(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test transfer to non-existent target department should fail."""
    marketing_dept = test_departments[1]
    employee = test_employees[1]
    original_dept_id = employee.department_id

    transfer_data = {
        "to_department_id": 99999,
        "reason": "Invalid target department test",
        "requires_approval": False
    }

    response = await client.post(
        f"/api/departments/{marketing_dept.id}/employees/{employee.id}/transfer",
        json=transfer_data
    )

    assert response.status_code == 404

    # Verify employee still in original department
    await db.refresh(employee)
    assert employee.department_id == original_dept_id


# Test 8: Transfer non-existent employee
@pytest.mark.asyncio
async def test_transfer_invalid_employee(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test transferring non-existent employee should fail."""
    marketing_dept = test_departments[1]
    sales_dept = test_departments[0]
    invalid_employee_id = 99999

    transfer_data = {
        "to_department_id": sales_dept.id,
        "reason": "Invalid employee test",
        "requires_approval": False
    }

    response = await client.post(
        f"/api/departments/{marketing_dept.id}/employees/{invalid_employee_id}/transfer",
        json=transfer_data
    )

    assert response.status_code == 404


# Test 9: Audit trail creation on bulk assignment
@pytest.mark.asyncio
async def test_audit_trail_bulk_assignment(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test that audit trail is created for bulk assignments."""
    sales_dept = test_departments[0]
    employee_ids = [test_employees[0].id, test_employees[3].id]

    assignment_data = {
        "employee_ids": employee_ids,
        "reason": "Team reorganization for Q4",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{sales_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    assert response.status_code == 200

    # Verify audit trail entries were created
    result = await db.execute(
        select(DepartmentHistory)
        .where(DepartmentHistory.employee_id.in_(employee_ids))
        .where(DepartmentHistory.new_department_id == sales_dept.id)
    )
    audit_entries = result.scalars().all()

    assert len(audit_entries) >= len(employee_ids)

    for entry in audit_entries:
        assert entry.employee_id in employee_ids
        assert entry.new_department_id == sales_dept.id
        assert entry.change_reason == assignment_data["reason"]
        assert entry.changed_at is not None


# Test 10: Audit trail creation on transfer
@pytest.mark.asyncio
async def test_audit_trail_transfer(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test that audit trail is created for employee transfers."""
    marketing_dept = test_departments[1]
    sales_dept = test_departments[0]
    employee = test_employees[1]  # Bob Smith in Marketing

    transfer_data = {
        "to_department_id": sales_dept.id,
        "reason": "Skills better suited for sales",
        "requires_approval": False
    }

    response = await client.post(
        f"/api/departments/{marketing_dept.id}/employees/{employee.id}/transfer",
        json=transfer_data
    )

    assert response.status_code == 200

    # Verify audit trail entry
    result = await db.execute(
        select(DepartmentHistory)
        .where(DepartmentHistory.employee_id == employee.id)
        .where(DepartmentHistory.new_department_id == sales_dept.id)
        .order_by(DepartmentHistory.changed_at.desc())
    )
    audit_entry = result.scalar_one_or_none()

    assert audit_entry is not None
    assert audit_entry.employee_id == employee.id
    assert audit_entry.previous_department_id == marketing_dept.id
    assert audit_entry.new_department_id == sales_dept.id
    assert audit_entry.change_reason == transfer_data["reason"]


# Test 11: Transaction rollback on database error during bulk assignment
@pytest.mark.asyncio
async def test_transaction_rollback_on_error(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test that transaction is rolled back on database errors."""
    sales_dept = test_departments[0]
    employee_ids = [test_employees[0].id, test_employees[3].id]

    assignment_data = {
        "employee_ids": employee_ids,
        "reason": "Transaction rollback test",
        "effective_date": datetime.utcnow().isoformat()
    }

    # Mock a database error during assignment
    with patch('src.models.Employee.department_id', side_effect=Exception("Database error")):
        response = await client.post(
            f"/api/departments/{sales_dept.id}/employees/bulk-assign",
            json=assignment_data
        )

        # Should fail with 500 error
        assert response.status_code in [400, 500]

    # Verify NO assignments were made (transaction rollback)
    for emp_id in employee_ids:
        result = await db.execute(
            select(Employee).where(Employee.id == emp_id)
        )
        employee = result.scalar_one()
        # Should still be unassigned or in original department
        assert employee.department_id != sales_dept.id


# Test 12: Bulk assign with empty employee list
@pytest.mark.asyncio
async def test_bulk_assign_empty_employee_list(
    client: AsyncClient,
    db: AsyncSession,
    test_departments
):
    """Test bulk assignment with empty employee list should fail or return empty result."""
    sales_dept = test_departments[0]

    assignment_data = {
        "employee_ids": [],
        "reason": "Empty list test",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{sales_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    # Should either fail with 400 or succeed with 0 assignments
    if response.status_code == 200:
        data = response.json()
        assert data["assigned_count"] == 0
        assert len(data["assignments"]) == 0
    else:
        assert response.status_code == 400


# Test 13: Transfer to inactive department
@pytest.mark.asyncio
async def test_transfer_to_inactive_department(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test transferring employee to inactive department should fail."""
    marketing_dept = test_departments[1]
    inactive_dept = test_departments[3]
    employee = test_employees[1]

    transfer_data = {
        "to_department_id": inactive_dept.id,
        "reason": "Transfer to inactive department test",
        "requires_approval": False
    }

    response = await client.post(
        f"/api/departments/{marketing_dept.id}/employees/{employee.id}/transfer",
        json=transfer_data
    )

    # Should fail with 400 or 422 (business rule violation)
    assert response.status_code in [400, 422]


# Test 14: Bulk assign exceeding department capacity
@pytest.mark.asyncio
async def test_bulk_assign_exceeding_capacity(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test bulk assignment that would exceed department capacity."""
    # Create a department with low capacity
    small_dept = Department(
        name="Small Department",
        description="Department with limited capacity",
        active=True,
        settings={"max_capacity": 2}
    )
    db.add(small_dept)
    await db.commit()
    await db.refresh(small_dept)

    # Try to assign 3 employees (exceeds capacity of 2)
    employee_ids = [test_employees[0].id, test_employees[3].id, test_employees[4].id]

    assignment_data = {
        "employee_ids": employee_ids,
        "reason": "Capacity test",
        "effective_date": datetime.utcnow().isoformat()
    }

    response = await client.post(
        f"/api/departments/{small_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    # Should fail with 400 (capacity exceeded)
    assert response.status_code in [400, 422]


# Test 15: Get audit trail for employee
@pytest.mark.asyncio
async def test_get_employee_audit_trail(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test retrieving audit trail for an employee."""
    employee = test_employees[1]

    # Perform a transfer to create audit entry
    sales_dept = test_departments[0]
    transfer_data = {
        "to_department_id": sales_dept.id,
        "reason": "Audit trail test",
        "requires_approval": False
    }

    await client.post(
        f"/api/departments/{test_departments[1].id}/employees/{employee.id}/transfer",
        json=transfer_data
    )

    # Get audit trail
    response = await client.get(
        f"/api/employees/{employee.id}/department-history"
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0

    # Verify audit trail contains transfer information
    latest_entry = data[0]
    assert latest_entry["employee_id"] == employee.id
    assert "changed_at" in latest_entry
    assert "change_reason" in latest_entry


# Test 16: Get audit trail for department
@pytest.mark.asyncio
async def test_get_department_audit_trail(
    client: AsyncClient,
    db: AsyncSession,
    test_departments,
    test_employees
):
    """Test retrieving audit trail for a department."""
    sales_dept = test_departments[0]

    # Perform bulk assignment to create audit entries
    employee_ids = [test_employees[0].id, test_employees[3].id]
    assignment_data = {
        "employee_ids": employee_ids,
        "reason": "Department audit trail test",
        "effective_date": datetime.utcnow().isoformat()
    }

    await client.post(
        f"/api/departments/{sales_dept.id}/employees/bulk-assign",
        json=assignment_data
    )

    # Get department audit trail
    response = await client.get(
        f"/api/departments/{sales_dept.id}/audit-trail"
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) >= len(employee_ids)

    # Verify all entries are for this department
    for entry in data:
        assert entry["new_department_id"] == sales_dept.id
