"""
Test RBAC authorization for employee endpoints.

This test file verifies that role-based access control is properly
enforced on all employee API endpoints.
"""

import pytest
from fastapi import status
from httpx import AsyncClient


class TestEmployeeRBAC:
    """Test RBAC for employee endpoints."""

    async def test_get_employees_as_admin(self, async_client: AsyncClient, admin_token):
        """Admin should be able to view all employees."""
        response = await async_client.get(
            "/api/employees",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == status.HTTP_200_OK

    async def test_get_employees_as_employee(self, async_client: AsyncClient, employee_token, employee_id):
        """Regular employee should only see their own profile."""
        response = await async_client.get(
            "/api/employees",
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should only return one employee (themselves)
        assert len(data) == 1
        assert data[0]["id"] == employee_id

    async def test_get_employee_as_admin(self, async_client: AsyncClient, admin_token, employee_id):
        """Admin should be able to view any employee."""
        response = await async_client.get(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == status.HTTP_200_OK

    async def test_get_employee_as_unauthorized_user(self, async_client: AsyncClient, employee_token, other_employee_id):
        """Regular employee should NOT be able to view other employees."""
        response = await async_client.get(
            f"/api/employees/{other_employee_id}",
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_create_employee_as_admin(self, async_client: AsyncClient, admin_token):
        """Admin should be able to create employees."""
        response = await async_client.post(
            "/api/employees",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "first_name": "Test",
                "last_name": "Employee",
                "email": "test@example.com"
            }
        )
        assert response.status_code == status.HTTP_201_CREATED

    async def test_create_employee_as_manager(self, async_client: AsyncClient, manager_token):
        """Manager should be able to create employees."""
        response = await async_client.post(
            "/api/employees",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={
                "first_name": "Test",
                "last_name": "Manager Employee",
                "email": "test2@example.com"
            }
        )
        assert response.status_code == status.HTTP_201_CREATED

    async def test_create_employee_as_employee(self, async_client: AsyncClient, employee_token):
        """Regular employee should NOT be able to create employees."""
        response = await async_client.post(
            "/api/employees",
            headers={"Authorization": f"Bearer {employee_token}"},
            json={
                "first_name": "Test",
                "last_name": "Employee",
                "email": "test3@example.com"
            }
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_update_employee_as_admin(self, async_client: AsyncClient, admin_token, employee_id):
        """Admin should be able to update any employee."""
        response = await async_client.patch(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"first_name": "Updated"}
        )
        assert response.status_code == status.HTTP_200_OK

    async def test_update_employee_as_manager(self, async_client: AsyncClient, manager_token, employee_id):
        """Manager should be able to update employees."""
        response = await async_client.patch(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={"first_name": "Updated"}
        )
        assert response.status_code == status.HTTP_200_OK

    async def test_update_own_profile_as_employee(self, async_client: AsyncClient, employee_token, employee_id):
        """Employee should be able to update their own profile."""
        response = await async_client.patch(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {employee_token}"},
            json={"first_name": "Self Updated"}
        )
        assert response.status_code == status.HTTP_200_OK

    async def test_update_other_employee_as_employee(self, async_client: AsyncClient, employee_token, other_employee_id):
        """Employee should NOT be able to update other employees."""
        response = await async_client.patch(
            f"/api/employees/{other_employee_id}",
            headers={"Authorization": f"Bearer {employee_token}"},
            json={"first_name": "Unauthorized Update"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_change_role_as_admin(self, async_client: AsyncClient, admin_token, employee_id):
        """Admin should be able to change user roles."""
        response = await async_client.patch(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "manager"}
        )
        assert response.status_code == status.HTTP_200_OK

    async def test_change_role_as_manager(self, async_client: AsyncClient, manager_token, employee_id):
        """Manager should NOT be able to change user roles."""
        response = await async_client.patch(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={"role": "admin"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_delete_employee_as_admin(self, async_client: AsyncClient, admin_token, employee_id):
        """Admin should be able to delete employees."""
        response = await async_client.delete(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    async def test_delete_employee_as_manager(self, async_client: AsyncClient, manager_token, employee_id):
        """Manager should NOT be able to delete employees."""
        response = await async_client.delete(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    async def test_delete_employee_as_employee(self, async_client: AsyncClient, employee_token, employee_id):
        """Regular employee should NOT be able to delete employees."""
        response = await async_client.delete(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
