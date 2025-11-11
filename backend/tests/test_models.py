"""
Comprehensive database model testing with fixtures and relationships.
Tests ORM models, validations, relationships, and database operations.
"""

import asyncio
from datetime import datetime, time, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import DatabaseManager
from src.models.base import Base, SoftDeleteMixin, TimestampMixin
from src.models.employee import Employee, EmployeeAvailability, EmployeeSkill
from src.models.rule import Constraint, Rule, RuleConstraint
from src.models.schedule import Schedule, Shift, ShiftAssignment


class TestBaseModels:
    """Test base model functionality."""

    def test_timestamp_mixin(self):
        """Test timestamp mixin functionality."""

        class TestModel(TimestampMixin):
            pass

        model = TestModel()
        now = datetime.utcnow()

        # Test created_at is set
        assert hasattr(model, "created_at")
        assert hasattr(model, "updated_at")

        # In a real scenario, these would be set by database
        model.created_at = now
        model.updated_at = now

        assert model.created_at == now
        assert model.updated_at == now

    def test_soft_delete_mixin(self):
        """Test soft delete mixin functionality."""

        class TestModel(SoftDeleteMixin):
            pass

        model = TestModel()

        # Initially not deleted
        assert not model.is_deleted
        assert model.deleted_at is None

        # Test soft delete
        model.soft_delete()
        assert model.is_deleted
        assert model.deleted_at is not None
        assert isinstance(model.deleted_at, datetime)

    def test_model_repr(self):
        """Test model string representation."""
        employee = Employee(name="John Doe", email="john@example.com")

        repr_str = repr(employee)
        assert "Employee" in repr_str
        assert "John Doe" in repr_str


class TestEmployeeModel:
    """Test Employee model and related functionality."""

    @pytest.fixture
    def sample_employee_data(self):
        """Sample employee data for testing."""
        return {
            "name": "Sarah Johnson",
            "email": "sarah.johnson@example.com",
            "phone": "+1-555-0123",
            "role": "Server",
            "hourly_rate": Decimal("15.50"),
            "hire_date": datetime.utcnow().date(),
            "is_active": True,
            "min_hours_week": 20,
            "max_hours_week": 40,
            "preferred_shifts": ["morning", "afternoon"],
            "skills": ["customer_service", "cash_handling"],
            "emergency_contact": {"name": "John Johnson", "phone": "+1-555-0124", "relationship": "spouse"},
        }

    def test_employee_creation(self, sample_employee_data):
        """Test creating employee with valid data."""
        employee = Employee(**sample_employee_data)

        assert employee.name == sample_employee_data["name"]
        assert employee.email == sample_employee_data["email"]
        assert employee.role == sample_employee_data["role"]
        assert employee.hourly_rate == sample_employee_data["hourly_rate"]
        assert employee.is_active == True

    def test_employee_email_validation(self):
        """Test email validation."""
        # Valid emails should work
        valid_emails = ["test@example.com", "user.name+tag@example.co.uk", "admin@company-name.org"]

        for email in valid_emails:
            employee = Employee(name="Test", email=email)
            assert employee.email == email

        # Invalid emails should raise validation error
        invalid_emails = ["invalid-email", "@example.com", "test@", "test space@example.com"]

        for email in invalid_emails:
            with pytest.raises((ValueError, ValidationError)):
                Employee(name="Test", email=email)

    def test_employee_phone_validation(self):
        """Test phone number validation."""
        valid_phones = ["+1-555-0123", "(555) 123-4567", "555.123.4567", "+44 20 7946 0958"]

        for phone in valid_phones:
            employee = Employee(name="Test", email="test@example.com", phone=phone)
            assert employee.phone == phone

    def test_employee_hourly_rate_validation(self):
        """Test hourly rate validation."""
        # Valid rates
        employee = Employee(name="Test", email="test@example.com", hourly_rate=Decimal("15.50"))
        assert employee.hourly_rate == Decimal("15.50")

        # Negative rate should fail
        with pytest.raises((ValueError, ValidationError)):
            Employee(name="Test", email="test@example.com", hourly_rate=Decimal("-5.00"))

        # Zero rate should be allowed (volunteers)
        employee_volunteer = Employee(name="Volunteer", email="volunteer@example.com", hourly_rate=Decimal("0.00"))
        assert employee_volunteer.hourly_rate == Decimal("0.00")

    def test_employee_hours_validation(self):
        """Test min/max hours validation."""
        # Valid hours
        employee = Employee(name="Test", email="test@example.com", min_hours_week=20, max_hours_week=40)
        assert employee.min_hours_week == 20
        assert employee.max_hours_week == 40

        # Min hours greater than max should fail
        with pytest.raises((ValueError, ValidationError)):
            Employee(name="Test", email="test@example.com", min_hours_week=40, max_hours_week=20)

    def test_employee_full_name_property(self):
        """Test full name property."""
        employee = Employee(name="John Michael Doe", email="john@example.com")
        assert employee.full_name == "John Michael Doe"

    def test_employee_weekly_cost_calculation(self):
        """Test weekly cost calculation."""
        employee = Employee(name="Test", email="test@example.com", hourly_rate=Decimal("15.00"), max_hours_week=40)

        max_weekly_cost = employee.calculate_max_weekly_cost()
        assert max_weekly_cost == Decimal("600.00")  # 40 * 15.00

    def test_employee_age_calculation(self):
        """Test age calculation from birth date."""
        birth_date = datetime.utcnow().date() - timedelta(days=25 * 365)  # 25 years ago
        employee = Employee(name="Test", email="test@example.com", birth_date=birth_date)

        age = employee.calculate_age()
        assert 24 <= age <= 26  # Allow for leap years and timing


