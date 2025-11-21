"""
Integration tests for Schedule CRUD operations.

Tests cover:
- Create schedule assignment
- Generate schedule for date range
- Update schedule shift
- Delete schedule
- List schedules with filters
- Get employee schedule
- Conflict detection
"""

import pytest
from datetime import date, datetime, timedelta


class TestScheduleCRUD:
    """Integration tests for Schedule endpoints."""

    @pytest.mark.asyncio
    async def test_create_schedule_assignment(self, client, auth_headers):
        """Test creating a schedule assignment."""
        # First create employee and shift
        employee_data = {
            "name": "Schedule Employee",
            "email": "schedule@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Morning Shift",
            "shiftType": "morning",
            "startTime": "09:00:00",
            "endTime": "17:00:00",
            "requiredStaff": 2
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        # Create schedule
        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift_id,
            "date": str(date.today()),
            "status": "scheduled",
            "notes": "Regular shift"
        }

        response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["employeeId"] == employee_id
        assert data["shiftId"] == shift_id
        assert data["status"] == "scheduled"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_schedule_with_overtime_approval(self, client, auth_headers):
        """Test creating schedule with overtime approval flag."""
        employee_data = {
            "name": "Overtime Employee",
            "email": "overtime@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Extended Shift",
            "shiftType": "evening",
            "startTime": "17:00:00",
            "endTime": "01:00:00",
            "requiredStaff": 1
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift_id,
            "date": str(date.today() + timedelta(days=1)),
            "overtimeApproved": True,
            "notes": "Approved overtime for special project"
        }

        response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["overtimeApproved"] is True

    @pytest.mark.asyncio
    async def test_generate_schedule_for_date_range(self, client, auth_headers):
        """Test generating schedules for a date range."""
        # Create employees and shifts first
        for i in range(3):
            employee_data = {
                "name": f"Auto Schedule Employee {i}",
                "email": f"autoschedule{i}@company.com",
                "role": "Staff"
            }
            await client.post("/api/employees", json=employee_data, headers=auth_headers)

        shift_data = {
            "name": "Standard Shift",
            "shiftType": "day",
            "startTime": "08:00:00",
            "endTime": "16:00:00",
            "requiredStaff": 2
        }
        await client.post("/api/shifts", json=shift_data, headers=auth_headers)

        # Generate schedule
        generate_data = {
            "startDate": str(date.today()),
            "endDate": str(date.today() + timedelta(days=7)),
            "shiftIds": [1],
            "optimize": True
        }

        response = await client.post(
            "/api/schedules/generate",
            json=generate_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert "schedules" in data
        assert len(data["schedules"]) > 0

    @pytest.mark.asyncio
    async def test_update_schedule_status(self, client, auth_headers):
        """Test updating schedule status."""
        # Create schedule
        employee_data = {
            "name": "Status Update Employee",
            "email": "statusupdate@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Update Status Shift",
            "shiftType": "morning",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift_id,
            "date": str(date.today()),
            "status": "scheduled"
        }
        create_response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )
        schedule_id = create_response.json()["id"]

        # Update status
        update_data = {"status": "completed"}
        response = await client.patch(
            f"/api/schedules/{schedule_id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_update_schedule_shift_change(self, client, auth_headers):
        """Test changing the shift of a schedule."""
        # Setup
        employee_data = {
            "name": "Shift Change Employee",
            "email": "shiftchange@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        # Create two shifts
        shift1_data = {
            "name": "Morning Shift",
            "shiftType": "morning",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift1_response = await client.post(
            "/api/shifts",
            json=shift1_data,
            headers=auth_headers
        )
        shift1_id = shift1_response.json()["id"]

        shift2_data = {
            "name": "Evening Shift",
            "shiftType": "evening",
            "startTime": "17:00:00",
            "endTime": "01:00:00"
        }
        shift2_response = await client.post(
            "/api/shifts",
            json=shift2_data,
            headers=auth_headers
        )
        shift2_id = shift2_response.json()["id"]

        # Create schedule with shift1
        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift1_id,
            "date": str(date.today())
        }
        create_response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )
        schedule_id = create_response.json()["id"]

        # Update to shift2
        update_data = {"shiftId": shift2_id}
        response = await client.patch(
            f"/api/schedules/{schedule_id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["shiftId"] == shift2_id

    @pytest.mark.asyncio
    async def test_delete_schedule(self, client, auth_headers):
        """Test deleting a schedule."""
        # Create schedule
        employee_data = {
            "name": "Delete Schedule Employee",
            "email": "deleteschedule@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Delete Shift",
            "shiftType": "day",
            "startTime": "10:00:00",
            "endTime": "18:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift_id,
            "date": str(date.today())
        }
        create_response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )
        schedule_id = create_response.json()["id"]

        # Delete schedule
        response = await client.delete(
            f"/api/schedules/{schedule_id}",
            headers=auth_headers
        )

        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(
            f"/api/schedules/{schedule_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_schedules_by_date_range(self, client, auth_headers):
        """Test listing schedules filtered by date range."""
        # Create schedules for different dates
        employee_data = {
            "name": "Date Range Employee",
            "email": "daterange@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Range Test Shift",
            "shiftType": "day",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        # Create schedules for next 7 days
        for i in range(7):
            schedule_data = {
                "employeeId": employee_id,
                "shiftId": shift_id,
                "date": str(date.today() + timedelta(days=i))
            }
            await client.post("/api/schedules", json=schedule_data, headers=auth_headers)

        # Query for specific date range
        start_date = date.today()
        end_date = date.today() + timedelta(days=3)

        response = await client.get(
            f"/api/schedules?startDate={start_date}&endDate={end_date}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        schedules = data.get("schedules", data.get("items", []))
        assert len(schedules) == 4  # 4 days inclusive

    @pytest.mark.asyncio
    async def test_get_employee_schedule(self, client, auth_headers):
        """Test getting all schedules for a specific employee."""
        # Create employee
        employee_data = {
            "name": "Employee Schedule Test",
            "email": "empschedule@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        # Create shift
        shift_data = {
            "name": "Employee Shift",
            "shiftType": "day",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        # Create multiple schedules
        for i in range(5):
            schedule_data = {
                "employeeId": employee_id,
                "shiftId": shift_id,
                "date": str(date.today() + timedelta(days=i))
            }
            await client.post("/api/schedules", json=schedule_data, headers=auth_headers)

        # Get employee's schedules
        response = await client.get(
            f"/api/employees/{employee_id}/schedules",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        schedules = data.get("schedules", data.get("items", []))
        assert len(schedules) == 5
        assert all(s["employeeId"] == employee_id for s in schedules)

    @pytest.mark.asyncio
    async def test_schedule_conflict_detection(self, client, auth_headers):
        """Test that conflicting schedules are detected."""
        # Create employee
        employee_data = {
            "name": "Conflict Test Employee",
            "email": "conflict@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        # Create shift
        shift_data = {
            "name": "Conflict Shift",
            "shiftType": "day",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        # Create first schedule
        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift_id,
            "date": str(date.today())
        }
        await client.post("/api/schedules", json=schedule_data, headers=auth_headers)

        # Try to create conflicting schedule (same employee, same date)
        response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )

        # Should return conflict error
        assert response.status_code in [409, 400]
        assert "conflict" in response.json().get("error", "").lower()

    @pytest.mark.asyncio
    async def test_filter_schedules_by_status(self, client, auth_headers):
        """Test filtering schedules by status."""
        employee_data = {
            "name": "Status Filter Employee",
            "email": "statusfilter@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Status Filter Shift",
            "shiftType": "day",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        # Create schedules with different statuses
        statuses = ["scheduled", "completed", "cancelled", "no_show"]
        for i, status in enumerate(statuses):
            schedule_data = {
                "employeeId": employee_id,
                "shiftId": shift_id,
                "date": str(date.today() + timedelta(days=i)),
                "status": status
            }
            await client.post("/api/schedules", json=schedule_data, headers=auth_headers)

        # Filter by completed status
        response = await client.get(
            "/api/schedules?status=completed",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        schedules = data.get("schedules", data.get("items", []))
        assert all(s["status"] == "completed" for s in schedules)

    @pytest.mark.asyncio
    async def test_schedule_data_transformation(self, client, auth_headers):
        """Test that schedule data is properly transformed to camelCase."""
        employee_data = {
            "name": "Transform Schedule Employee",
            "email": "transformschedule@company.com",
            "role": "Staff"
        }
        emp_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = emp_response.json()["id"]

        shift_data = {
            "name": "Transform Shift",
            "shiftType": "day",
            "startTime": "09:00:00",
            "endTime": "17:00:00"
        }
        shift_response = await client.post(
            "/api/shifts",
            json=shift_data,
            headers=auth_headers
        )
        shift_id = shift_response.json()["id"]

        schedule_data = {
            "employeeId": employee_id,
            "shiftId": shift_id,
            "date": str(date.today()),
            "overtimeApproved": True
        }

        response = await client.post(
            "/api/schedules",
            json=schedule_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()

        # Verify camelCase transformation
        assert "employeeId" in data
        assert "shiftId" in data
        assert "overtimeApproved" in data
        assert "createdAt" in data
        assert "updatedAt" in data
        # Ensure snake_case is not present
        assert "employee_id" not in data
        assert "shift_id" not in data
        assert "overtime_approved" not in data
