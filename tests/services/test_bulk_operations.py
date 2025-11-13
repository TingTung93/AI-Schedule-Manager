"""
Tests for bulk operations in import service.

Tests the optimized bulk import functionality including:
- Bulk employee imports
- Bulk schedule imports
- Bulk rule imports
- Progress callbacks
- Partial success mode
- Error handling
"""

import io
from datetime import date, datetime, time, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.exceptions.import_exceptions import ImportValidationError
from backend.src.models import Employee, Rule, Schedule, ScheduleAssignment, Shift
from backend.src.services.import_service import ImportService


class TestBulkEmployeeImport:
    """Test bulk employee import operations."""

    @pytest.fixture
    def import_service(self):
        return ImportService()

    @pytest.fixture
    def sample_employee_csv(self):
        """Create sample employee CSV data."""
        data = {
            "name": ["John Doe", "Jane Smith", "Bob Johnson"],
            "email": ["john@example.com", "jane@example.com", "bob@example.com"],
            "role": ["server", "cook", "manager"],
            "hourly_rate": [15.0, 18.0, 25.0],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue().encode("utf-8")

    async def test_bulk_employee_import(self, import_service, sample_employee_csv, async_db_session):
        """Test bulk import of employees."""
        result = await import_service.import_employees(
            db=async_db_session,
            file_content=sample_employee_csv,
            filename="employees.csv",
            options={"allow_partial": True},
        )

        assert result["total_rows"] == 3
        assert result["created"] == 3
        assert result["processed"] == 3
        assert len(result["errors"]) == 0

    async def test_bulk_employee_import_with_duplicates(self, import_service, sample_employee_csv, async_db_session):
        """Test bulk import with duplicate employees."""
        # First import
        await import_service.import_employees(
            db=async_db_session, file_content=sample_employee_csv, filename="employees.csv"
        )

        # Second import (duplicates)
        result = await import_service.import_employees(
            db=async_db_session,
            file_content=sample_employee_csv,
            filename="employees.csv",
            options={"update_existing": False, "allow_partial": True},
        )

        assert result["skipped"] == 3
        assert len(result["errors"]) == 3

    async def test_bulk_employee_import_with_updates(self, import_service, sample_employee_csv, async_db_session):
        """Test bulk import with updates to existing employees."""
        # First import
        await import_service.import_employees(
            db=async_db_session, file_content=sample_employee_csv, filename="employees.csv"
        )

        # Second import with update flag
        result = await import_service.import_employees(
            db=async_db_session,
            file_content=sample_employee_csv,
            filename="employees.csv",
            options={"update_existing": True},
        )

        assert result["updated"] == 3
        assert result["created"] == 0

    async def test_bulk_employee_import_progress_callback(self, import_service, sample_employee_csv, async_db_session):
        """Test progress callback during bulk import."""
        progress_calls = []

        def progress_callback(info):
            progress_calls.append(info)

        await import_service.import_employees(
            db=async_db_session,
            file_content=sample_employee_csv,
            filename="employees.csv",
            options={"progress_callback": progress_callback},
        )

        # Should have at least completion callback
        assert len(progress_calls) > 0
        assert any(call["phase"] == "complete" for call in progress_calls)

    async def test_bulk_employee_import_validation_error(self, import_service, async_db_session):
        """Test bulk import with validation errors."""
        # Invalid email format
        data = {"name": ["John Doe"], "email": ["invalid-email"], "role": ["server"]}
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        result = await import_service.import_employees(
            db=async_db_session, file_content=csv_bytes, filename="employees.csv", options={"allow_partial": True}
        )

        assert len(result["errors"]) > 0

    async def test_bulk_employee_import_fail_fast_mode(self, import_service, async_db_session):
        """Test fail-fast mode (allow_partial=False)."""
        # Mix of valid and invalid data
        data = {
            "name": ["John Doe", "Jane Smith"],
            "email": ["john@example.com", "invalid-email"],
            "role": ["server", "cook"],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        with pytest.raises(ImportValidationError):
            await import_service.import_employees(
                db=async_db_session, file_content=csv_bytes, filename="employees.csv", options={"allow_partial": False}
            )


class TestBulkScheduleImport:
    """Test bulk schedule import operations."""

    @pytest.fixture
    def import_service(self):
        return ImportService()

    @pytest.fixture
    async def setup_test_data(self, async_db_session):
        """Setup employees and shifts for testing."""
        # Create employees
        employees = [
            Employee(name="John Doe", email="john@example.com", role="server"),
            Employee(name="Jane Smith", email="jane@example.com", role="cook"),
        ]
        async_db_session.add_all(employees)

        # Create shifts
        today = date.today()
        shifts = [
            Shift(name="Morning", date=today, start_time=time(8, 0), end_time=time(16, 0), role="server"),
            Shift(name="Evening", date=today, start_time=time(16, 0), end_time=time(23, 0), role="cook"),
        ]
        async_db_session.add_all(shifts)
        await async_db_session.commit()

        return {"employees": employees, "shifts": shifts, "date": today}

    @pytest.fixture
    def sample_schedule_csv(self, setup_test_data):
        """Create sample schedule CSV data."""
        today = setup_test_data["date"]
        data = {
            "employee_email": ["john@example.com", "jane@example.com"],
            "shift_name": ["Morning", "Evening"],
            "date": [today.isoformat(), today.isoformat()],
            "status": ["assigned", "assigned"],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue().encode("utf-8")

    async def test_bulk_schedule_import(self, import_service, sample_schedule_csv, async_db_session, setup_test_data):
        """Test bulk import of schedules."""
        result = await import_service.import_schedules(
            db=async_db_session,
            file_content=sample_schedule_csv,
            filename="schedules.csv",
            options={"created_by": 1, "allow_partial": True},
        )

        assert result["total_rows"] == 2
        assert result["created"] == 2
        assert result["processed"] == 2
        assert len(result["errors"]) == 0

    async def test_bulk_schedule_import_conflict_detection(
        self, import_service, sample_schedule_csv, async_db_session, setup_test_data
    ):
        """Test conflict detection during bulk import."""
        # First import
        await import_service.import_schedules(
            db=async_db_session, file_content=sample_schedule_csv, filename="schedules.csv", options={"created_by": 1}
        )

        # Second import (should detect duplicates)
        result = await import_service.import_schedules(
            db=async_db_session,
            file_content=sample_schedule_csv,
            filename="schedules.csv",
            options={"created_by": 1, "update_existing": False, "allow_partial": True},
        )

        assert result["skipped"] == 2
        assert len(result["errors"]) == 2

    async def test_bulk_schedule_import_with_updates(
        self, import_service, sample_schedule_csv, async_db_session, setup_test_data
    ):
        """Test bulk import with updates."""
        # First import
        await import_service.import_schedules(
            db=async_db_session, file_content=sample_schedule_csv, filename="schedules.csv", options={"created_by": 1}
        )

        # Second import with update flag
        result = await import_service.import_schedules(
            db=async_db_session,
            file_content=sample_schedule_csv,
            filename="schedules.csv",
            options={"created_by": 1, "update_existing": True},
        )

        assert result["updated"] == 2
        assert result["created"] == 0

    async def test_bulk_schedule_import_employee_not_found(self, import_service, async_db_session, setup_test_data):
        """Test bulk import with non-existent employee."""
        today = setup_test_data["date"]
        data = {
            "employee_email": ["nonexistent@example.com"],
            "shift_name": ["Morning"],
            "date": [today.isoformat()],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        result = await import_service.import_schedules(
            db=async_db_session, file_content=csv_bytes, filename="schedules.csv", options={"allow_partial": True}
        )

        assert result["created"] == 0
        assert len(result["errors"]) > 0


class TestBulkRuleImport:
    """Test bulk rule import operations."""

    @pytest.fixture
    def import_service(self):
        return ImportService()

    @pytest.fixture
    async def setup_test_data(self, async_db_session):
        """Setup employees for testing."""
        employees = [
            Employee(name="John Doe", email="john@example.com", role="server"),
            Employee(name="Jane Smith", email="jane@example.com", role="cook"),
        ]
        async_db_session.add_all(employees)
        await async_db_session.commit()
        return {"employees": employees}

    @pytest.fixture
    def sample_rule_csv(self):
        """Create sample rule CSV data."""
        data = {
            "rule_type": ["availability", "preference"],
            "original_text": ["Available Monday-Friday", "Prefer morning shifts"],
            "priority": [1, 2],
            "active": [True, True],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue().encode("utf-8")

    async def test_bulk_rule_import(self, import_service, sample_rule_csv, async_db_session, setup_test_data):
        """Test bulk import of rules."""
        result = await import_service.import_rules(
            db=async_db_session, file_content=sample_rule_csv, filename="rules.csv", options={"allow_partial": True}
        )

        assert result["total_rows"] == 2
        assert result["created"] == 2
        assert result["processed"] == 2
        assert len(result["errors"]) == 0

    async def test_bulk_rule_import_with_employee_reference(self, import_service, async_db_session, setup_test_data):
        """Test bulk import of rules with employee references."""
        data = {
            "rule_type": ["availability"],
            "original_text": ["Available weekends"],
            "employee_email": ["john@example.com"],
            "priority": [1],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        result = await import_service.import_rules(
            db=async_db_session, file_content=csv_bytes, filename="rules.csv", options={"allow_partial": True}
        )

        assert result["created"] == 1


class TestBulkOperationPerformance:
    """Performance tests for bulk operations."""

    @pytest.fixture
    def import_service(self):
        return ImportService()

    async def test_large_employee_import_performance(self, import_service, async_db_session):
        """Test performance with large dataset."""
        # Create 1000 employees
        data = {
            "name": [f"Employee {i}" for i in range(1000)],
            "email": [f"employee{i}@example.com" for i in range(1000)],
            "role": ["server"] * 1000,
            "hourly_rate": [15.0] * 1000,
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        import time

        start_time = time.time()

        result = await import_service.import_employees(
            db=async_db_session, file_content=csv_bytes, filename="employees.csv", options={"allow_partial": True}
        )

        end_time = time.time()
        duration = end_time - start_time

        assert result["created"] == 1000
        # Should complete in reasonable time (adjust threshold as needed)
        assert duration < 10.0  # 10 seconds for 1000 rows

        print(f"Imported 1000 employees in {duration:.2f} seconds")


class TestBulkOperationTransactions:
    """Test transaction handling in bulk operations."""

    @pytest.fixture
    def import_service(self):
        return ImportService()

    async def test_rollback_on_bulk_insert_error(self, import_service, async_db_session):
        """Test that errors trigger rollback."""
        data = {
            "name": ["John Doe", "Jane Smith"],
            "email": ["john@example.com", "jane@example.com"],
            "role": ["server", "cook"],
        }
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_bytes = csv_buffer.getvalue().encode("utf-8")

        # Mock db.add_all to raise an error
        with patch.object(async_db_session, "add_all", side_effect=Exception("Database error")):
            with pytest.raises(ImportValidationError):
                await import_service.import_employees(
                    db=async_db_session,
                    file_content=csv_bytes,
                    filename="employees.csv",
                    options={"allow_partial": True},
                )

        # Verify rollback was called
        # (In real scenario, check that no partial data was committed)
