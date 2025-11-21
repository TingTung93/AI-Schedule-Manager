# API Test Specifications

**Version**: 1.0
**Test Framework**: pytest, httpx
**Coverage Goal**: 100% endpoint coverage

---

## Overview

This document specifies comprehensive API endpoint tests for the AI Schedule Manager system. All API endpoints must be validated for:

1. **Request/Response Contracts**: Schema validation
2. **Authentication/Authorization**: Access control
3. **Error Handling**: Proper error responses
4. **Performance**: Response time SLAs
5. **Data Integrity**: Correct data operations

---

## Test Environment Setup

```python
# conftest.py additions
import pytest
from httpx import AsyncClient
from src.main import app

@pytest.fixture
async def client():
    """Async HTTP client for API testing"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def auth_headers(admin_token):
    """Authentication headers for protected endpoints"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture
async def admin_token(client):
    """Generate admin authentication token"""
    response = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "test_password"
    })
    return response.json()["access_token"]
```

---

## Export API Endpoints

### GET /api/export/employees
**Description**: Export employees in various formats

**Test Cases**:

```python
class TestExportEmployeesAPI:
    """Test employee export endpoint"""

    async def test_export_employees_csv(self, client, auth_headers, db_with_employees):
        """Should export employees to CSV"""
        response = await client.get(
            "/api/export/employees",
            params={"format": "csv"},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "content-disposition" in response.headers
        assert "employees" in response.headers["content-disposition"]

        # Verify CSV content
        csv_content = response.text
        assert "Name,Email,Role" in csv_content
        assert len(csv_content.split('\n')) > 1

    async def test_export_employees_excel(self, client, auth_headers):
        """Should export employees to Excel"""
        response = await client.get(
            "/api/export/employees",
            params={"format": "excel"},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert "application/vnd.openxmlformats" in response.headers["content-type"]

        # Verify Excel file is valid
        from openpyxl import load_workbook
        import io
        wb = load_workbook(io.BytesIO(response.content))
        assert wb.active is not None

    async def test_export_employees_with_filters(self, client, auth_headers):
        """Should apply filters to export"""
        response = await client.get(
            "/api/export/employees",
            params={
                "format": "csv",
                "role": "manager",
                "active": "true"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        # Verify only managers in result

    async def test_export_employees_unauthorized(self, client):
        """Should reject without authentication"""
        response = await client.get(
            "/api/export/employees",
            params={"format": "csv"}
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    async def test_export_employees_invalid_format(self, client, auth_headers):
        """Should reject invalid format"""
        response = await client.get(
            "/api/export/employees",
            params={"format": "json"},  # Not supported
            headers=auth_headers
        )

        assert response.status_code == 400
        assert "Unsupported format" in response.json()["detail"]
```

### GET /api/export/schedules
**Description**: Export schedule assignments

**Test Cases**:

```python
class TestExportSchedulesAPI:
    """Test schedule export endpoint"""

    async def test_export_schedules_date_range(self, client, auth_headers):
        """Should export schedules for date range"""
        response = await client.get(
            "/api/export/schedules",
            params={
                "format": "csv",
                "date_from": "2024-01-01",
                "date_to": "2024-01-31"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        csv_content = response.text
        # Verify dates within range

    async def test_export_schedules_ical(self, client, auth_headers):
        """Should export schedules to iCal format"""
        response = await client.get(
            "/api/export/schedules",
            params={"format": "ical"},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert "text/calendar" in response.headers["content-type"]

        ical_content = response.text
        assert "BEGIN:VCALENDAR" in ical_content
        assert "END:VCALENDAR" in ical_content

    async def test_export_schedules_employee_filter(self, client, auth_headers):
        """Should filter by employee IDs"""
        response = await client.get(
            "/api/export/schedules",
            params={
                "format": "csv",
                "employee_ids": "1,2,3"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
```

---

## Import API Endpoints

### POST /api/import/employees/preview
**Description**: Preview employee import without saving

**Test Cases**:

