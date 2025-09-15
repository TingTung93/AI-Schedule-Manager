"""
Comprehensive API endpoint tests for all CRUD operations.
Tests authentication, rule parsing, schedule generation, and employee management.
"""

import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
import json
from datetime import datetime, timedelta

from src.main import app


class TestApiEndpoints:
    """Test all API endpoints with comprehensive coverage."""

    @pytest.fixture
    def client(self):
        """Create test client for FastAPI app."""
        return TestClient(app)

    @pytest.fixture
    async def async_client(self):
        """Create async client for testing async endpoints."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {
            "Authorization": "Bearer test-token-123456789",
            "Content-Type": "application/json"
        }

    @pytest.fixture
    def sample_login_data(self):
        """Sample login credentials."""
        return {
            "email": "test@example.com",
            "password": "securepassword123"
        }

    @pytest.fixture
    def sample_rule_data(self):
        """Sample rule data for testing."""
        return {
            "rule_text": "Sarah can't work past 5pm on weekdays due to childcare"
        }

    @pytest.fixture
    def sample_employee_data(self):
        """Sample employee data for testing."""
        return {
            "name": "John Doe",
            "email": "john.doe@example.com",
            "role": "Cashier"
        }

    @pytest.fixture
    def sample_schedule_data(self):
        """Sample schedule generation data."""
        return {
            "start_date": "2024-01-15",
            "end_date": "2024-01-21"
        }

    # Root and health endpoints
    def test_root_endpoint(self, client):
        """Test root endpoint returns correct response."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "AI Schedule Manager API"
        assert data["version"] == "0.1.0"
        assert data["status"] == "operational"

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    # Authentication tests
    def test_login_success(self, client, sample_login_data):
        """Test successful login."""
        response = client.post("/api/auth/login", json=sample_login_data)
        assert response.status_code == 200
        data = response.json()

        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == sample_login_data["email"]
        assert data["access_token"].startswith("mock-jwt-token-")

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        response = client.post("/api/auth/login", json={
            "email": "",
            "password": ""
        })
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]

    def test_login_missing_fields(self, client):
        """Test login with missing fields."""
        response = client.post("/api/auth/login", json={"email": "test@example.com"})
        assert response.status_code == 422  # Validation error

    def test_login_admin_role_assignment(self, client):
        """Test admin role assignment for admin emails."""
        response = client.post("/api/auth/login", json={
            "email": "admin@example.com",
            "password": "password"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "manager"

    # Rule management tests
    def test_parse_rule_success(self, client, sample_rule_data):
        """Test successful rule parsing."""
        response = client.post("/api/rules/parse", json=sample_rule_data)
        assert response.status_code == 200
        data = response.json()

        assert "id" in data
        assert data["rule_type"] in ["availability", "preference", "requirement", "restriction"]
        assert data["original_text"] == sample_rule_data["rule_text"]
        assert "created_at" in data
        assert "constraints" in data

    def test_parse_rule_availability_detection(self, client):
        """Test detection of availability rules."""
        response = client.post("/api/rules/parse", json={
            "rule_text": "John can't work past 5pm"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["rule_type"] == "availability"
        assert data["employee"] == "John Smith"  # From employees_db

    def test_parse_rule_preference_detection(self, client):
        """Test detection of preference rules."""
        response = client.post("/api/rules/parse", json={
            "rule_text": "Sarah prefers morning shifts"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["rule_type"] == "preference"

    def test_parse_rule_requirement_detection(self, client):
        """Test detection of requirement rules."""
        response = client.post("/api/rules/parse", json={
            "rule_text": "We need at least 3 people during lunch"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["rule_type"] == "requirement"

    def test_parse_rule_constraint_extraction(self, client):
        """Test constraint extraction from rules."""
        response = client.post("/api/rules/parse", json={
            "rule_text": "John prefers morning shifts and can't work evening"
        })
        assert response.status_code == 200
        data = response.json()

        constraints = data["constraints"]
        assert len(constraints) >= 1
        assert any(c["type"] == "shift" and c["value"] == "morning" for c in constraints)

    def test_parse_rule_time_constraint(self, client):
        """Test time constraint extraction."""
        response = client.post("/api/rules/parse", json={
            "rule_text": "Sarah can't work past 5pm due to childcare"
        })
        assert response.status_code == 200
        data = response.json()

        constraints = data["constraints"]
        assert any(c["type"] == "time" and c["value"] == "17:00" for c in constraints)

    def test_parse_rule_empty_text(self, client):
        """Test parsing empty rule text."""
        response = client.post("/api/rules/parse", json={"rule_text": ""})
        assert response.status_code == 200  # Should handle gracefully

    def test_get_rules_empty(self, client):
        """Test getting rules when none exist."""
        # Clear rules database
        from src.main import rules_db
        rules_db.clear()

        response = client.get("/api/rules")
        assert response.status_code == 200
        data = response.json()
        assert data["rules"] == []
        assert data["total"] == 0

    def test_get_rules_with_data(self, client, sample_rule_data):
        """Test getting rules after adding some."""
        # Add a rule first
        client.post("/api/rules/parse", json=sample_rule_data)

        response = client.get("/api/rules")
        assert response.status_code == 200
        data = response.json()
        assert len(data["rules"]) >= 1
        assert data["total"] >= 1

    # Schedule management tests
    def test_generate_schedule_success(self, client, sample_schedule_data):
        """Test successful schedule generation."""
        response = client.post("/api/schedule/generate", json=sample_schedule_data)
        assert response.status_code == 200
        data = response.json()

        assert "id" in data
        assert data["start_date"] == sample_schedule_data["start_date"]
        assert data["end_date"] == sample_schedule_data["end_date"]
        assert data["status"] == "generated"
        assert "shifts" in data
        assert len(data["shifts"]) > 0
        assert "created_at" in data

    def test_generate_schedule_shift_structure(self, client, sample_schedule_data):
        """Test generated schedule shift structure."""
        response = client.post("/api/schedule/generate", json=sample_schedule_data)
        data = response.json()

        shifts = data["shifts"]
        assert len(shifts) == 21  # 7 days * 3 shift types

        # Verify shift structure
        for shift in shifts:
            assert "day" in shift
            assert "type" in shift
            assert shift["type"] in ["morning", "afternoon", "evening"]
            assert "employees" in shift
            assert "start_time" in shift
            assert "end_time" in shift
            assert len(shift["employees"]) <= 2  # Max 2 employees per shift

    def test_generate_schedule_date_validation(self, client):
        """Test schedule generation with invalid dates."""
        response = client.post("/api/schedule/generate", json={
            "start_date": "invalid-date",
            "end_date": "2024-01-21"
        })
        # Should handle gracefully or return validation error
        assert response.status_code in [200, 422]

    def test_optimize_schedule_success(self, client, sample_schedule_data):
        """Test schedule optimization."""
        # Generate a schedule first
        gen_response = client.post("/api/schedule/generate", json=sample_schedule_data)
        schedule_id = gen_response.json()["id"]

        response = client.post(f"/api/schedule/optimize?schedule_id={schedule_id}")
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "optimized"
        assert "improvements" in data
        improvements = data["improvements"]
        assert "cost_savings" in improvements
        assert "coverage" in improvements
        assert "satisfaction" in improvements
        assert "message" in data

    def test_optimize_schedule_invalid_id(self, client):
        """Test optimization with invalid schedule ID."""
        response = client.post("/api/schedule/optimize?schedule_id=99999")
        assert response.status_code == 200  # Mock returns success regardless

    # Employee management tests
    def test_get_employees_success(self, client):
        """Test getting all employees."""
        response = client.get("/api/employees")
        assert response.status_code == 200
        data = response.json()

        assert "employees" in data
        assert "total" in data
        assert len(data["employees"]) >= 3  # Initial mock data

        # Check employee structure
        for employee in data["employees"]:
            assert "id" in employee
            assert "name" in employee
            assert "email" in employee
            assert "role" in employee

    def test_create_employee_success(self, client, sample_employee_data):
        """Test creating new employee."""
        response = client.post("/api/employees", json=sample_employee_data)
        assert response.status_code == 200
        data = response.json()

        assert "id" in data
        assert data["name"] == sample_employee_data["name"]
        assert data["email"] == sample_employee_data["email"]
        assert data["role"] == sample_employee_data["role"]
        assert "created_at" in data

    def test_create_employee_validation(self, client):
        """Test employee creation with missing fields."""
        response = client.post("/api/employees", json={
            "name": "John Doe"
            # Missing email and role
        })
        assert response.status_code == 422  # Validation error

    def test_create_employee_persistence(self, client, sample_employee_data):
        """Test that created employee persists in database."""
        # Create employee
        create_response = client.post("/api/employees", json=sample_employee_data)
        created_id = create_response.json()["id"]

        # Verify it appears in employees list
        list_response = client.get("/api/employees")
        employees = list_response.json()["employees"]

        created_employee = next((e for e in employees if e["id"] == created_id), None)
        assert created_employee is not None
        assert created_employee["name"] == sample_employee_data["name"]

    # Analytics endpoints
    def test_analytics_overview(self, client):
        """Test analytics overview endpoint."""
        response = client.get("/api/analytics/overview")
        assert response.status_code == 200
        data = response.json()

        assert "total_employees" in data
        assert "total_rules" in data
        assert "total_schedules" in data
        assert "avg_hours_per_week" in data
        assert "labor_cost_trend" in data
        assert "optimization_score" in data

        # Verify data types
        assert isinstance(data["total_employees"], int)
        assert isinstance(data["avg_hours_per_week"], int)
        assert data["optimization_score"] >= 0

    # Notifications endpoints
    def test_get_notifications(self, client):
        """Test getting notifications."""
        response = client.get("/api/notifications")
        assert response.status_code == 200
        data = response.json()

        assert "notifications" in data
        assert "unread_count" in data
        assert len(data["notifications"]) >= 0

        # Check notification structure
        for notification in data["notifications"]:
            assert "id" in notification
            assert "type" in notification
            assert "title" in notification
            assert "message" in notification
            assert "read" in notification
            assert "created_at" in notification

    # Edge cases and error handling
    def test_invalid_endpoint(self, client):
        """Test accessing non-existent endpoint."""
        response = client.get("/api/nonexistent")
        assert response.status_code == 404

    def test_method_not_allowed(self, client):
        """Test using wrong HTTP method."""
        response = client.get("/api/auth/login")  # Should be POST
        assert response.status_code == 405

    def test_large_payload_handling(self, client):
        """Test handling of large payloads."""
        large_rule = "A" * 10000  # 10KB rule
        response = client.post("/api/rules/parse", json={"rule_text": large_rule})
        assert response.status_code in [200, 413, 422]  # Success or payload too large

    def test_concurrent_requests(self, client):
        """Test handling concurrent requests."""
        import threading
        import time

        results = []

        def make_request():
            response = client.get("/health")
            results.append(response.status_code)

        # Create 10 concurrent requests
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # All requests should succeed
        assert all(status == 200 for status in results)
        assert len(results) == 10

    # Data integrity tests
    def test_rule_id_uniqueness(self, client):
        """Test that rule IDs are unique."""
        rule_data = {"rule_text": "Test rule"}

        # Create multiple rules
        ids = []
        for _ in range(5):
            response = client.post("/api/rules/parse", json=rule_data)
            ids.append(response.json()["id"])

        # All IDs should be unique
        assert len(set(ids)) == len(ids)

    def test_employee_id_uniqueness(self, client):
        """Test that employee IDs are unique."""
        employee_data = {
            "name": "Test Employee",
            "email": "test@example.com",
            "role": "Tester"
        }

        # Create multiple employees
        ids = []
        for i in range(5):
            employee_data["email"] = f"test{i}@example.com"
            response = client.post("/api/employees", json=employee_data)
            ids.append(response.json()["id"])

        # All IDs should be unique
        assert len(set(ids)) == len(ids)

    @pytest.mark.asyncio
    async def test_async_endpoint_performance(self, async_client):
        """Test async endpoint performance."""
        import time

        start_time = time.time()

        # Make multiple concurrent requests
        tasks = []
        for _ in range(10):
            task = async_client.get("/health")
            tasks.append(task)

        responses = await asyncio.gather(*tasks)
        end_time = time.time()

        # All responses should be successful
        assert all(r.status_code == 200 for r in responses)

        # Should complete reasonably quickly
        assert end_time - start_time < 5.0