"""
Comprehensive tests for CRUD service operations.
Tests employee, schedule, shift CRUD operations with edge cases.

Coverage target: >80%
"""

import pytest
from datetime import date, datetime, time, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models.employee import User
from backend.src.models.schedule import Schedule
from backend.src.models.shift import Shift
from backend.src.models.department import Department
from backend.src.services.crud import CRUDService


class TestEmployeeCRUD:
    """Test employee CRUD operations."""

    @pytest.fixture
    async def crud_service(self, db_session):
        """Create CRUD service instance."""
        return CRUDService(db_session)

    @pytest.mark.asyncio
    async def test_create_employee(self, crud_service: CRUDService):
        """Test creating new employee."""
        employee_data = {
            "email": "new_emp@test.com",
            "first_name": "New",
            "last_name": "Employee",
            "password": "SecurePass123!"
        }

        employee = await crud_service.create_employee(employee_data)

        assert employee.id is not None
        assert employee.email == employee_data["email"]
        assert employee.first_name == employee_data["first_name"]

    @pytest.mark.asyncio
    async def test_get_employee_by_id(self, crud_service: CRUDService, existing_user):
        """Test retrieving employee by ID."""
        employee = await crud_service.get_employee(existing_user.id)

        assert employee is not None
        assert employee.id == existing_user.id
        assert employee.email == existing_user.email

    @pytest.mark.asyncio
    async def test_get_nonexistent_employee(self, crud_service: CRUDService):
        """Test retrieving non-existent employee returns None."""
        employee = await crud_service.get_employee(99999)

        assert employee is None

    @pytest.mark.asyncio
    async def test_update_employee(self, crud_service: CRUDService, existing_user):
        """Test updating employee information."""
        update_data = {
            "first_name": "Updated",
            "last_name": "Name"
        }

        updated = await crud_service.update_employee(existing_user.id, update_data)

        assert updated.first_name == "Updated"
        assert updated.last_name == "Name"
        assert updated.email == existing_user.email  # Unchanged

    @pytest.mark.asyncio
    async def test_delete_employee_soft(self, crud_service: CRUDService, existing_user):
        """Test soft deleting employee (marking inactive)."""
        result = await crud_service.delete_employee(existing_user.id, soft=True)

        assert result is True

        # Employee should still exist but be inactive
        employee = await crud_service.get_employee(existing_user.id)
        assert employee is not None
        assert employee.is_active is False

    @pytest.mark.asyncio
    async def test_delete_employee_hard(self, crud_service: CRUDService, db_session: AsyncSession):
        """Test hard deleting employee (permanent removal)."""
        import bcrypt

        # Create temp employee
        temp_emp = User(
            email="temp_delete@test.com",
            password_hash=bcrypt.hashpw(b"test", bcrypt.gensalt()).decode(),
            first_name="Temp",
            last_name="Delete"
        )
        db_session.add(temp_emp)
        await db_session.commit()
        await db_session.refresh(temp_emp)

        emp_id = temp_emp.id

        # Hard delete
        result = await crud_service.delete_employee(emp_id, soft=False)
        assert result is True

        # Employee should not exist
        employee = await crud_service.get_employee(emp_id)
        assert employee is None

    @pytest.mark.asyncio
    async def test_list_employees_paginated(self, crud_service: CRUDService, db_session: AsyncSession):
        """Test listing employees with pagination."""
        import bcrypt

        # Create multiple employees
        password_hash = bcrypt.hashpw(b"test", bcrypt.gensalt()).decode()
        for i in range(15):
            emp = User(
                email=f"pagination{i}@test.com",
                password_hash=password_hash,
                first_name=f"Page",
                last_name=f"User{i}"
            )
            db_session.add(emp)
        await db_session.commit()

        # Get first page
        page1 = await crud_service.list_employees(skip=0, limit=10)
        assert len(page1) == 10

        # Get second page
        page2 = await crud_service.list_employees(skip=10, limit=10)
        assert len(page2) >= 5

    @pytest.mark.asyncio
    async def test_list_employees_filtered(self, crud_service: CRUDService, db_session: AsyncSession):
        """Test listing employees with filters."""
        import bcrypt

        dept = Department(name="Filter Dept", active=True)
        db_session.add(dept)
        await db_session.commit()
        await db_session.refresh(dept)

        password_hash = bcrypt.hashpw(b"test", bcrypt.gensalt()).decode()
        for i in range(5):
            emp = User(
                email=f"filter{i}@test.com",
                password_hash=password_hash,
                first_name=f"Filter",
                last_name=f"User{i}",
                department_id=dept.id
            )
            db_session.add(emp)
        await db_session.commit()

        # Filter by department
        employees = await crud_service.list_employees(department_id=dept.id)
        assert len(employees) >= 5

    @pytest.mark.asyncio
    async def test_search_employees_by_name(self, crud_service: CRUDService, db_session: AsyncSession):
        """Test searching employees by name."""
        import bcrypt

        password_hash = bcrypt.hashpw(b"test", bcrypt.gensalt()).decode()
        emp = User(
            email="searchable@test.com",
            password_hash=password_hash,
            first_name="Unique",
            last_name="Searchable"
        )
        db_session.add(emp)
        await db_session.commit()

        # Search by first name
        results = await crud_service.search_employees("Unique")
        assert len(results) > 0
        assert any(e.first_name == "Unique" for e in results)


