"""
Tests for schedule generation service integration.
"""

import pytest
from datetime import date, time, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from backend.src.services.schedule_service import ScheduleGenerationService
from backend.src.scheduler.constraint_solver import Employee, Shift, ShiftType


@pytest.fixture
def schedule_service():
    """Create schedule service instance."""
    return ScheduleGenerationService()


@pytest.fixture
def mock_db():
    """Create mock database session."""
    db = AsyncMock()
    return db


@pytest.fixture
def sample_employees():
    """Sample employee data for testing."""
    return [
        Employee(
            id="1",
            name="Alice Smith",
            qualifications=["cashier", "manager"],
            availability={
                "Monday": [(time(9, 0), time(17, 0))],
                "Tuesday": [(time(9, 0), time(17, 0))],
                "Wednesday": [(time(9, 0), time(17, 0))],
                "Thursday": [(time(9, 0), time(17, 0))],
                "Friday": [(time(9, 0), time(17, 0))],
            },
            max_hours_per_week=40,
        ),
        Employee(
            id="2",
            name="Bob Johnson",
            qualifications=["cashier"],
            availability={
                "Monday": [(time(10, 0), time(18, 0))],
                "Tuesday": [(time(10, 0), time(18, 0))],
                "Wednesday": [(time(10, 0), time(18, 0))],
            },
            max_hours_per_week=24,
        ),
    ]


@pytest.fixture
def sample_shifts():
    """Sample shifts for testing."""
    today = date.today()
    return [
        Shift(
            id="shift_1",
            date=today,
            start_time=time(9, 0),
            end_time=time(17, 0),
            required_qualifications=["cashier"],
            min_employees=1,
            max_employees=2,
            shift_type=ShiftType.FULL_DAY,
        ),
        Shift(
            id="shift_2",
            date=today + timedelta(days=1),
            start_time=time(9, 0),
            end_time=time(17, 0),
            required_qualifications=["cashier"],
            min_employees=1,
            max_employees=2,
            shift_type=ShiftType.FULL_DAY,
        ),
    ]


