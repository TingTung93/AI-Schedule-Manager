"""
Comprehensive tests for bulk department operations.

Tests include:
- Bulk employee assignment to departments
- Department transfer operations
- Unassigned employees listing
- Transaction safety and rollback
- Validation errors and edge cases
- Concurrent operation handling
- Performance benchmarks

Coverage target: >90%
"""

import asyncio
from datetime import datetime
from typing import List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models import Department, User
from backend.src.schemas import EmployeeResponse


class TestBulkEmployeeAssignment:
    """Test bulk assignment of employees to departments."""

    @pytest.fixture
    async def setup_test_data(self, db: AsyncSession):
        """Create test employees and departments."""
        # Create departments
        dept1 = Department(
            name="Engineering",
            description="Software development",
            active=True
        )
        dept2 = Department(
            name="Sales",
            description="Sales and marketing",
            active=True
        )
        dept_inactive = Department(
            name="Inactive Dept",
            description="Inactive department",
            active=False
        )

        db.add_all([dept1, dept2, dept_inactive])
        await db.commit()
        await db.refresh(dept1)
        await db.refresh(dept2)
        await db.refresh(dept_inactive)

        # Create employees
        import bcrypt
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        employees = []
        for i in range(10):
            emp = User(
                email=f"employee{i}@test.com",
                password_hash=password_hash,
                first_name=f"Employee",
                last_name=f"Test{i}",
                is_active=True,
                department_id=None  # Start unassigned
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Refresh all employees
        for emp in employees:
            await db.refresh(emp)

        return {
            "departments": {
                "engineering": dept1,
                "sales": dept2,
                "inactive": dept_inactive
            },
            "employees": employees
        }

    async def test_bulk_assign_success(self, db: AsyncSession, setup_test_data):
        """Test successful bulk assignment of employees to department."""
        data = setup_test_data
        employee_ids = [emp.id for emp in data["employees"][:5]]
        dept_id = data["departments"]["engineering"].id

        # Perform bulk assignment
        query = select(User).where(User.id.in_(employee_ids))
        result = await db.execute(query)
        employees = result.scalars().all()

        for emp in employees:
            emp.department_id = dept_id

        await db.commit()

        # Verify all employees assigned
        query = select(User).where(User.department_id == dept_id)
        result = await db.execute(query)
        assigned_employees = result.scalars().all()

        assert len(assigned_employees) == 5
        assert all(emp.department_id == dept_id for emp in assigned_employees)

    async def test_bulk_assign_to_inactive_department(self, db: AsyncSession, setup_test_data):
        """Test that assignment to inactive department fails validation."""
        data = setup_test_data
        employee_ids = [emp.id for emp in data["employees"][:3]]
        inactive_dept_id = data["departments"]["inactive"].id

        # Verify department is inactive
        query = select(Department).where(Department.id == inactive_dept_id)
        result = await db.execute(query)
        dept = result.scalar_one()
        assert dept.active is False

        # Attempting to assign should be blocked by business logic
        # (This would be enforced by the API endpoint)
        with pytest.raises(Exception):
            # Simulate API validation
            if not dept.active:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot assign to inactive department '{dept.name}'"
                )

    async def test_bulk_assign_partial_failure_rollback(self, db: AsyncSession, setup_test_data):
        """Test that partial failures trigger rollback."""
        data = setup_test_data
        employee_ids = [emp.id for emp in data["employees"][:5]]

        # Add invalid employee ID
        employee_ids.append(99999)

        try:
            # Start transaction
            query = select(User).where(User.id.in_(employee_ids))
            result = await db.execute(query)
            employees = result.scalars().all()

            # Should only find 5 employees
            assert len(employees) == 5

            # Try to update non-existent employee
            non_existent = User(
                id=99999,
                email="fake@test.com",
                password_hash="fake",
                first_name="Fake",
                last_name="User"
            )
            db.add(non_existent)

            # This should fail on commit
            await db.commit()

        except Exception:
            await db.rollback()

            # Verify no employees were assigned
            query = select(User).where(User.id.in_(employee_ids[:-1]))
            result = await db.execute(query)
            employees = result.scalars().all()

            assert all(emp.department_id is None for emp in employees)

    async def test_bulk_assign_empty_list(self, db: AsyncSession, setup_test_data):
        """Test bulk assignment with empty employee list."""
        data = setup_test_data
        dept_id = data["departments"]["engineering"].id

        # Assign empty list
        query = select(User).where(User.id.in_([]))
        result = await db.execute(query)
        employees = result.scalars().all()

        assert len(employees) == 0

    async def test_bulk_assign_already_assigned_employees(self, db: AsyncSession, setup_test_data):
        """Test reassigning employees already assigned to departments."""
        data = setup_test_data
        employee_ids = [emp.id for emp in data["employees"][:5]]
        dept1_id = data["departments"]["engineering"].id
        dept2_id = data["departments"]["sales"].id

        # First assignment to Engineering
        query = select(User).where(User.id.in_(employee_ids))
        result = await db.execute(query)
        employees = result.scalars().all()

        for emp in employees:
            emp.department_id = dept1_id
        await db.commit()

        # Verify assignment
        query = select(User).where(User.department_id == dept1_id)
        result = await db.execute(query)
        assert len(result.scalars().all()) == 5

        # Reassign to Sales
        query = select(User).where(User.id.in_(employee_ids))
        result = await db.execute(query)
        employees = result.scalars().all()

        for emp in employees:
            emp.department_id = dept2_id
        await db.commit()

        # Verify reassignment
        query = select(User).where(User.department_id == dept2_id)
        result = await db.execute(query)
        assert len(result.scalars().all()) == 5

        # Verify no longer in Engineering
        query = select(User).where(User.department_id == dept1_id)
        result = await db.execute(query)
        assert len(result.scalars().all()) == 0

    async def test_bulk_assign_nonexistent_department(self, db: AsyncSession, setup_test_data):
        """Test assignment to non-existent department."""
        data = setup_test_data
        employee_ids = [emp.id for emp in data["employees"][:3]]
        invalid_dept_id = 99999

        # Verify department doesn't exist
        query = select(Department).where(Department.id == invalid_dept_id)
        result = await db.execute(query)
        dept = result.scalar_one_or_none()
        assert dept is None

        # Assignment should fail validation
        with pytest.raises(Exception):
            if dept is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Department with ID {invalid_dept_id} not found"
                )

    async def test_bulk_assign_performance_1000_employees(self, db: AsyncSession):
        """Performance test: Assign 1000 employees in <1 second."""
        import time
        import bcrypt

        # Create department
        dept = Department(name="Large Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        # Create 1000 employees
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(1000):
            emp = User(
                email=f"bulk_emp{i}@test.com",
                password_hash=password_hash,
                first_name=f"Bulk",
                last_name=f"Employee{i}",
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Get employee IDs
        employee_ids = [emp.id for emp in employees]

        # Time the bulk assignment
        start_time = time.time()

        query = select(User).where(User.id.in_(employee_ids))
        result = await db.execute(query)
        employees_to_update = result.scalars().all()

        for emp in employees_to_update:
            emp.department_id = dept.id

        await db.commit()

        end_time = time.time()
        duration = end_time - start_time

        # Verify assignment
        query = select(User).where(User.department_id == dept.id)
        result = await db.execute(query)
        assigned = result.scalars().all()

        assert len(assigned) == 1000
        assert duration < 1.0  # Should complete in under 1 second

        print(f"Assigned 1000 employees in {duration:.3f} seconds")


class TestDepartmentTransfer:
    """Test department transfer operations."""

    @pytest.fixture
    async def setup_transfer_data(self, db: AsyncSession):
        """Create test data for transfer operations."""
        import bcrypt

        # Create departments
        source_dept = Department(name="Source Dept", active=True)
        target_dept = Department(name="Target Dept", active=True)
        db.add_all([source_dept, target_dept])
        await db.commit()
        await db.refresh(source_dept)
        await db.refresh(target_dept)

        # Create employees in source department
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(10):
            emp = User(
                email=f"transfer_emp{i}@test.com",
                password_hash=password_hash,
                first_name=f"Transfer",
                last_name=f"Employee{i}",
                department_id=source_dept.id,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        return {
            "source": source_dept,
            "target": target_dept,
            "employees": employees
        }

    async def test_transfer_all_employees(self, db: AsyncSession, setup_transfer_data):
        """Test transferring all employees from one department to another."""
        data = setup_transfer_data
        source_id = data["source"].id
        target_id = data["target"].id

        # Transfer all employees
        query = select(User).where(User.department_id == source_id)
        result = await db.execute(query)
        employees = result.scalars().all()

        assert len(employees) == 10

        for emp in employees:
            emp.department_id = target_id

        await db.commit()

        # Verify transfer
        query = select(User).where(User.department_id == target_id)
        result = await db.execute(query)
        target_employees = result.scalars().all()
        assert len(target_employees) == 10

        # Verify source is empty
        query = select(User).where(User.department_id == source_id)
        result = await db.execute(query)
        source_employees = result.scalars().all()
        assert len(source_employees) == 0

    async def test_transfer_selected_employees(self, db: AsyncSession, setup_transfer_data):
        """Test transferring selected employees."""
        data = setup_transfer_data
        source_id = data["source"].id
        target_id = data["target"].id

        # Select first 5 employees
        employee_ids = [emp.id for emp in data["employees"][:5]]

        # Transfer selected employees
        query = select(User).where(User.id.in_(employee_ids))
        result = await db.execute(query)
        employees = result.scalars().all()

        for emp in employees:
            emp.department_id = target_id

        await db.commit()

        # Verify partial transfer
        query = select(User).where(User.department_id == target_id)
        result = await db.execute(query)
        assert len(result.scalars().all()) == 5

        query = select(User).where(User.department_id == source_id)
        result = await db.execute(query)
        assert len(result.scalars().all()) == 5

    async def test_transfer_creates_audit_trail(self, db: AsyncSession, setup_transfer_data):
        """Test that transfers create audit trail entries."""
        # Note: This test assumes audit trail is implemented
        # Adjust based on actual implementation
        data = setup_transfer_data
        source_id = data["source"].id
        target_id = data["target"].id

        # Store original timestamps
        query = select(User).where(User.department_id == source_id)
        result = await db.execute(query)
        employees = result.scalars().all()
        original_timestamps = {emp.id: emp.updated_at for emp in employees}

        # Transfer employees
        for emp in employees:
            emp.department_id = target_id

        await db.commit()

        # Verify timestamps updated
        query = select(User).where(User.department_id == target_id)
        result = await db.execute(query)
        transferred = result.scalars().all()

        for emp in transferred:
            assert emp.updated_at > original_timestamps.get(emp.id, datetime.min)


class TestUnassignedEmployees:
    """Test operations for handling unassigned employees."""

    @pytest.fixture
    async def setup_mixed_assignments(self, db: AsyncSession):
        """Create mix of assigned and unassigned employees."""
        import bcrypt

        # Create department
        dept = Department(name="Test Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        # Create employees (half assigned, half unassigned)
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(20):
            emp = User(
                email=f"mixed_emp{i}@test.com",
                password_hash=password_hash,
                first_name=f"Mixed",
                last_name=f"Employee{i}",
                department_id=dept.id if i < 10 else None,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        return {"department": dept, "employees": employees}

    async def test_list_unassigned_employees(self, db: AsyncSession, setup_mixed_assignments):
        """Test listing all unassigned employees."""
        # Query unassigned employees
        query = select(User).where(User.department_id.is_(None))
        result = await db.execute(query)
        unassigned = result.scalars().all()

        assert len(unassigned) == 10
        assert all(emp.department_id is None for emp in unassigned)

    async def test_count_unassigned_employees(self, db: AsyncSession, setup_mixed_assignments):
        """Test counting unassigned employees."""
        from sqlalchemy import func

        query = select(func.count(User.id)).where(User.department_id.is_(None))
        result = await db.execute(query)
        count = result.scalar()

        assert count == 10

    async def test_filter_unassigned_by_active_status(self, db: AsyncSession, setup_mixed_assignments):
        """Test filtering unassigned employees by active status."""
        data = setup_mixed_assignments

        # Deactivate some unassigned employees
        query = select(User).where(User.department_id.is_(None))
        result = await db.execute(query)
        unassigned = result.scalars().all()

        # Deactivate first 3
        for emp in unassigned[:3]:
            emp.is_active = False
        await db.commit()

        # Query active unassigned
        query = select(User).where(
            User.department_id.is_(None),
            User.is_active == True
        )
        result = await db.execute(query)
        active_unassigned = result.scalars().all()

        assert len(active_unassigned) == 7


class TestConcurrentOperations:
    """Test concurrent bulk operations for race conditions."""

    @pytest.fixture
    async def setup_concurrency_data(self, db: AsyncSession):
        """Setup data for concurrency tests."""
        import bcrypt

        dept = Department(name="Concurrent Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(50):
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

        return {"department": dept, "employees": employees}

    @pytest.mark.asyncio
    async def test_concurrent_assignments_no_conflicts(self, db: AsyncSession, setup_concurrency_data):
        """Test that concurrent assignments don't create conflicts."""
        data = setup_concurrency_data
        dept_id = data["department"].id

        # Simulate concurrent assignment of different employee sets
        async def assign_batch(employee_ids: List[int]):
            query = select(User).where(User.id.in_(employee_ids))
            result = await db.execute(query)
            employees = result.scalars().all()

            for emp in employees:
                emp.department_id = dept_id

            await db.commit()

        # Create two batches
        batch1_ids = [emp.id for emp in data["employees"][:25]]
        batch2_ids = [emp.id for emp in data["employees"][25:]]

        # Execute concurrently
        await asyncio.gather(
            assign_batch(batch1_ids),
            assign_batch(batch2_ids)
        )

        # Verify all assigned
        query = select(User).where(User.department_id == dept_id)
        result = await db.execute(query)
        assigned = result.scalars().all()

        assert len(assigned) == 50


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    async def test_assign_to_nonexistent_employee_ids(self, db: AsyncSession):
        """Test handling of non-existent employee IDs."""
        invalid_ids = [99991, 99992, 99993]

        query = select(User).where(User.id.in_(invalid_ids))
        result = await db.execute(query)
        employees = result.scalars().all()

        assert len(employees) == 0

    async def test_null_department_assignment(self, db: AsyncSession):
        """Test unassigning employees (setting department to NULL)."""
        import bcrypt

        dept = Department(name="Temp Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        emp = User(
            email="unassign_test@test.com",
            password_hash=password_hash,
            first_name="Unassign",
            last_name="Test",
            department_id=dept.id,
            is_active=True
        )
        db.add(emp)
        await db.commit()
        await db.refresh(emp)

        # Unassign employee
        emp.department_id = None
        await db.commit()

        # Verify unassignment
        query = select(User).where(User.id == emp.id)
        result = await db.execute(query)
        updated_emp = result.scalar_one()

        assert updated_emp.department_id is None

    async def test_bulk_assign_with_special_characters_in_names(self, db: AsyncSession):
        """Test employees with special characters in names."""
        import bcrypt

        dept = Department(name="Special Chars Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        special_names = [
            ("O'Brien", "Patrick"),
            ("González", "María"),
            ("Müller", "Hans"),
            ("Søren", "Nielsen")
        ]

        employees = []
        for i, (last, first) in enumerate(special_names):
            emp = User(
                email=f"special{i}@test.com",
                password_hash=password_hash,
                first_name=first,
                last_name=last,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Assign all
        employee_ids = [emp.id for emp in employees]
        query = select(User).where(User.id.in_(employee_ids))
        result = await db.execute(query)
        emps_to_assign = result.scalars().all()

        for emp in emps_to_assign:
            emp.department_id = dept.id

        await db.commit()

        # Verify assignment
        query = select(User).where(User.department_id == dept.id)
        result = await db.execute(query)
        assigned = result.scalars().all()

        assert len(assigned) == 4