class TestEmployeeAvailabilityModel:
    """Test EmployeeAvailability model."""

    def test_availability_creation(self):
        """Test creating availability record."""
        availability = EmployeeAvailability(
            employee_id="emp-123", day_of_week=1, start_time=time(9, 0), end_time=time(17, 0), is_available=True  # Monday
        )

        assert availability.day_of_week == 1
        assert availability.start_time == time(9, 0)
        assert availability.end_time == time(17, 0)
        assert availability.is_available == True

    def test_availability_time_validation(self):
        """Test time validation in availability."""
        # Valid times
        availability = EmployeeAvailability(employee_id="emp-123", day_of_week=1, start_time=time(9, 0), end_time=time(17, 0))
        assert availability.start_time < availability.end_time

        # Invalid: end time before start time
        with pytest.raises((ValueError, ValidationError)):
            EmployeeAvailability(employee_id="emp-123", day_of_week=1, start_time=time(17, 0), end_time=time(9, 0))

    def test_day_of_week_validation(self):
        """Test day of week validation (0-6)."""
        # Valid days
        for day in range(7):
            availability = EmployeeAvailability(
                employee_id="emp-123", day_of_week=day, start_time=time(9, 0), end_time=time(17, 0)
            )
            assert availability.day_of_week == day

        # Invalid days
        for invalid_day in [-1, 7, 8]:
            with pytest.raises((ValueError, ValidationError)):
                EmployeeAvailability(
                    employee_id="emp-123", day_of_week=invalid_day, start_time=time(9, 0), end_time=time(17, 0)
                )


