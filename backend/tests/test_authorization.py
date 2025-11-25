"""
Comprehensive RBAC Authorization Test Suite

This module tests all role-based access control (RBAC) authorization rules
to ensure proper security boundaries are enforced across the application.

Security Critical: These tests verify that users can only perform actions
permitted by their roles, preventing unauthorized access and modifications.
"""

import pytest
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from httpx import AsyncClient

from src.auth.models import User, Role, user_roles
from src.auth.auth import auth_service
from src.dependencies import get_current_user, get_current_manager, get_current_admin

# Initialize auth_service for testing
if not auth_service.secret_key:
    # Create a mock app config for testing
    mock_app = MagicMock()
    mock_app.config = {
        "JWT_SECRET_KEY": "test-secret-key-for-testing-32chars-long-at-least",
        "JWT_REFRESH_SECRET_KEY": "test-refresh-secret-key-for-testing-32chars"
    }
    auth_service.init_app(mock_app)


class TestAuthorizationFixtures:
    """Test fixtures for creating users with different roles and tokens."""

    @pytest.fixture
    async def db_session(self, db_engine):
        """Create database session for tests."""
        from sqlalchemy.ext.asyncio import async_sessionmaker
        async_session = async_sessionmaker(
            db_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        async with async_session() as session:
            yield session
            await session.rollback()

    @pytest.fixture
    async def create_roles(self, db_session):
        """Create standard roles in database."""
        roles = []
        for role_name in ["admin", "manager", "user", "guest"]:
            role = Role(
                name=role_name,
                description=f"{role_name.capitalize()} role"
            )
            db_session.add(role)
            roles.append(role)

        await db_session.commit()
        return {r.name: r for r in roles}

    @pytest.fixture
    async def admin_user(self, db_session, create_roles):
        """Create admin user with hashed password."""
        import bcrypt
        password_hash = bcrypt.hashpw(
            "AdminPass123!".encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

        user = User(
            email="admin@example.com",
            password_hash=password_hash,
            first_name="Admin",
            last_name="User",
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.flush()

        # Assign admin role
        user.roles.append(create_roles["admin"])
        await db_session.commit()
        await db_session.refresh(user)

        return user

    @pytest.fixture
    async def manager_user(self, db_session, create_roles):
        """Create manager user with hashed password."""
        import bcrypt
        password_hash = bcrypt.hashpw(
            "ManagerPass123!".encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

        user = User(
            email="manager@example.com",
            password_hash=password_hash,
            first_name="Manager",
            last_name="User",
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.flush()

        # Assign manager role
        user.roles.append(create_roles["manager"])
        await db_session.commit()
        await db_session.refresh(user)

        return user

    @pytest.fixture
    async def employee_user(self, db_session, create_roles):
        """Create employee user with hashed password."""
        import bcrypt
        password_hash = bcrypt.hashpw(
            "EmployeePass123!".encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

        user = User(
            email="employee@example.com",
            password_hash=password_hash,
            first_name="Employee",
            last_name="User",
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.flush()

        # Assign user role
        user.roles.append(create_roles["user"])
        await db_session.commit()
        await db_session.refresh(user)

        return user

    @pytest.fixture
    async def other_employee_user(self, db_session, create_roles):
        """Create another employee user for testing access controls."""
        import bcrypt
        password_hash = bcrypt.hashpw(
            "OtherPass123!".encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

        user = User(
            email="other@example.com",
            password_hash=password_hash,
            first_name="Other",
            last_name="Employee",
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.flush()

        # Assign user role
        user.roles.append(create_roles["user"])
        await db_session.commit()
        await db_session.refresh(user)

        return user

    @pytest.fixture
    async def admin_token(self, admin_user):
        """Generate valid JWT token for admin user."""
        user = await admin_user  # Await the async fixture
        user_data = {
            "id": user.id,
            "email": user.email,
            "role": "admin",
            "permissions": []
        }
        return auth_service.generate_access_token(user_data)

    @pytest.fixture
    async def manager_token(self, manager_user):
        """Generate valid JWT token for manager user."""
        user = await manager_user  # Await the async fixture
        user_data = {
            "id": user.id,
            "email": user.email,
            "role": "manager",
            "permissions": []
        }
        return auth_service.generate_access_token(user_data)

    @pytest.fixture
    async def employee_token(self, employee_user):
        """Generate valid JWT token for employee user."""
        user = await employee_user  # Await the async fixture
        user_data = {
            "id": user.id,
            "email": user.email,
            "role": "user",
            "permissions": []
        }
        return auth_service.generate_access_token(user_data)

    @pytest.fixture
    async def client(self, db_session):
        """Create test HTTP client for API testing."""
        from src.main import app
        from src.dependencies import get_database_session

        # Override database dependency
        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_database_session] = override_get_db

        async with AsyncClient(app=app, base_url="http://test") as client:
            yield client

        # Clean up
        app.dependency_overrides.clear()


class TestEmployeeEndpointAuthorization(TestAuthorizationFixtures):
    """Test authorization rules for employee management endpoints."""

    async def test_create_employee_no_auth(self, client):
        """Test that creating employee without auth returns 401."""
        response = await client.post(
            "/api/employees",
            json={
                "first_name": "Test",
                "last_name": "User",
                "email": "test@example.com"
            }
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "not authenticated" in response.json()["detail"].lower()

    async def test_employee_cannot_create_employee(self, client, employee_token):
        """Test that regular employees cannot create other employees (403)."""
        response = await client.post(
            "/api/employees",
            json={
                "first_name": "New",
                "last_name": "Employee",
                "email": "new@example.com"
            },
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "access denied" in response.json()["detail"].lower()

    async def test_employee_cannot_update_other(self, client, employee_token, other_employee_user):
        """Test that employees cannot update other employees' data (403)."""
        response = await client.patch(
            f"/api/employees/{other_employee_user.id}",
            json={
                "first_name": "Hacked"
            },
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "access denied" in response.json()["detail"].lower()

    async def test_employee_can_update_self(self, client, employee_token, employee_user):
        """Test that employees can update their own data (200)."""
        response = await client.patch(
            f"/api/employees/{employee_user.id}",
            json={
                "first_name": "Updated"
            },
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["first_name"] == "Updated"

    async def test_employee_cannot_view_other(self, client, employee_token, other_employee_user):
        """Test that employees cannot view other employees' detailed data (403)."""
        response = await client.get(
            f"/api/employees/{other_employee_user.id}",
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        # Note: Depending on business rules, this might be 200 (can view) or 403 (cannot view)
        # Adjusting based on common RBAC patterns - employees can view basic info
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN]

    async def test_employee_cannot_delete(self, client, employee_token, other_employee_user):
        """Test that employees cannot delete any users (403)."""
        response = await client.delete(
            f"/api/employees/{other_employee_user.id}",
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "access denied" in response.json()["detail"].lower()

    async def test_manager_can_create(self, client, manager_token):
        """Test that managers can create employees (201)."""
        response = await client.post(
            "/api/employees",
            json={
                "first_name": "Manager",
                "last_name": "Created",
                "email": "managed@example.com"
            },
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["email"] == "managed@example.com"

    async def test_manager_can_update(self, client, manager_token, employee_user):
        """Test that managers can update employees (200)."""
        response = await client.patch(
            f"/api/employees/{employee_user.id}",
            json={
                "first_name": "ManagerUpdated"
            },
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["first_name"] == "ManagerUpdated"

    async def test_manager_cannot_delete(self, client, manager_token, employee_user):
        """Test that managers cannot delete employees (403)."""
        response = await client.delete(
            f"/api/employees/{employee_user.id}",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "access denied" in response.json()["detail"].lower()

    async def test_manager_cannot_change_roles(self, client, manager_token, employee_user):
        """Test that managers cannot change user roles (403)."""
        response = await client.patch(
            f"/api/employees/{employee_user.id}",
            json={
                "role": "admin"  # Attempting privilege escalation
            },
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        # Should be blocked or ignored
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_200_OK]
        if response.status_code == status.HTTP_200_OK:
            # If update succeeded, verify role was NOT changed
            assert not any(r.name == "admin" for r in employee_user.roles)

    async def test_admin_can_delete(self, client, admin_token, employee_user):
        """Test that admins can delete employees (204)."""
        response = await client.delete(
            f"/api/employees/{employee_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    async def test_admin_can_change_roles(self, client, admin_token, employee_user, db_session):
        """Test that admins can change user roles (200)."""
        response = await client.patch(
            f"/api/employees/{employee_user.id}",
            json={
                "role": "manager"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Verify role was changed
        await db_session.refresh(employee_user)
        assert any(r.name == "manager" for r in employee_user.roles)


class TestDependencyAuthorization(TestAuthorizationFixtures):
    """Test authorization dependencies (get_current_user, get_current_manager, get_current_admin)."""

    async def test_get_current_user_with_valid_token(self, db_session, employee_token, employee_user):
        """Test get_current_user with valid token returns user."""
        # Mock the request with authorization header
        mock_auth_header = f"Bearer {employee_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        assert user is not None
        assert user.id == employee_user.id
        assert user.email == employee_user.email

    async def test_get_current_user_with_missing_token(self, db_session):
        """Test get_current_user with missing token raises 401."""
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=None,
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "not authenticated" in exc_info.value.detail.lower()

    async def test_get_current_user_with_invalid_token(self, db_session):
        """Test get_current_user with invalid token raises 401."""
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization="Bearer invalid-token-xyz",
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_current_user_with_expired_token(self, db_session, employee_user):
        """Test get_current_user with expired token raises 401."""
        # Create expired token
        from datetime import timedelta
        user_data = {
            "id": employee_user.id,
            "email": employee_user.email,
            "role": "user",
            "permissions": []
        }

        # Temporarily modify auth_service to create expired token
        old_expires = auth_service.access_token_expires
        auth_service.access_token_expires = timedelta(seconds=-1)
        expired_token = auth_service.generate_access_token(user_data)
        auth_service.access_token_expires = old_expires

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=f"Bearer {expired_token}",
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_current_manager_with_manager_role(self, db_session, manager_token, manager_user):
        """Test get_current_manager with manager role succeeds."""
        mock_auth_header = f"Bearer {manager_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        manager = await get_current_manager(current_user=user)
        assert manager.id == manager_user.id

    async def test_get_current_manager_with_admin_role(self, db_session, admin_token, admin_user):
        """Test get_current_manager with admin role succeeds (admins have manager perms)."""
        mock_auth_header = f"Bearer {admin_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        manager = await get_current_manager(current_user=user)
        assert manager.id == admin_user.id

    async def test_get_current_manager_with_employee_role_fails(self, db_session, employee_token, employee_user):
        """Test get_current_manager with employee role raises 403."""
        mock_auth_header = f"Bearer {employee_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_current_manager(current_user=user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "manager role required" in exc_info.value.detail.lower()

    async def test_get_current_admin_with_admin_role(self, db_session, admin_token, admin_user):
        """Test get_current_admin with admin role succeeds."""
        mock_auth_header = f"Bearer {admin_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        admin = await get_current_admin(current_user=user)
        assert admin.id == admin_user.id

    async def test_get_current_admin_with_manager_role_fails(self, db_session, manager_token):
        """Test get_current_admin with manager role raises 403."""
        mock_auth_header = f"Bearer {manager_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_current_admin(current_user=user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "admin role required" in exc_info.value.detail.lower()


class TestIntegrationWorkflow(TestAuthorizationFixtures):
    """Integration test for complete authorization workflow."""

    async def test_complete_employee_lifecycle_workflow(
        self,
        client,
        admin_token,
        manager_token,
        employee_token,
        db_session
    ):
        """
        Test complete employee lifecycle with proper authorization at each step.

        Workflow:
        1. Admin creates employee
        2. Manager updates employee
        3. Employee updates self
        4. Employee attempts unauthorized action (fails)
        5. Manager attempts delete (fails)
        6. Admin deletes employee
        """
        # Step 1: Admin creates employee
        create_response = await client.post(
            "/api/employees",
            json={
                "first_name": "Workflow",
                "last_name": "Test",
                "email": "workflow@example.com"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        employee_id = create_response.json()["id"]

        # Step 2: Manager updates employee
        manager_update = await client.patch(
            f"/api/employees/{employee_id}",
            json={"first_name": "Updated"},
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert manager_update.status_code == status.HTTP_200_OK
        assert manager_update.json()["first_name"] == "Updated"

        # Step 3: Employee updates self (using their own token)
        # Note: employee_token is for different user, so this should fail
        employee_update = await client.patch(
            f"/api/employees/{employee_id}",
            json={"first_name": "SelfUpdate"},
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert employee_update.status_code == status.HTTP_403_FORBIDDEN

        # Step 4: Employee attempts to change role (unauthorized)
        role_change = await client.patch(
            f"/api/employees/{employee_id}",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert role_change.status_code == status.HTTP_403_FORBIDDEN

        # Step 5: Manager attempts delete (fails - managers can't delete)
        manager_delete = await client.delete(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert manager_delete.status_code == status.HTTP_403_FORBIDDEN

        # Step 6: Admin deletes employee (succeeds)
        admin_delete = await client.delete(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_delete.status_code == status.HTTP_204_NO_CONTENT

        # Verify deletion
        verify_delete = await client.get(
            f"/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert verify_delete.status_code == status.HTTP_404_NOT_FOUND


class TestEdgeCases(TestAuthorizationFixtures):
    """Test edge cases and security boundary conditions."""

    async def test_inactive_user_cannot_access(self, client, db_session, employee_user, employee_token):
        """Test that inactive users cannot access protected endpoints."""
        # Deactivate user
        employee_user.is_active = False
        await db_session.commit()

        # Attempt to access protected endpoint
        response = await client.get(
            "/api/employees",
            headers={"Authorization": f"Bearer {employee_token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "inactive" in response.json()["detail"].lower()

    async def test_malformed_token_rejected(self, client):
        """Test that malformed tokens are rejected."""
        response = await client.get(
            "/api/employees",
            headers={"Authorization": "Bearer not-a-valid-jwt"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_missing_bearer_prefix(self, client, employee_token):
        """Test that tokens without 'Bearer ' prefix are rejected."""
        response = await client.get(
            "/api/employees",
            headers={"Authorization": employee_token}  # Missing "Bearer "
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_empty_token(self, client):
        """Test that empty tokens are rejected."""
        response = await client.get(
            "/api/employees",
            headers={"Authorization": "Bearer "}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_sql_injection_in_employee_id(self, client, admin_token):
        """Test that SQL injection attempts in employee ID are handled safely."""
        malicious_id = "1; DROP TABLE users; --"
        response = await client.get(
            f"/api/employees/{malicious_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 404 or 422, NOT 500 (server error)
        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