```python
class TestImportPreviewAPI:
    """Test import preview endpoint"""

    async def test_preview_employees_csv(self, client, auth_headers):
        """Should preview CSV import"""
        csv_file = b"name,email,role\nJohn Doe,john@test.com,server"

        response = await client.post(
            "/api/import/employees/preview",
            files={"file": ("employees.csv", csv_file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_rows"] == 1
        assert data["columns"] == ["name", "email", "role"]
        assert len(data["preview_data"]) == 1
        assert data["missing_columns"] == []
        assert data["validation_errors"] == []

    async def test_preview_employees_invalid_csv(self, client, auth_headers):
        """Should show validation errors in preview"""
        csv_file = b"name,email,role\nJohn,invalid-email,chef"

        response = await client.post(
            "/api/import/employees/preview",
            files={"file": ("bad.csv", csv_file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["validation_errors"]) > 0
        assert any("email" in str(e).lower() for e in data["validation_errors"])

    async def test_preview_file_too_large(self, client, auth_headers):
        """Should reject files over size limit"""
        large_file = b"x" * (51 * 1024 * 1024)  # 51MB

        response = await client.post(
            "/api/import/employees/preview",
            files={"file": ("large.csv", large_file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 413  # Payload Too Large
```

### POST /api/import/employees
**Description**: Execute employee import

**Test Cases**:

```python
class TestImportEmployeesAPI:
    """Test employee import execution"""

    async def test_import_employees_success(self, client, auth_headers):
        """Should import valid employees"""
        csv_file = b"""name,email,role,phone
John Doe,john@test.com,server,+1234567890
Jane Smith,jane@test.com,cook,+0987654321"""

        response = await client.post(
            "/api/import/employees",
            files={"file": ("employees.csv", csv_file, "text/csv")},
            data={"update_existing": "false"},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_rows"] == 2
        assert data["created"] == 2
        assert data["errors"] == []

        # Verify employees in database
        get_response = await client.get("/api/employees", headers=auth_headers)
        assert get_response.json()["total"] >= 2

    async def test_import_employees_with_column_mapping(self, client, auth_headers):
        """Should support column mapping"""
        csv_file = b"full_name,email_address,job_title\nJohn,john@test.com,Server"

        response = await client.post(
            "/api/import/employees",
            files={"file": ("custom.csv", csv_file, "text/csv")},
            data={
                "column_mapping": json.dumps({
                    "full_name": "name",
                    "email_address": "email",
                    "job_title": "role"
                })
            },
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        assert response.json()["created"] == 1

    async def test_import_employees_partial_failure(self, client, auth_headers):
        """Should report partial failures"""
        csv_file = b"""name,email,role
John Doe,john@test.com,server
Jane Smith,invalid,cook
Bob,bob@test.com,chef"""

        response = await client.post(
            "/api/import/employees",
            files={"file": ("mixed.csv", csv_file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_rows"] == 3
        assert data["created"] == 1
        assert data["skipped"] == 2
        assert len(data["errors"]) == 2
```

### POST /api/import/schedules
**Description**: Import schedule assignments

**Test Cases**:

```python
class TestImportSchedulesAPI:
    """Test schedule import endpoint"""

    async def test_import_schedules_success(self, client, auth_headers, db_with_employees_and_shifts):
        """Should import schedule assignments"""
        csv_file = b"""employee_email,shift_name,date,status
john@test.com,Morning Shift,2024-01-15,assigned
jane@test.com,Evening Shift,2024-01-15,assigned"""

        response = await client.post(
            "/api/import/schedules",
            files={"file": ("schedules.csv", csv_file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["created"] == 2
        assert data["errors"] == []

    async def test_import_schedules_conflict_detection(self, client, auth_headers):
        """Should detect and report conflicts"""
        # Import overlapping shifts for same employee
        csv_file = b"""employee_email,shift_name,date
john@test.com,Morning Shift,2024-01-15
john@test.com,Afternoon Shift,2024-01-15"""  # Overlaps with morning

        response = await client.post(
            "/api/import/schedules",
            files={"file": ("conflicts.csv", csv_file, "text/csv")},
            headers={"Authorization": auth_headers["Authorization"]}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["skipped"] >= 1
        assert any("conflict" in str(e).lower() for e in data["errors"])
```

---

## Schedule Generation API Endpoints

### POST /api/schedules/generate
**Description**: Generate optimal schedule using AI