class TestScheduleCRUD:
    """Test schedule CRUD operations."""

    @pytest.fixture
    async def crud_service(self, db_session):
        """Create CRUD service instance."""
        return CRUDService(db_session)

    @pytest.mark.asyncio
    async def test_create_schedule(self, crud_service: CRUDService, existing_user):
        """Test creating new schedule."""
        schedule_data = {
            "name": "Test Schedule",
            "start_date": date.today(),
            "end_date": date.today() + timedelta(days=7),
            "created_by_id": existing_user.id
        }

        schedule = await crud_service.create_schedule(schedule_data)

        assert schedule.id is not None
        assert schedule.name == schedule_data["name"]
        assert schedule.start_date == schedule_data["start_date"]

    @pytest.mark.asyncio
    async def test_get_schedule_by_id(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test retrieving schedule by ID."""
        # Create schedule
        schedule = Schedule(
            name="Get Schedule Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        # Retrieve
        retrieved = await crud_service.get_schedule(schedule.id)

        assert retrieved is not None
        assert retrieved.id == schedule.id
        assert retrieved.name == schedule.name

    @pytest.mark.asyncio
    async def test_update_schedule(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test updating schedule."""
        # Create schedule
        schedule = Schedule(
            name="Original Name",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        # Update
        update_data = {"name": "Updated Name"}
        updated = await crud_service.update_schedule(schedule.id, update_data)

        assert updated.name == "Updated Name"
        assert updated.id == schedule.id

    @pytest.mark.asyncio
    async def test_delete_schedule(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test deleting schedule."""
        # Create schedule
        schedule = Schedule(
            name="Delete Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        schedule_id = schedule.id

        # Delete
        result = await crud_service.delete_schedule(schedule_id)
        assert result is True

        # Verify deleted
        deleted = await crud_service.get_schedule(schedule_id)
        assert deleted is None

    @pytest.mark.asyncio
    async def test_list_schedules_by_date_range(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test listing schedules within date range."""
        # Create schedules with different dates
        today = date.today()
        schedules = [
            Schedule(
                name="Schedule 1",
                start_date=today,
                end_date=today + timedelta(days=7),
                created_by_id=existing_user.id
            ),
            Schedule(
                name="Schedule 2",
                start_date=today + timedelta(days=30),
                end_date=today + timedelta(days=37),
                created_by_id=existing_user.id
            )
        ]
        db_session.add_all(schedules)
        await db_session.commit()

        # List schedules in range
        results = await crud_service.list_schedules(
            start_date=today,
            end_date=today + timedelta(days=14)
        )

        assert len(results) >= 1
        assert any(s.name == "Schedule 1" for s in results)

    @pytest.mark.asyncio
    async def test_publish_schedule(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test publishing schedule."""
        schedule = Schedule(
            name="Publish Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id,
            status="draft"
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        # Publish
        published = await crud_service.publish_schedule(schedule.id)

        assert published.status == "published"
        assert published.published_at is not None


class TestShiftCRUD:
    """Test shift CRUD operations."""

    @pytest.fixture
    async def crud_service(self, db_session):
        """Create CRUD service instance."""
        return CRUDService(db_session)

    @pytest.mark.asyncio
    async def test_create_shift(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test creating new shift."""
        # Create schedule first
        schedule = Schedule(
            name="Shift Test Schedule",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        shift_data = {
            "schedule_id": schedule.id,
            "start_time": datetime.combine(date.today(), time(9, 0)),
            "end_time": datetime.combine(date.today(), time(17, 0)),
            "role": "Nurse"
        }

        shift = await crud_service.create_shift(shift_data)

        assert shift.id is not None
        assert shift.schedule_id == schedule.id
        assert shift.role == "Nurse"

    @pytest.mark.asyncio
    async def test_assign_employee_to_shift(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test assigning employee to shift."""
        # Create schedule and shift
        schedule = Schedule(
            name="Assignment Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        shift = Shift(
            schedule_id=schedule.id,
            start_time=datetime.combine(date.today(), time(9, 0)),
            end_time=datetime.combine(date.today(), time(17, 0)),
            role="Doctor"
        )
        db_session.add(shift)
        await db_session.commit()
        await db_session.refresh(shift)

        # Assign employee
        assignment = await crud_service.assign_shift(shift.id, existing_user.id)

        assert assignment is not None
        assert assignment.shift_id == shift.id
        assert assignment.employee_id == existing_user.id

    @pytest.mark.asyncio
    async def test_unassign_employee_from_shift(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test unassigning employee from shift."""
        # Create and assign shift
        schedule = Schedule(
            name="Unassign Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        shift = Shift(
            schedule_id=schedule.id,
            start_time=datetime.combine(date.today(), time(9, 0)),
            end_time=datetime.combine(date.today(), time(17, 0)),
            role="Nurse"
        )
        db_session.add(shift)
        await db_session.commit()
        await db_session.refresh(shift)

        assignment = await crud_service.assign_shift(shift.id, existing_user.id)

        # Unassign
        result = await crud_service.unassign_shift(assignment.id)
        assert result is True

    @pytest.mark.asyncio
    async def test_list_shifts_by_employee(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test listing shifts assigned to employee."""
        # Create schedule and shifts
        schedule = Schedule(
            name="Employee Shifts",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        for i in range(3):
            shift = Shift(
                schedule_id=schedule.id,
                start_time=datetime.combine(date.today() + timedelta(days=i), time(9, 0)),
                end_time=datetime.combine(date.today() + timedelta(days=i), time(17, 0)),
                role="Doctor"
            )
            db_session.add(shift)
            await db_session.commit()
            await db_session.refresh(shift)
            await crud_service.assign_shift(shift.id, existing_user.id)

        # List shifts
        shifts = await crud_service.list_employee_shifts(existing_user.id)
        assert len(shifts) >= 3

    @pytest.mark.asyncio
    async def test_detect_shift_conflicts(self, crud_service: CRUDService, existing_user, db_session: AsyncSession):
        """Test detecting conflicting shifts for employee."""
        # Create schedule
        schedule = Schedule(
            name="Conflict Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        # Create overlapping shifts
        shift1 = Shift(
            schedule_id=schedule.id,
            start_time=datetime.combine(date.today(), time(9, 0)),
            end_time=datetime.combine(date.today(), time(17, 0)),
            role="Doctor"
        )
        shift2 = Shift(
            schedule_id=schedule.id,
            start_time=datetime.combine(date.today(), time(15, 0)),  # Overlaps with shift1
            end_time=datetime.combine(date.today(), time(23, 0)),
            role="Nurse"
        )
        db_session.add_all([shift1, shift2])
        await db_session.commit()
        await db_session.refresh(shift1)
        await db_session.refresh(shift2)

        # Assign first shift
        await crud_service.assign_shift(shift1.id, existing_user.id)

        # Try to assign overlapping shift - should detect conflict
        has_conflict = await crud_service.check_shift_conflict(shift2.id, existing_user.id)
        assert has_conflict is True


class TestBulkOperations:
    """Test bulk CRUD operations."""

    @pytest.fixture
    async def crud_service(self, db_session):
        """Create CRUD service instance."""
        return CRUDService(db_session)

    @pytest.mark.asyncio
    async def test_bulk_create_employees(self, crud_service: CRUDService):
        """Test creating multiple employees at once."""
        employees_data = [
            {
                "email": f"bulk{i}@test.com",
                "first_name": "Bulk",
                "last_name": f"User{i}",
                "password": "SecurePass123!"
            }
            for i in range(10)
        ]

        created = await crud_service.bulk_create_employees(employees_data)

        assert len(created) == 10
        assert all(e.id is not None for e in created)

    @pytest.mark.asyncio
    async def test_bulk_update_employees(self, crud_service: CRUDService, db_session: AsyncSession):
        """Test updating multiple employees at once."""
        import bcrypt

        # Create employees
        password_hash = bcrypt.hashpw(b"test", bcrypt.gensalt()).decode()
        employees = []
        for i in range(5):
            emp = User(
                email=f"bulkupdate{i}@test.com",
                password_hash=password_hash,
                first_name="Original",
                last_name=f"User{i}"
            )
            employees.append(emp)
        db_session.add_all(employees)
        await db_session.commit()

        for emp in employees:
            await db_session.refresh(emp)

        # Bulk update
        employee_ids = [e.id for e in employees]
        update_data = {"first_name": "Updated"}

        updated = await crud_service.bulk_update_employees(employee_ids, update_data)

        assert len(updated) == 5
        assert all(e.first_name == "Updated" for e in updated)

    @pytest.mark.asyncio
    async def test_bulk_delete_employees(self, crud_service: CRUDService, db_session: AsyncSession):
        """Test deleting multiple employees at once."""
        import bcrypt

        # Create employees
        password_hash = bcrypt.hashpw(b"test", bcrypt.gensalt()).decode()
        employees = []
        for i in range(5):
            emp = User(
                email=f"bulkdelete{i}@test.com",
                password_hash=password_hash,
                first_name="Delete",
                last_name=f"User{i}"
            )
            employees.append(emp)
        db_session.add_all(employees)
        await db_session.commit()

        employee_ids = [e.id for e in employees]

        # Bulk delete
        result = await crud_service.bulk_delete_employees(employee_ids)
        assert result is True

        # Verify deleted
        for emp_id in employee_ids:
            emp = await crud_service.get_employee(emp_id)
            assert emp is None or emp.is_active is False
