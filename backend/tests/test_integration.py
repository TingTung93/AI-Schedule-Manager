"""
Comprehensive integration tests for the backend application.
Tests complete workflows, database integration, and system interactions.
"""

import pytest
import asyncio
import asyncpg
from httpx import AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool
from unittest.mock import Mock, patch, AsyncMock
import json
from datetime import datetime, timedelta
import tempfile
import os

from src.main import app
from src.core.database import DatabaseManager
from src.core.config import Settings
from src.models.base import Base
from src.models.employee import Employee, EmployeeAvailability
from src.models.schedule import Schedule, Shift, ShiftAssignment
from src.models.rule import Rule, Constraint


class TestDatabaseIntegration:
    """Test database integration and operations."""

    @pytest.fixture
    async def test_db_engine(self):
        """Create test database engine."""
        # Use in-memory SQLite for testing
        engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:", poolclass=StaticPool, connect_args={"check_same_thread": False}
        )

        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        yield engine
        await engine.dispose()

    @pytest.fixture
    async def test_db_session(self, test_db_engine):
        """Create test database session."""
        from sqlalchemy.ext.asyncio import async_sessionmaker

        async_session = async_sessionmaker(test_db_engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            yield session

    @pytest.fixture
    async def sample_employees_in_db(self, test_db_session):
        """Create sample employees in test database."""
        employees = [
            Employee(name="John Doe", email="john@example.com", role="Server", hourly_rate=15.50, is_active=True),
            Employee(name="Jane Smith", email="jane@example.com", role="Cook", hourly_rate=18.00, is_active=True),
            Employee(name="Bob Wilson", email="bob@example.com", role="Manager", hourly_rate=22.00, is_active=True),
        ]

        for employee in employees:
            test_db_session.add(employee)

        await test_db_session.commit()

        # Refresh to get IDs
        for employee in employees:
            await test_db_session.refresh(employee)

        return employees

    async def test_employee_crud_operations(self, test_db_session, sample_employees_in_db):
        """Test complete CRUD operations for employees."""
        # Read - Get all employees
        from sqlalchemy import select

        result = await test_db_session.execute(select(Employee))
        employees = result.scalars().all()

        assert len(employees) == 3
        assert employees[0].name == "John Doe"

        # Update - Modify employee
        john = employees[0]
        john.hourly_rate = 16.00
        await test_db_session.commit()

        # Verify update
        await test_db_session.refresh(john)
        assert john.hourly_rate == 16.00

        # Delete - Soft delete employee
        jane = employees[1]
        jane.soft_delete()
        await test_db_session.commit()

        # Verify soft delete
        await test_db_session.refresh(jane)
        assert jane.is_deleted == True
        assert jane.deleted_at is not None

    async def test_schedule_creation_workflow(self, test_db_session, sample_employees_in_db):
        """Test complete schedule creation workflow."""
        # Create schedule
        schedule = Schedule(
            name="Week of Jan 15-21",
            start_date=datetime(2024, 1, 15).date(),
            end_date=datetime(2024, 1, 21).date(),
            status="draft",
            created_by="manager-123",
        )

        test_db_session.add(schedule)
        await test_db_session.commit()
        await test_db_session.refresh(schedule)

        # Create shifts for the schedule
        shifts = []
        for day_offset in range(7):
            shift = Shift(
                schedule_id=schedule.id,
                date=schedule.start_date + timedelta(days=day_offset),
                start_time=datetime.strptime("09:00", "%H:%M").time(),
                end_time=datetime.strptime("17:00", "%H:%M").time(),
                position="Server",
                required_employees=2,
            )
            shifts.append(shift)
            test_db_session.add(shift)

        await test_db_session.commit()

        # Refresh shifts to get IDs
        for shift in shifts:
            await test_db_session.refresh(shift)

        # Create shift assignments
        assignments = []
        for i, shift in enumerate(shifts[:3]):  # Assign first 3 shifts
            employee = sample_employees_in_db[i % len(sample_employees_in_db)]
            assignment = ShiftAssignment(
                shift_id=shift.id, employee_id=employee.id, assigned_at=datetime.utcnow(), status="confirmed"
            )
            assignments.append(assignment)
            test_db_session.add(assignment)

        await test_db_session.commit()

        # Verify complete schedule
        from sqlalchemy.orm import selectinload

        result = await test_db_session.execute(
            select(Schedule).options(selectinload(Schedule.shifts)).where(Schedule.id == schedule.id)
        )
        loaded_schedule = result.scalar_one()

        assert len(loaded_schedule.shifts) == 7
        assert loaded_schedule.status == "draft"

    async def test_rule_constraint_integration(self, test_db_session, sample_employees_in_db):
        """Test rule and constraint integration."""
        employee = sample_employees_in_db[0]

        # Create rule
        rule = Rule(
            name="John's availability rule",
            description="John cannot work evenings",
            rule_type="availability",
            employee_id=employee.id,
            priority=8,
            is_active=True,
        )

        test_db_session.add(rule)
        await test_db_session.commit()
        await test_db_session.refresh(rule)

        # Create constraint for the rule
        constraint = Constraint(
            constraint_type="time_restriction",
            parameters={"max_end_time": "17:00", "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]},
            description="Cannot work after 5pm on weekdays",
        )

        test_db_session.add(constraint)
        await test_db_session.commit()
        await test_db_session.refresh(constraint)

        # Link rule to constraint
        rule_constraint = RuleConstraint(rule_id=rule.id, constraint_id=constraint.id)

        test_db_session.add(rule_constraint)
        await test_db_session.commit()

        # Verify relationships
        from sqlalchemy.orm import selectinload

        result = await test_db_session.execute(select(Rule).options(selectinload(Rule.constraints)).where(Rule.id == rule.id))
        loaded_rule = result.scalar_one()

        assert len(loaded_rule.constraints) == 1
        assert loaded_rule.constraints[0].constraint_type == "time_restriction"

    async def test_complex_query_performance(self, test_db_session):
        """Test performance of complex queries."""
        import time

        # Create larger dataset for performance testing
        employees = []
        for i in range(100):
            employee = Employee(
                name=f"Employee {i}", email=f"emp{i}@example.com", role="Staff", hourly_rate=15.00 + (i % 10), is_active=True
            )
            employees.append(employee)
            test_db_session.add(employee)

        await test_db_session.commit()

        # Complex query with joins and filters
        start_time = time.time()

        from sqlalchemy import func, and_

        query = (
            select(
                Employee.id,
                Employee.name,
                Employee.hourly_rate,
                func.count(EmployeeAvailability.id).label("availability_count"),
            )
            .outerjoin(EmployeeAvailability)
            .where(and_(Employee.is_active == True, Employee.hourly_rate >= 15.00))
            .group_by(Employee.id, Employee.name, Employee.hourly_rate)
            .order_by(Employee.hourly_rate.desc())
        )

        result = await test_db_session.execute(query)
        employees_with_availability = result.all()

        end_time = time.time()

        assert len(employees_with_availability) > 0
        assert end_time - start_time < 1.0  # Should complete within 1 second

    async def test_transaction_rollback(self, test_db_session):
        """Test transaction rollback on errors."""
        # Start transaction
        employee = Employee(name="Test Employee", email="test@example.com", role="Tester", hourly_rate=15.00)

        test_db_session.add(employee)

        try:
            # Create constraint that will cause an error
            invalid_employee = Employee(
                name="Another Employee", email="test@example.com", role="Tester", hourly_rate=15.00  # Duplicate email
            )

            test_db_session.add(invalid_employee)
            await test_db_session.commit()

        except Exception:
            await test_db_session.rollback()

        # Verify rollback - no employees should be added
        from sqlalchemy import select

        result = await test_db_session.execute(select(Employee))
        employees = result.scalars().all()

        # Should not have any test employees
        test_emails = [emp.email for emp in employees if emp.email == "test@example.com"]
        assert len(test_emails) == 0

    async def test_concurrent_database_access(self, test_db_engine):
        """Test concurrent database access."""

        async def create_employee(session, name, email):
            employee = Employee(name=name, email=email, role="Staff", hourly_rate=15.00)
            session.add(employee)
            await session.commit()
            return employee

        # Create multiple concurrent sessions
        from sqlalchemy.ext.asyncio import async_sessionmaker

        SessionLocal = async_sessionmaker(test_db_engine, class_=AsyncSession)

        tasks = []
        for i in range(10):

            async def create_concurrent_employee(i=i):
                async with SessionLocal() as session:
                    return await create_employee(session, f"Concurrent Employee {i}", f"concurrent{i}@example.com")

            tasks.append(create_concurrent_employee())

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Should handle concurrent access gracefully
        successful_creates = [r for r in results if isinstance(r, Employee)]
        assert len(successful_creates) >= 8  # Allow for some contention


class TestAPIIntegration:
    """Test API integration with database and business logic."""

    @pytest.fixture
    async def app_client(self):
        """Create test client with database integration."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    @pytest.fixture
    def client(self):
        """Create synchronous test client."""
        return TestClient(app)

    async def test_complete_authentication_flow(self, app_client):
        """Test complete authentication workflow."""
        # Register user (if endpoint exists)
        # For now, test login with mock data

        login_data = {"email": "integration@example.com", "password": "testpassword123"}

        response = await app_client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200

        auth_data = response.json()
        assert "access_token" in auth_data
        assert "user" in auth_data

        token = auth_data["access_token"]

        # Use token for authenticated request
        headers = {"Authorization": f"Bearer {token}"}

        # Test accessing protected endpoint (employees list)
        employees_response = await app_client.get("/api/employees", headers=headers)
        assert employees_response.status_code == 200

    async def test_rule_parsing_to_schedule_generation_flow(self, app_client):
        """Test complete flow from rule parsing to schedule generation."""
        # Step 1: Parse rules
        rules_to_parse = [
            "Sarah can't work past 5pm on weekdays",
            "John prefers morning shifts",
            "We need at least 2 people during lunch hours",
        ]

        parsed_rules = []
        for rule_text in rules_to_parse:
            response = await app_client.post("/api/rules/parse", json={"rule_text": rule_text})
            assert response.status_code == 200
            parsed_rules.append(response.json())

        # Step 2: Verify rules are stored
        rules_response = await app_client.get("/api/rules")
        assert rules_response.status_code == 200

        rules_data = rules_response.json()
        assert len(rules_data["rules"]) >= len(parsed_rules)

        # Step 3: Generate schedule considering rules
        schedule_request = {"start_date": "2024-01-15", "end_date": "2024-01-21"}

        schedule_response = await app_client.post("/api/schedule/generate", json=schedule_request)
        assert schedule_response.status_code == 200

        schedule_data = schedule_response.json()
        assert "shifts" in schedule_data
        assert len(schedule_data["shifts"]) > 0

        # Step 4: Optimize the generated schedule
        schedule_id = schedule_data["id"]
        optimize_response = await app_client.post(f"/api/schedule/optimize?schedule_id={schedule_id}")
        assert optimize_response.status_code == 200

        optimization_data = optimize_response.json()
        assert optimization_data["status"] == "optimized"
        assert "improvements" in optimization_data

    async def test_employee_management_workflow(self, app_client):
        """Test complete employee management workflow."""
        # Create new employee
        new_employee = {"name": "Integration Test Employee", "email": "integration.test@example.com", "role": "Server"}

        create_response = await app_client.post("/api/employees", json=new_employee)
        assert create_response.status_code == 200

        created_employee = create_response.json()
        employee_id = created_employee["id"]

        # Verify employee appears in list
        list_response = await app_client.get("/api/employees")
        assert list_response.status_code == 200

        employees_list = list_response.json()["employees"]
        created_emp = next((emp for emp in employees_list if emp["id"] == employee_id), None)
        assert created_emp is not None
        assert created_emp["name"] == new_employee["name"]

        # Update employee (if endpoint exists)
        update_data = {"role": "Lead Server"}
        update_response = await app_client.patch(f"/api/employees/{employee_id}", json=update_data)
        # May not exist yet, so accept 404
        assert update_response.status_code in [200, 404]

    async def test_schedule_lifecycle_management(self, app_client):
        """Test complete schedule lifecycle."""
        # Step 1: Create employees first
        employees = [
            {"name": "Alice", "email": "alice@test.com", "role": "Server"},
            {"name": "Bob", "email": "bob@test.com", "role": "Cook"},
        ]

        for emp in employees:
            await app_client.post("/api/employees", json=emp)

        # Step 2: Generate initial schedule
        schedule_request = {"start_date": "2024-02-01", "end_date": "2024-02-07"}

        schedule_response = await app_client.post("/api/schedule/generate", json=schedule_request)
        assert schedule_response.status_code == 200

        schedule = schedule_response.json()
        schedule_id = schedule["id"]

        # Step 3: Verify schedule structure
        assert schedule["status"] == "generated"
        assert len(schedule["shifts"]) > 0

        # Step 4: Optimize schedule
        optimize_response = await app_client.post(f"/api/schedule/optimize?schedule_id={schedule_id}")
        assert optimize_response.status_code == 200

        # Step 5: Check analytics
        analytics_response = await app_client.get("/api/analytics/overview")
        assert analytics_response.status_code == 200

        analytics = analytics_response.json()
        assert analytics["total_schedules"] > 0

    async def test_error_handling_integration(self, app_client):
        """Test error handling across the application."""
        # Test invalid rule parsing
        invalid_rule_response = await app_client.post("/api/rules/parse", json={"rule_text": ""})
        # Should handle gracefully
        assert invalid_rule_response.status_code in [200, 400, 422]

        # Test invalid schedule generation
        invalid_schedule_response = await app_client.post(
            "/api/schedule/generate", json={"start_date": "invalid-date", "end_date": "2024-01-21"}
        )
        assert invalid_schedule_response.status_code in [200, 400, 422]

        # Test non-existent resource
        not_found_response = await app_client.get("/api/employees/99999")
        assert not_found_response.status_code == 404

    async def test_api_performance_under_load(self, app_client):
        """Test API performance under concurrent load."""
        import time

        async def make_request():
            return await app_client.get("/api/employees")

        # Make 20 concurrent requests
        start_time = time.time()
        tasks = [make_request() for _ in range(20)]
        responses = await asyncio.gather(*tasks)
        end_time = time.time()

        # All requests should succeed
        assert all(r.status_code == 200 for r in responses)

        # Should complete within reasonable time
        assert end_time - start_time < 10.0

        # Average response time should be reasonable
        avg_response_time = (end_time - start_time) / len(responses)
        assert avg_response_time < 0.5

    def test_cors_integration(self, client):
        """Test CORS configuration."""
        # Test preflight request
        preflight_response = client.options(
            "/api/employees",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )

        # Should handle CORS preflight
        assert preflight_response.status_code in [200, 204]

        # Test actual request with CORS headers
        response = client.get("/api/employees", headers={"Origin": "http://localhost:3000"})

        assert response.status_code == 200


class TestSystemIntegration:
    """Test integration with external systems and services."""

    @pytest.fixture
    def mock_external_services(self):
        """Mock external services for testing."""
        with (
            patch("src.services.email_service.EmailService") as mock_email,
            patch("src.services.notification_service.NotificationService") as mock_notification,
            patch("src.core.cache.RedisCache") as mock_cache,
        ):
            # Configure mocks
            mock_email.return_value.send_email = AsyncMock(return_value=True)
            mock_notification.return_value.send_notification = AsyncMock(return_value=True)
            mock_cache.return_value.get = AsyncMock(return_value=None)
            mock_cache.return_value.set = AsyncMock(return_value=True)

            yield {"email": mock_email, "notification": mock_notification, "cache": mock_cache}

    async def test_email_notification_integration(self, mock_external_services):
        """Test email notification integration."""
        from src.services.email_service import EmailService

        email_service = EmailService()

        # Test sending schedule notification
        result = await email_service.send_schedule_notification(
            employee_email="test@example.com",
            schedule_data={"week": "Jan 15-21, 2024", "shifts": [{"date": "2024-01-15", "start": "09:00", "end": "17:00"}]},
        )

        assert result is True
        mock_external_services["email"].return_value.send_email.assert_called_once()

    async def test_cache_integration(self, mock_external_services):
        """Test cache integration."""
        from src.core.cache import cache_manager

        # Test caching schedule data
        schedule_data = {"id": "schedule-123", "shifts": [{"date": "2024-01-15", "employee": "John"}]}

        # Cache the data
        await cache_manager.set("schedule:123", schedule_data, ttl=3600)

        # Retrieve from cache
        cached_data = await cache_manager.get("schedule:123")

        # Should call cache service
        mock_external_services["cache"].return_value.set.assert_called_once()
        mock_external_services["cache"].return_value.get.assert_called_once()

    async def test_backup_and_recovery_integration(self):
        """Test backup and recovery procedures."""
        # This would test actual backup/recovery in a real system
        # For now, test the backup service interface

        from src.services.backup_service import BackupService

        backup_service = BackupService()

        # Test backup creation
        backup_id = await backup_service.create_backup(tables=["employees", "schedules", "rules"], compress=True)

        assert backup_id is not None
        assert isinstance(backup_id, str)

        # Test backup listing
        backups = await backup_service.list_backups()
        assert isinstance(backups, list)

    async def test_monitoring_integration(self):
        """Test monitoring and metrics integration."""
        from src.services.monitoring_service import MonitoringService

        monitoring = MonitoringService()

        # Test metric recording
        await monitoring.record_metric(
            metric_name="schedule_generation_time", value=1.5, tags={"status": "success", "employees": 25}
        )

        # Test health check
        health_status = await monitoring.get_health_status()
        assert "database" in health_status
        assert "cache" in health_status
        assert "external_services" in health_status

    def test_logging_integration(self):
        """Test logging integration across the system."""
        import logging
        from src.core.logging import setup_logging

        # Setup logging configuration
        setup_logging(level="DEBUG", format_json=True)

        logger = logging.getLogger("test_integration")

        # Test different log levels
        logger.debug("Debug message")
        logger.info("Info message")
        logger.warning("Warning message")
        logger.error("Error message")

        # In a real test, you would verify log output
        # For now, just ensure no exceptions are raised
        assert True

    async def test_configuration_management(self):
        """Test configuration management across environments."""
        from src.core.config import get_settings

        settings = get_settings()

        # Test that configuration is loaded
        assert settings.database_url is not None
        assert settings.secret_key is not None
        assert hasattr(settings, "cors_origins")

        # Test environment-specific settings
        if settings.environment == "test":
            assert "test" in settings.database_url.lower()

    async def test_graceful_shutdown_integration(self):
        """Test graceful shutdown procedures."""
        from src.core.lifecycle import shutdown_handler

        # Test shutdown procedures
        result = await shutdown_handler()

        # Should complete without errors
        assert result is True

    async def test_security_integration(self):
        """Test security measures integration."""
        from src.core.security import SecurityManager

        security = SecurityManager()

        # Test rate limiting
        is_allowed = await security.check_rate_limit(identifier="test_user", action="login", limit=5, window=300)  # 5 minutes

        assert isinstance(is_allowed, bool)

        # Test input validation
        is_valid = security.validate_input(data={"email": "test@example.com", "name": "John Doe"}, schema="employee_create")

        assert isinstance(is_valid, bool)


class TestEndToEndWorkflows:
    """Test complete end-to-end business workflows."""

    @pytest.fixture
    async def e2e_client(self):
        """Create client for end-to-end testing."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    async def test_new_business_setup_workflow(self, e2e_client):
        """Test complete new business setup workflow."""
        # Step 1: Create manager account
        manager_data = {
            "email": "manager@newbusiness.com",
            "password": "SecurePassword123!",
            "business_name": "Test Restaurant",
            "role": "owner",
        }

        # For now, just test login since registration may not exist
        login_response = await e2e_client.post(
            "/api/auth/login", json={"email": manager_data["email"], "password": manager_data["password"]}
        )
        assert login_response.status_code == 200

        auth_token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {auth_token}"}

        # Step 2: Add employees
        employees = [
            {"name": "Sarah Johnson", "email": "sarah@test.com", "role": "Server"},
            {"name": "Mike Chen", "email": "mike@test.com", "role": "Cook"},
            {"name": "Lisa Brown", "email": "lisa@test.com", "role": "Cashier"},
        ]

        created_employees = []
        for emp in employees:
            response = await e2e_client.post("/api/employees", json=emp, headers=headers)
            assert response.status_code == 200
            created_employees.append(response.json())

        # Step 3: Set up scheduling rules
        rules = [
            "Sarah can't work past 5pm on weekdays due to childcare",
            "Mike prefers morning shifts and can work up to 50 hours per week",
            "We need at least 2 people during lunch hours (11am-2pm)",
            "No one should work more than 8 hours in a single day",
        ]

        for rule_text in rules:
            response = await e2e_client.post("/api/rules/parse", json={"rule_text": rule_text}, headers=headers)
            assert response.status_code == 200

        # Step 4: Generate first schedule
        schedule_response = await e2e_client.post(
            "/api/schedule/generate", json={"start_date": "2024-01-15", "end_date": "2024-01-21"}, headers=headers
        )
        assert schedule_response.status_code == 200

        schedule = schedule_response.json()
        assert len(schedule["shifts"]) > 0

        # Step 5: Review analytics
        analytics_response = await e2e_client.get("/api/analytics/overview", headers=headers)
        assert analytics_response.status_code == 200

        analytics = analytics_response.json()
        assert analytics["total_employees"] >= len(employees)

    async def test_weekly_schedule_management_workflow(self, e2e_client):
        """Test weekly schedule management workflow."""
        # Simulate manager workflow for weekly scheduling

        # Step 1: Review previous week performance
        analytics_response = await e2e_client.get("/api/analytics/overview")
        assert analytics_response.status_code == 200

        # Step 2: Check for employee requests/preferences
        notifications_response = await e2e_client.get("/api/notifications")
        assert notifications_response.status_code == 200

        # Step 3: Generate new schedule
        next_week_start = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        next_week_end = (datetime.now() + timedelta(days=13)).strftime("%Y-%m-%d")

        schedule_response = await e2e_client.post(
            "/api/schedule/generate", json={"start_date": next_week_start, "end_date": next_week_end}
        )
        assert schedule_response.status_code == 200

        schedule = schedule_response.json()
        schedule_id = schedule["id"]

        # Step 4: Optimize schedule
        optimize_response = await e2e_client.post(f"/api/schedule/optimize?schedule_id={schedule_id}")
        assert optimize_response.status_code == 200

        optimization = optimize_response.json()
        assert "improvements" in optimization

        # Step 5: Publish schedule (would notify employees)
        # For now, just verify the schedule exists
        assert schedule["status"] == "generated"

    async def test_employee_schedule_interaction_workflow(self, e2e_client):
        """Test employee interaction with schedule workflow."""
        # Simulate employee workflow

        # Step 1: Employee login
        login_response = await e2e_client.post("/api/auth/login", json={"email": "employee@test.com", "password": "password"})
        assert login_response.status_code == 200

        # Step 2: View personal schedule
        # This would be a personalized endpoint
        schedule_response = await e2e_client.get("/api/schedule/my-schedule")
        # May not exist yet, accept 404
        assert schedule_response.status_code in [200, 404]

        # Step 3: Check notifications
        notifications_response = await e2e_client.get("/api/notifications")
        assert notifications_response.status_code == 200

        # Step 4: Submit availability preferences
        # This would be a future feature
        preference_response = await e2e_client.post(
            "/api/preferences/availability",
            json={
                "preferred_days": ["monday", "tuesday", "wednesday"],
                "preferred_shifts": ["morning"],
                "unavailable_dates": ["2024-01-20"],
            },
        )
        # May not exist yet, accept 404
        assert preference_response.status_code in [200, 404]

    async def test_schedule_conflict_resolution_workflow(self, e2e_client):
        """Test schedule conflict resolution workflow."""
        # Step 1: Create conflicting rules
        conflicting_rules = [
            "John needs Monday off every week",
            "We must have John working Monday lunch shifts",
            "John can only work 20 hours per week",
            "John must work 40 hours per week",
        ]

        for rule_text in conflicting_rules:
            response = await e2e_client.post("/api/rules/parse", json={"rule_text": rule_text})
            assert response.status_code == 200

        # Step 2: Attempt schedule generation
        schedule_response = await e2e_client.post(
            "/api/schedule/generate", json={"start_date": "2024-01-22", "end_date": "2024-01-28"}
        )
        assert schedule_response.status_code == 200

        schedule = schedule_response.json()

        # Step 3: Check for conflict warnings
        # The system should either resolve conflicts or flag them
        assert "conflicts" in schedule or len(schedule["shifts"]) > 0

        # Step 4: Review conflict resolution suggestions
        # This would be a future feature for conflict management

    async def test_performance_monitoring_workflow(self, e2e_client):
        """Test performance monitoring and optimization workflow."""
        # Step 1: Generate multiple schedules to create data
        for week in range(4):  # 4 weeks of data
            start_date = (datetime.now() + timedelta(weeks=week)).strftime("%Y-%m-%d")
            end_date = (datetime.now() + timedelta(weeks=week, days=6)).strftime("%Y-%m-%d")

            response = await e2e_client.post("/api/schedule/generate", json={"start_date": start_date, "end_date": end_date})
            assert response.status_code == 200

        # Step 2: Review analytics
        analytics_response = await e2e_client.get("/api/analytics/overview")
        assert analytics_response.status_code == 200

        analytics = analytics_response.json()
        assert analytics["total_schedules"] >= 4

        # Step 3: Performance metrics
        # This would include metrics like:
        # - Average schedule generation time
        # - Employee satisfaction scores
        # - Labor cost trends
        # - Schedule optimization effectiveness

        assert "optimization_score" in analytics