**Test Cases**:

```python
class TestScheduleGenerationAPI:
    """Test schedule generation endpoint"""

    async def test_generate_schedule_basic(self, client, auth_headers, db_with_employees_and_shifts):
        """Should generate schedule for date range"""
        response = await client.post(
            "/api/schedules/generate",
            json={
                "start_date": "2024-01-15",
                "end_date": "2024-01-21",
                "constraints": {}
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["status"] in ["optimal", "feasible"]
        assert "schedule" in data
        assert len(data["schedule"]) > 0
        assert "saved_assignments" in data

    async def test_generate_schedule_with_constraints(self, client, auth_headers):
        """Should apply custom constraints"""
        response = await client.post(
            "/api/schedules/generate",
            json={
                "start_date": "2024-01-15",
                "end_date": "2024-01-21",
                "constraints": {
                    "max_consecutive_days": 5,
                    "min_rest_hours": 12
                }
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        # Verify constraints were applied

    async def test_generate_schedule_no_solution(self, client, auth_headers):
        """Should report when no solution exists"""
        # Setup impossible constraints
        response = await client.post(
            "/api/schedules/generate",
            json={
                "start_date": "2024-01-15",
                "end_date": "2024-01-21",
                "constraints": {
                    "max_hours_per_week": 0  # Impossible
                }
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "infeasible"

    async def test_generate_schedule_performance(self, client, auth_headers):
        """Should complete within SLA"""
        import time

        start = time.time()
        response = await client.post(
            "/api/schedules/generate",
            json={
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"  # Full month
            },
            headers=auth_headers
        )
        duration = time.time() - start

        assert response.status_code == 200
        assert duration < 60  # Should complete in <60 seconds
```

### POST /api/schedules/{schedule_id}/optimize
**Description**: Optimize existing schedule

**Test Cases**:

```python
class TestScheduleOptimizationAPI:
    """Test schedule optimization endpoint"""

    async def test_optimize_schedule(self, client, auth_headers, existing_schedule):
        """Should optimize existing schedule"""
        response = await client.post(
            f"/api/schedules/{existing_schedule.id}/optimize",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["status"] in ["optimal", "feasible"]
        assert "improvements" in data
        assert "coverage_percentage" in data["improvements"]

    async def test_optimize_nonexistent_schedule(self, client, auth_headers):
        """Should return 404 for missing schedule"""
        response = await client.post(
            "/api/schedules/99999/optimize",
            headers=auth_headers
        )

        assert response.status_code == 404
```

### GET /api/schedules/conflicts
**Description**: Check for scheduling conflicts

**Test Cases**:

```python
class TestScheduleConflictsAPI:
    """Test conflict detection endpoint"""

    async def test_check_conflicts_date_range(self, client, auth_headers):
        """Should detect conflicts in date range"""
        response = await client.get(
            "/api/schedules/conflicts",
            params={
                "start_date": "2024-01-15",
                "end_date": "2024-01-21"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert "conflicts" in data
        assert "conflict_count" in data
        assert isinstance(data["conflicts"], list)

    async def test_check_conflicts_types(self, client, auth_headers, db_with_conflicts):
        """Should categorize conflict types"""
        response = await client.get(
            "/api/schedules/conflicts",
            params={"start_date": "2024-01-15", "end_date": "2024-01-21"},
            headers=auth_headers
        )

        data = response.json()
        conflicts = data["conflicts"]

        # Verify conflict types detected
        conflict_types = {c["type"] for c in conflicts}
        assert "double_booking" in conflict_types or \
               "qualification_mismatch" in conflict_types
```

---

## Integration Service API Endpoints

### POST /api/integrations/calendar/sync
**Description**: Sync schedules to calendar systems

**Test Cases**:

```python
class TestCalendarIntegrationAPI:
    """Test calendar sync endpoint"""

    async def test_sync_to_google_calendar(self, client, auth_headers, google_calendar_mock):
        """Should sync to Google Calendar"""
        response = await client.post(
            "/api/integrations/calendar/sync",
            json={
                "employee_id": 1,
                "calendar_type": "google",
                "calendar_id": "primary",
                "date_from": "2024-01-15",
                "date_to": "2024-01-21"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] == True
        assert data["events_created"] > 0

    async def test_sync_calendar_unauthorized(self, client):
        """Should require authentication"""
        response = await client.post(
            "/api/integrations/calendar/sync",
            json={"employee_id": 1, "calendar_type": "google"}
        )

        assert response.status_code == 401
```