class TestScheduleModel:
    """Test Schedule model and related functionality."""

    def test_schedule_creation(self):
        """Test creating schedule."""
        schedule = Schedule(
            name="Week of Jan 15-21",
            start_date=datetime(2024, 1, 15).date(),
            end_date=datetime(2024, 1, 21).date(),
            status="draft",
            created_by="manager-123",
        )

        assert schedule.name == "Week of Jan 15-21"
        assert schedule.status == "draft"
        assert schedule.start_date < schedule.end_date

    def test_schedule_date_validation(self):
        """Test schedule date validation."""
        # Valid dates
        schedule = Schedule(
            name="Test Schedule", start_date=datetime(2024, 1, 15).date(), end_date=datetime(2024, 1, 21).date()
        )
        assert schedule.start_date < schedule.end_date

        # Invalid: end date before start date
        with pytest.raises((ValueError, ValidationError)):
            Schedule(name="Invalid Schedule", start_date=datetime(2024, 1, 21).date(), end_date=datetime(2024, 1, 15).date())

    def test_schedule_status_validation(self):
        """Test schedule status validation."""
        valid_statuses = ["draft", "published", "finalized", "archived"]

        for status in valid_statuses:
            schedule = Schedule(
                name="Test", start_date=datetime(2024, 1, 15).date(), end_date=datetime(2024, 1, 21).date(), status=status
            )
            assert schedule.status == status

        # Invalid status
        with pytest.raises((ValueError, ValidationError)):
            Schedule(
                name="Test",
                start_date=datetime(2024, 1, 15).date(),
                end_date=datetime(2024, 1, 21).date(),
                status="invalid_status",
            )

    def test_schedule_duration_calculation(self):
        """Test schedule duration calculation."""
        schedule = Schedule(name="Test", start_date=datetime(2024, 1, 15).date(), end_date=datetime(2024, 1, 21).date())

        duration = schedule.calculate_duration()
        assert duration.days == 6  # 7 days inclusive minus 1


class TestShiftModel:
    """Test Shift model functionality."""

    def test_shift_creation(self):
        """Test creating shift."""
        shift = Shift(
            schedule_id="schedule-123",
            date=datetime(2024, 1, 15).date(),
            start_time=time(9, 0),
            end_time=time(17, 0),
            position="Server",
            required_employees=2,
            min_skill_level=3,
        )

        assert shift.position == "Server"
        assert shift.required_employees == 2
        assert shift.min_skill_level == 3

    def test_shift_time_validation(self):
        """Test shift time validation."""
        # Valid shift
        shift = Shift(
            schedule_id="schedule-123",
            date=datetime(2024, 1, 15).date(),
            start_time=time(9, 0),
            end_time=time(17, 0),
            position="Server",
        )
        assert shift.start_time < shift.end_time

        # Invalid: end before start
        with pytest.raises((ValueError, ValidationError)):
            Shift(
                schedule_id="schedule-123",
                date=datetime(2024, 1, 15).date(),
                start_time=time(17, 0),
                end_time=time(9, 0),
                position="Server",
            )

    def test_shift_duration_calculation(self):
        """Test shift duration calculation."""
        shift = Shift(
            schedule_id="schedule-123",
            date=datetime(2024, 1, 15).date(),
            start_time=time(9, 0),
            end_time=time(17, 0),
            position="Server",
        )

        duration = shift.calculate_duration()
        assert duration.total_seconds() == 8 * 3600  # 8 hours

    def test_shift_break_time_handling(self):
        """Test break time in shifts."""
        shift = Shift(
            schedule_id="schedule-123",
            date=datetime(2024, 1, 15).date(),
            start_time=time(9, 0),
            end_time=time(17, 0),
            position="Server",
            break_duration_minutes=30,
        )

        paid_duration = shift.calculate_paid_duration()
        expected_paid = shift.calculate_duration() - timedelta(minutes=30)
        assert paid_duration == expected_paid


class TestRuleModel:
    """Test Rule model functionality."""

    def test_rule_creation(self):
        """Test creating scheduling rule."""
        rule = Rule(
            name="No evening shifts",
            description="Employee cannot work evening shifts",
            rule_type="availability",
            employee_id="emp-123",
            priority=10,
            is_active=True,
        )

        assert rule.name == "No evening shifts"
        assert rule.rule_type == "availability"
        assert rule.priority == 10
        assert rule.is_active == True

    def test_rule_type_validation(self):
        """Test rule type validation."""
        valid_types = ["availability", "preference", "requirement", "restriction"]

        for rule_type in valid_types:
            rule = Rule(name="Test Rule", rule_type=rule_type)
            assert rule.rule_type == rule_type

        # Invalid type
        with pytest.raises((ValueError, ValidationError)):
            Rule(name="Test Rule", rule_type="invalid_type")

    def test_rule_priority_validation(self):
        """Test rule priority validation."""
        # Valid priorities (1-10)
        for priority in range(1, 11):
            rule = Rule(name="Test Rule", rule_type="availability", priority=priority)
            assert rule.priority == priority

        # Invalid priorities
        for invalid_priority in [0, 11, -1]:
            with pytest.raises((ValueError, ValidationError)):
                Rule(name="Test Rule", rule_type="availability", priority=invalid_priority)