class TestScheduleGenerationService:
    """Test schedule generation service."""

    @pytest.mark.asyncio
    async def test_fetch_employees(self, schedule_service, mock_db):
        """Test fetching employees from database."""
        # Mock database response
        mock_employee = MagicMock()
        mock_employee.id = 1
        mock_employee.name = "Test Employee"
        mock_employee.active = True
        mock_employee.qualifications = ["cashier"]
        mock_employee.availability_pattern = {}
        mock_employee.max_hours_per_week = 40

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_employee]
        mock_db.execute = AsyncMock(return_value=mock_result)

        employees = await schedule_service._fetch_employees(mock_db)

        assert len(employees) == 1
        assert employees[0].id == 1

    @pytest.mark.asyncio
    async def test_fetch_shifts(self, schedule_service, mock_db):
        """Test fetching shift templates from database."""
        # Mock database response
        mock_shift = MagicMock()
        mock_shift.id = 1
        mock_shift.name = "Morning Shift"
        mock_shift.shift_type = "morning"
        mock_shift.start_time = time(9, 0)
        mock_shift.end_time = time(17, 0)
        mock_shift.required_staff = 2
        mock_shift.required_qualifications = ["cashier"]
        mock_shift.active = True

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_shift]
        mock_db.execute = AsyncMock(return_value=mock_result)

        shifts = await schedule_service._fetch_shifts(mock_db)

        assert len(shifts) == 1
        assert shifts[0].id == 1

    def test_convert_employees(self, schedule_service):
        """Test converting database employees to solver format."""
        # Create mock DB employee
        db_employee = MagicMock()
        db_employee.id = 1
        db_employee.name = "Test Employee"
        db_employee.qualifications = ["cashier", "manager"]
        db_employee.availability_pattern = {
            "Monday": [{"start": "09:00", "end": "17:00"}],
            "Tuesday": [{"start": "09:00", "end": "17:00"}],
        }
        db_employee.max_hours_per_week = 40

        employees = schedule_service._convert_employees([db_employee])

        assert len(employees) == 1
        assert employees[0].id == "1"
        assert employees[0].name == "Test Employee"
        assert "cashier" in employees[0].qualifications
        assert "Monday" in employees[0].availability

    def test_generate_shifts_for_dates(self, schedule_service):
        """Test generating shift instances for date range."""
        # Create mock shift template
        template = MagicMock()
        template.id = 1
        template.shift_type = "morning"
        template.start_time = time(9, 0)
        template.end_time = time(17, 0)
        template.required_staff = 2
        template.required_qualifications = ["cashier"]

        start_date = date.today()
        end_date = start_date + timedelta(days=2)

        shifts = schedule_service._generate_shifts_for_dates([template], start_date, end_date)

        # Should generate 3 shifts (3 days)
        assert len(shifts) == 3
        assert all(s.shift_type == ShiftType.MORNING for s in shifts)

    @pytest.mark.asyncio
    async def test_check_conflicts_double_booking(self, schedule_service, mock_db):
        """Test detecting double booking conflicts."""
        # Mock schedules with same employee on same date
        mock_schedule1 = MagicMock()
        mock_schedule1.id = 1
        mock_schedule1.employee_id = 1
        mock_schedule1.shift_id = 1
        mock_schedule1.date = date.today()

        mock_schedule2 = MagicMock()
        mock_schedule2.id = 2
        mock_schedule2.employee_id = 1  # Same employee
        mock_schedule2.shift_id = 2
        mock_schedule2.date = date.today()  # Same date

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_schedule1, mock_schedule2]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.get = AsyncMock(return_value=None)

        conflicts = await schedule_service.check_conflicts(mock_db, date.today(), date.today())

        assert conflicts["conflict_count"] > 0
        assert any(c["type"] == "double_booking" for c in conflicts["conflicts"])

    @pytest.mark.asyncio
    async def test_check_conflicts_qualification_mismatch(self, schedule_service, mock_db):
        """Test detecting qualification mismatch conflicts."""
        # Mock employee without required qualification
        mock_employee = MagicMock()
        mock_employee.id = 1
        mock_employee.qualifications = ["cashier"]

        # Mock shift requiring manager qualification
        mock_shift = MagicMock()
        mock_shift.id = 1
        mock_shift.required_qualifications = ["manager", "supervisor"]

        mock_schedule = MagicMock()
        mock_schedule.id = 1
        mock_schedule.employee_id = 1
        mock_schedule.shift_id = 1
        mock_schedule.date = date.today()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_schedule]

        async def mock_get(model, id):
            if id == 1:
                return mock_employee if model.__name__ == "Employee" else mock_shift
            return None

        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.get = AsyncMock(side_effect=mock_get)

        conflicts = await schedule_service.check_conflicts(mock_db, date.today(), date.today())

        # Should detect qualification mismatch
        assert any(c["type"] == "qualification_mismatch" for c in conflicts["conflicts"])

    def test_parse_time(self, schedule_service):
        """Test time parsing helper."""
        # Test string parsing
        t1 = schedule_service._parse_time("14:30")
        assert t1.hour == 14
        assert t1.minute == 30

        # Test time object passthrough
        t2 = time(10, 15)
        result = schedule_service._parse_time(t2)
        assert result == t2

        # Test invalid input (should default to 9:00)
        t3 = schedule_service._parse_time("invalid")
        assert t3.hour == 9
        assert t3.minute == 0


class TestScheduleIntegration:
    """Integration tests for schedule generation."""

    @pytest.mark.asyncio
    async def test_full_schedule_generation_flow(self, schedule_service, mock_db):
        """Test complete schedule generation flow."""
        # Mock all database calls
        mock_employee = MagicMock()
        mock_employee.id = 1
        mock_employee.name = "Test Employee"
        mock_employee.active = True
        mock_employee.qualifications = ["cashier"]
        mock_employee.availability_pattern = {
            "Monday": [{"start": "09:00", "end": "17:00"}],
        }
        mock_employee.max_hours_per_week = 40

        mock_shift = MagicMock()
        mock_shift.id = 1
        mock_shift.name = "Morning Shift"
        mock_shift.shift_type = "morning"
        mock_shift.start_time = time(9, 0)
        mock_shift.end_time = time(17, 0)
        mock_shift.required_staff = 1
        mock_shift.required_qualifications = ["cashier"]
        mock_shift.active = True

        # Setup mock returns
        mock_emp_result = MagicMock()
        mock_emp_result.scalars.return_value.all.return_value = [mock_employee]

        mock_shift_result = MagicMock()
        mock_shift_result.scalars.return_value.all.return_value = [mock_shift]

        mock_rule_result = MagicMock()
        mock_rule_result.scalars.return_value.all.return_value = []

        mock_db.execute = AsyncMock(
            side_effect=[mock_emp_result, mock_shift_result, mock_rule_result, MagicMock()]
        )
        mock_db.commit = AsyncMock()

        # Generate schedule for one day
        start_date = date.today()
        end_date = start_date

        result = await schedule_service.generate_schedule(mock_db, start_date, end_date)

        # Verify result structure
        assert "status" in result
        assert "schedule" in result
        assert result["status"] in ["optimal", "feasible", "fallback", "error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