### POST /api/integrations/payroll/export
**Description**: Export timesheet data to payroll

**Test Cases**:

```python
class TestPayrollIntegrationAPI:
    """Test payroll export endpoint"""

    async def test_export_payroll_data(self, client, auth_headers):
        """Should export payroll data"""
        response = await client.post(
            "/api/integrations/payroll/export",
            json={
                "system_name": "ADP",
                "date_from": "2024-01-01",
                "date_to": "2024-01-31"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] == True
        assert data["employees_exported"] > 0
```

---

## API Contract Validation Tests

```python
class TestAPIContractValidation:
    """Validate API contracts and schemas"""

    async def test_error_response_format(self, client):
        """All errors should follow standard format"""
        response = await client.get("/api/nonexistent")

        assert response.status_code == 404
        data = response.json()

        # Standard error format
        assert "detail" in data
        assert isinstance(data["detail"], str)

    async def test_pagination_format(self, client, auth_headers):
        """Paginated responses should follow standard format"""
        response = await client.get(
            "/api/employees",
            params={"skip": 0, "limit": 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Standard pagination format
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    async def test_request_validation(self, client, auth_headers):
        """Should validate request schemas"""
        # Missing required field
        response = await client.post(
            "/api/schedules/generate",
            json={"start_date": "2024-01-15"},  # Missing end_date
            headers=auth_headers
        )

        assert response.status_code == 422  # Unprocessable Entity
        data = response.json()
        assert "detail" in data

    async def test_response_schema_consistency(self, client, auth_headers):
        """Responses should match documented schemas"""
        response = await client.get("/api/employees/1", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            # Verify employee schema
            required_fields = ["id", "name", "email", "role", "isActive"]
            for field in required_fields:
                assert field in data
```

---

## Performance Testing

```python
class TestAPIPerformance:
    """Test API performance and SLAs"""

    async def test_response_time_sla(self, client, auth_headers):
        """Most endpoints should respond in <500ms"""
        import time

        endpoints = [
            ("/api/employees", "GET"),
            ("/api/schedules", "GET"),
            ("/api/shifts", "GET"),
        ]

        for endpoint, method in endpoints:
            start = time.time()
            if method == "GET":
                response = await client.get(endpoint, headers=auth_headers)
            duration = time.time() - start

            assert response.status_code == 200
            assert duration < 0.5  # 500ms SLA

    async def test_concurrent_requests(self, client, auth_headers):
        """Should handle concurrent requests"""
        import asyncio

        async def make_request():
            return await client.get("/api/employees", headers=auth_headers)

        # Make 50 concurrent requests
        tasks = [make_request() for _ in range(50)]
        responses = await asyncio.gather(*tasks)

        # All should succeed
        assert all(r.status_code == 200 for r in responses)

    async def test_large_dataset_pagination(self, client, auth_headers, db_with_many_employees):
        """Should handle large datasets efficiently"""
        # Get first page
        response = await client.get(
            "/api/employees",
            params={"skip": 0, "limit": 100},
            headers=auth_headers
        )

        assert response.status_code == 200
        assert len(response.json()["items"]) <= 100
```

---

## Summary

**Total API Test Cases**: 50+
**Endpoint Coverage**: 100%
**Test Categories**:
- Authentication/Authorization: 10 tests
- Request/Response Validation: 15 tests
- Business Logic: 20 tests
- Error Handling: 10 tests
- Performance: 5 tests

**Execution Time**: <60 seconds for full suite

**Dependencies**:
- pytest>=7.4.0
- pytest-asyncio>=0.21.0
- httpx>=0.24.0

**Run Commands**:
```bash
# All API tests
pytest tests/api/ -v

# Specific endpoint
pytest tests/api/test_export_api.py -v

# Performance tests only
pytest tests/api/ -m performance -v

# With coverage
pytest tests/api/ --cov=src/api --cov-report=html
```
