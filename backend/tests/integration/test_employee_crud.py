"""
Integration tests for Employee CRUD operations.

Tests cover:
- Create employee with all fields
- Read employee with proper data transformation
- Update employee partial fields
- Delete employee
- List employees with pagination
- Filter employees by department/role
- Search employees by name
"""

import pytest
from datetime import datetime


class TestEmployeeCRUD:
    """Integration tests for Employee endpoints."""

    @pytest.mark.asyncio
    async def test_create_employee_with_all_fields(self, client, auth_headers):
        """Test creating employee with complete data."""
        employee_data = {
            "name": "John Doe",
            "email": "john.doe@company.com",
            "phone": "+1234567890",
            "role": "Software Engineer",
            "hourlyRate": 50.00,
            "maxHoursPerWeek": 40,
            "qualifications": ["Python", "React", "AWS"],
            "availabilityPattern": {
                "monday": [{"start": "09:00", "end": "17:00"}],
                "tuesday": [{"start": "09:00", "end": "17:00"}],
                "wednesday": [{"start": "09:00", "end": "17:00"}],
                "thursday": [{"start": "09:00", "end": "17:00"}],
                "friday": [{"start": "09:00", "end": "17:00"}]
            },
            "departmentId": 1,
            "active": True
        }

        response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == employee_data["name"]
        assert data["email"] == employee_data["email"]
        assert data["role"] == employee_data["role"]
        assert data["hourlyRate"] == employee_data["hourlyRate"]
        assert data["qualifications"] == employee_data["qualifications"]
        assert "id" in data
        assert "createdAt" in data

    @pytest.mark.asyncio
    async def test_create_employee_with_minimal_fields(self, client, auth_headers):
        """Test creating employee with only required fields."""
        employee_data = {
            "name": "Jane Smith",
            "email": "jane.smith@company.com",
            "role": "Manager"
        }

        response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == employee_data["name"]
        assert data["email"] == employee_data["email"]
        assert data["active"] is True  # Default value

    @pytest.mark.asyncio
    async def test_create_employee_duplicate_email(self, client, auth_headers):
        """Test creating employee with duplicate email fails."""
        employee_data = {
            "name": "Duplicate User",
            "email": "duplicate@company.com",
            "role": "Developer"
        }

        # First creation succeeds
        response1 = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        assert response1.status_code == 201

        # Second creation fails
        response2 = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        assert response2.status_code == 409  # Conflict

    @pytest.mark.asyncio
    async def test_get_employee_by_id(self, client, auth_headers):
        """Test retrieving employee by ID."""
        # Create employee
        employee_data = {
            "name": "Get Test User",
            "email": "gettest@company.com",
            "role": "Analyst"
        }
        create_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = create_response.json()["id"]

        # Get employee
        response = await client.get(
            f"/api/employees/{employee_id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == employee_id
        assert data["name"] == employee_data["name"]
        assert data["email"] == employee_data["email"]

    @pytest.mark.asyncio
    async def test_get_nonexistent_employee(self, client, auth_headers):
        """Test retrieving non-existent employee returns 404."""
        response = await client.get(
            "/api/employees/99999",
            headers=auth_headers
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_employee_partial_fields(self, client, auth_headers):
        """Test updating only specific employee fields."""
        # Create employee
        employee_data = {
            "name": "Update Test User",
            "email": "updatetest@company.com",
            "role": "Junior Developer",
            "hourlyRate": 30.00
        }
        create_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = create_response.json()["id"]

        # Update only role and hourly rate
        update_data = {
            "role": "Senior Developer",
            "hourlyRate": 55.00
        }
        response = await client.patch(
            f"/api/employees/{employee_id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == update_data["role"]
        assert data["hourlyRate"] == update_data["hourlyRate"]
        assert data["name"] == employee_data["name"]  # Unchanged
        assert data["email"] == employee_data["email"]  # Unchanged

    @pytest.mark.asyncio
    async def test_update_employee_full_replace(self, client, auth_headers):
        """Test full employee update with PUT."""
        # Create employee
        employee_data = {
            "name": "Full Update User",
            "email": "fullupdate@company.com",
            "role": "Developer"
        }
        create_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = create_response.json()["id"]

        # Full update
        update_data = {
            "name": "Updated Full Name",
            "email": "updated@company.com",
            "role": "Lead Developer",
            "phone": "+9876543210",
            "hourlyRate": 60.00,
            "maxHoursPerWeek": 35
        }
        response = await client.put(
            f"/api/employees/{employee_id}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["email"] == update_data["email"]
        assert data["role"] == update_data["role"]
        assert data["phone"] == update_data["phone"]

    @pytest.mark.asyncio
    async def test_delete_employee(self, client, auth_headers):
        """Test deleting employee."""
        # Create employee
        employee_data = {
            "name": "Delete Test User",
            "email": "deletetest@company.com",
            "role": "Temporary"
        }
        create_response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )
        employee_id = create_response.json()["id"]

        # Delete employee
        response = await client.delete(
            f"/api/employees/{employee_id}",
            headers=auth_headers
        )

        assert response.status_code == 204

        # Verify employee is deleted
        get_response = await client.get(
            f"/api/employees/{employee_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_employee(self, client, auth_headers):
        """Test deleting non-existent employee."""
        response = await client.delete(
            "/api/employees/99999",
            headers=auth_headers
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_employees_with_pagination(self, client, auth_headers):
        """Test listing employees with pagination."""
        # Create multiple employees
        for i in range(15):
            employee_data = {
                "name": f"Employee {i}",
                "email": f"employee{i}@company.com",
                "role": "Staff"
            }
            await client.post(
                "/api/employees",
                json=employee_data,
                headers=auth_headers
            )

        # Get first page
        response = await client.get(
            "/api/employees?page=1&pageSize=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "employees" in data or "items" in data
        assert "total" in data
        assert "page" in data
        assert len(data.get("employees", data.get("items", []))) <= 10

    @pytest.mark.asyncio
    async def test_filter_employees_by_department(self, client, auth_headers):
        """Test filtering employees by department."""
        # Create employees in different departments
        dept1_employee = {
            "name": "Dept 1 Employee",
            "email": "dept1@company.com",
            "role": "Developer",
            "departmentId": 1
        }
        dept2_employee = {
            "name": "Dept 2 Employee",
            "email": "dept2@company.com",
            "role": "Manager",
            "departmentId": 2
        }

        await client.post("/api/employees", json=dept1_employee, headers=auth_headers)
        await client.post("/api/employees", json=dept2_employee, headers=auth_headers)

        # Filter by department 1
        response = await client.get(
            "/api/employees?departmentId=1",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        employees = data.get("employees", data.get("items", []))
        assert all(emp.get("departmentId") == 1 for emp in employees)

    @pytest.mark.asyncio
    async def test_filter_employees_by_role(self, client, auth_headers):
        """Test filtering employees by role."""
        # Create employees with different roles
        roles = ["Developer", "Manager", "Analyst", "Developer"]
        for i, role in enumerate(roles):
            employee_data = {
                "name": f"Role Test {i}",
                "email": f"roletest{i}@company.com",
                "role": role
            }
            await client.post("/api/employees", json=employee_data, headers=auth_headers)

        # Filter by Developer role
        response = await client.get(
            "/api/employees?role=Developer",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        employees = data.get("employees", data.get("items", []))
        assert all(emp["role"] == "Developer" for emp in employees)
        assert len(employees) == 2

    @pytest.mark.asyncio
    async def test_search_employees_by_name(self, client, auth_headers):
        """Test searching employees by name."""
        # Create employees
        names = ["Alice Johnson", "Bob Smith", "Alice Cooper"]
        for name in names:
            employee_data = {
                "name": name,
                "email": f"{name.lower().replace(' ', '.')}@company.com",
                "role": "Staff"
            }
            await client.post("/api/employees", json=employee_data, headers=auth_headers)

        # Search for "Alice"
        response = await client.get(
            "/api/employees?search=Alice",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        employees = data.get("employees", data.get("items", []))
        assert len(employees) == 2
        assert all("Alice" in emp["name"] for emp in employees)

    @pytest.mark.asyncio
    async def test_search_employees_by_email(self, client, auth_headers):
        """Test searching employees by email."""
        employee_data = {
            "name": "Email Search Test",
            "email": "unique.email@company.com",
            "role": "Developer"
        }
        await client.post("/api/employees", json=employee_data, headers=auth_headers)

        response = await client.get(
            "/api/employees?search=unique.email",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        employees = data.get("employees", data.get("items", []))
        assert len(employees) >= 1
        assert any("unique.email" in emp["email"] for emp in employees)

    @pytest.mark.asyncio
    async def test_filter_active_employees_only(self, client, auth_headers):
        """Test filtering only active employees."""
        # Create active and inactive employees
        active_employee = {
            "name": "Active Employee",
            "email": "active@company.com",
            "role": "Developer",
            "active": True
        }
        inactive_employee = {
            "name": "Inactive Employee",
            "email": "inactive@company.com",
            "role": "Developer",
            "active": False
        }

        await client.post("/api/employees", json=active_employee, headers=auth_headers)
        await client.post("/api/employees", json=inactive_employee, headers=auth_headers)

        # Filter active only
        response = await client.get(
            "/api/employees?active=true",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        employees = data.get("employees", data.get("items", []))
        assert all(emp.get("active") is True for emp in employees)

    @pytest.mark.asyncio
    async def test_employee_data_transformation(self, client, auth_headers):
        """Test that employee data is properly transformed to camelCase."""
        employee_data = {
            "name": "Transform Test",
            "email": "transform@company.com",
            "role": "Developer",
            "hourlyRate": 45.50,
            "maxHoursPerWeek": 40
        }

        response = await client.post(
            "/api/employees",
            json=employee_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        data = response.json()

        # Verify camelCase transformation
        assert "hourlyRate" in data
        assert "maxHoursPerWeek" in data
        assert "createdAt" in data
        assert "updatedAt" in data
        # Ensure snake_case is not present
        assert "hourly_rate" not in data
        assert "max_hours_per_week" not in data