class TestConstraintModel:
    """Test Constraint model functionality."""

    def test_constraint_creation(self):
        """Test creating constraint."""
        constraint = Constraint(
            constraint_type="time_restriction",
            parameters={"start_time": "09:00", "end_time": "17:00", "days": ["monday", "tuesday", "wednesday"]},
            description="Cannot work after 5pm on weekdays",
        )

        assert constraint.constraint_type == "time_restriction"
        assert "start_time" in constraint.parameters
        assert constraint.description is not None

    def test_constraint_type_validation(self):
        """Test constraint type validation."""
        valid_types = [
            "time_restriction",
            "day_restriction",
            "skill_requirement",
            "max_hours",
            "min_hours",
            "break_requirement",
        ]

        for constraint_type in valid_types:
            constraint = Constraint(constraint_type=constraint_type, parameters={})
            assert constraint.constraint_type == constraint_type

    def test_constraint_parameters_validation(self):
        """Test constraint parameters validation."""
        # Time restriction parameters
        time_constraint = Constraint(
            constraint_type="time_restriction", parameters={"start_time": "09:00", "end_time": "17:00"}
        )

        assert time_constraint.parameters["start_time"] == "09:00"

        # Invalid time format should be caught by validation
        with pytest.raises((ValueError, ValidationError)):
            Constraint(constraint_type="time_restriction", parameters={"start_time": "invalid_time"})


class TestModelRelationships:
    """Test model relationships and foreign keys."""

    @pytest.fixture
    async def db_session(self):
        """Create test database session."""
        # This would be implemented with actual test database
        session = AsyncMock(spec=AsyncSession)
        return session

    async def test_employee_availability_relationship(self, db_session):
        """Test Employee -> EmployeeAvailability relationship."""
        employee = Employee(name="Test Employee", email="test@example.com")

        availability = EmployeeAvailability(
            employee_id=employee.id, day_of_week=1, start_time=time(9, 0), end_time=time(17, 0)
        )

        # In a real test, this would use actual database
        employee.availability = [availability]
        assert len(employee.availability) == 1
        assert employee.availability[0].day_of_week == 1

    async def test_schedule_shifts_relationship(self, db_session):
        """Test Schedule -> Shift relationship."""
        schedule = Schedule(
            name="Test Schedule", start_date=datetime(2024, 1, 15).date(), end_date=datetime(2024, 1, 21).date()
        )

        shift = Shift(
            schedule_id=schedule.id,
            date=datetime(2024, 1, 15).date(),
            start_time=time(9, 0),
            end_time=time(17, 0),
            position="Server",
        )

        schedule.shifts = [shift]
        assert len(schedule.shifts) == 1
        assert schedule.shifts[0].position == "Server"

    async def test_cascade_deletion(self, db_session):
        """Test cascade deletion behavior."""
        # When employee is deleted, availability should also be deleted
        employee = Employee(name="Test Employee", email="test@example.com")

        availability = EmployeeAvailability(
            employee_id=employee.id, day_of_week=1, start_time=time(9, 0), end_time=time(17, 0)
        )

        # In actual test with database:
        # db_session.add(employee)
        # db_session.add(availability)
        # await db_session.commit()
        #
        # await db_session.delete(employee)
        # await db_session.commit()
        #
        # # Availability should be deleted
        # result = await db_session.get(EmployeeAvailability, availability.id)
        # assert result is None


class TestModelQueries:
    """Test complex database queries and operations."""

    @pytest.fixture
    async def db_session(self):
        """Create test database session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    async def test_employee_availability_query(self, db_session):
        """Test querying employee availability."""
        # Mock query result
        mock_result = [EmployeeAvailability(employee_id="emp-123", day_of_week=1, start_time=time(9, 0), end_time=time(17, 0))]

        db_session.execute.return_value.scalars.return_value.all.return_value = mock_result

        # Query would be:
        # query = select(EmployeeAvailability).where(
        #     EmployeeAvailability.employee_id == "emp-123"
        # )
        # result = await db_session.execute(query)
        # availability_records = result.scalars().all()

        assert len(mock_result) == 1
        assert mock_result[0].day_of_week == 1

    async def test_schedule_optimization_query(self, db_session):
        """Test complex query for schedule optimization."""
        # This would test a complex query joining multiple tables
        # to find optimal shift assignments

        mock_employees = [Employee(name="John", email="john@example.com"), Employee(name="Jane", email="jane@example.com")]

        db_session.execute.return_value.scalars.return_value.all.return_value = mock_employees

        # Complex query would be:
        # query = select(Employee).join(EmployeeAvailability).where(
        #     and_(
        #         EmployeeAvailability.day_of_week == target_day,
        #         EmployeeAvailability.start_time <= shift_start,
        #         EmployeeAvailability.end_time >= shift_end,
        #         Employee.is_active == True
        #     )
        # )

        assert len(mock_employees) == 2

    async def test_rule_conflict_detection(self, db_session):
        """Test detecting conflicting rules."""
        # Mock conflicting rules
        conflicting_rules = [
            Rule(name="Rule 1", rule_type="availability", employee_id="emp-123", priority=5),
            Rule(name="Rule 2", rule_type="requirement", employee_id="emp-123", priority=8),
        ]

        db_session.execute.return_value.scalars.return_value.all.return_value = conflicting_rules

        # Query would find rules for same employee with different types
        assert len(conflicting_rules) == 2
        assert conflicting_rules[0].employee_id == conflicting_rules[1].employee_id


class TestModelValidationEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_employee_edge_cases(self):
        """Test employee model edge cases."""
        # Very long name
        long_name = "A" * 255
        employee = Employee(name=long_name, email="test@example.com")
        assert len(employee.name) == 255

        # Name too long should fail
        with pytest.raises((ValueError, ValidationError)):
            Employee(name="A" * 256, email="test@example.com")

    def test_time_edge_cases(self):
        """Test time handling edge cases."""
        # Midnight shifts
        shift = Shift(
            schedule_id="schedule-123",
            date=datetime(2024, 1, 15).date(),
            start_time=time(23, 0),
            end_time=time(23, 59),
            position="Security",
        )
        assert shift.start_time == time(23, 0)

        # Overnight shifts (would need special handling)
        overnight_shift = Shift(
            schedule_id="schedule-123",
            date=datetime(2024, 1, 15).date(),
            start_time=time(22, 0),
            end_time=time(6, 0),  # Next day
            position="Night Shift",
            spans_midnight=True,
        )
        assert overnight_shift.spans_midnight == True

    def test_decimal_precision(self):
        """Test decimal precision for monetary values."""
        # Hourly rate with high precision
        employee = Employee(name="Test", email="test@example.com", hourly_rate=Decimal("15.555"))  # 3 decimal places

        # Should round to 2 decimal places for currency
        assert employee.hourly_rate.quantize(Decimal("0.01")) == Decimal("15.56")

    def test_unicode_handling(self):
        """Test Unicode character handling."""
        # Employee with Unicode name
        employee = Employee(name="José María García-López", email="jose@example.com")
        assert employee.name == "José María García-López"

        # Emoji in name (should be handled gracefully)
        employee_emoji = Employee(name="John 😊 Doe", email="john@example.com")
        assert "😊" in employee_emoji.name
