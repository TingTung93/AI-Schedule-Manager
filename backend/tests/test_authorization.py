"""
Comprehensive RBAC Authorization Test Suite

This module tests all role-based access control (RBAC) authorization rules
to ensure proper security boundaries are enforced across the application.

Security Critical: These tests verify that users can only perform actions
permitted by their roles, preventing unauthorized access and modifications.
"""

import pytest
import bcrypt
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import NullPool

from src.auth.models import User, Role, user_roles, Base
from src.auth.auth import auth_service
from src.dependencies import get_current_user, get_current_manager, get_current_admin

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Initialize auth_service for testing
if not auth_service.secret_key:
    mock_app = MagicMock()
    mock_app.config = {
        "JWT_SECRET_KEY": "test-secret-key-for-testing-32chars-long-at-least",
        "JWT_REFRESH_SECRET_KEY": "test-refresh-secret-key-for-testing-32chars"
    }
    auth_service.init_app(mock_app)


@pytest.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    """Create test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def create_roles(db_session):
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

    # Return dict for easy access
    result = {}
    for role in roles:
        await db_session.refresh(role)
        result[role.name] = role

    return result


@pytest.fixture
async def admin_user(db_session, create_roles):
    """Create admin user."""
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

    user.roles.append(create_roles["admin"])
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
async def manager_user(db_session, create_roles):
    """Create manager user."""
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

    user.roles.append(create_roles["manager"])
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
async def employee_user(db_session, create_roles):
    """Create employee user."""
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

    user.roles.append(create_roles["user"])
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
async def admin_token(admin_user):
    """Generate valid JWT token for admin user."""
    # admin_user is already awaited by pytest-asyncio
    user_data = {
        "id": admin_user.id,
        "email": admin_user.email,
        "role": "admin",
        "permissions": []
    }
    return auth_service.generate_access_token(user_data)


@pytest.fixture
async def manager_token(manager_user):
    """Generate valid JWT token for manager user."""
    # manager_user is already awaited by pytest-asyncio
    user_data = {
        "id": manager_user.id,
        "email": manager_user.email,
        "role": "manager",
        "permissions": []
    }
    return auth_service.generate_access_token(user_data)


@pytest.fixture
async def employee_token(employee_user):
    """Generate valid JWT token for employee user."""
    # employee_user is already awaited by pytest-asyncio
    user_data = {
        "id": employee_user.id,
        "email": employee_user.email,
        "role": "user",
        "permissions": []
    }
    return auth_service.generate_access_token(user_data)


@pytest.mark.asyncio
class TestAuthenticationDependencies:
    """Test authentication and authorization dependencies."""

    async def test_get_current_user_with_valid_token(self, db_session, employee_token, employee_user):
        """Test get_current_user with valid token returns user."""
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

    async def test_get_current_user_with_malformed_header(self, db_session, employee_token):
        """Test get_current_user with malformed header raises 401."""
        # Missing "Bearer " prefix
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=employee_token,
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_current_user_with_empty_token(self, db_session):
        """Test get_current_user with empty token raises 401."""
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization="Bearer ",
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_current_user_with_expired_token(self, db_session, employee_user):
        """Test get_current_user with expired token raises 401."""
        # Create expired token
        user_data = {
            "id": employee_user.id,
            "email": employee_user.email,
            "role": "user",
            "permissions": []
        }

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

    async def test_inactive_user_cannot_authenticate(self, db_session, employee_user, employee_token):
        """Test that inactive users cannot authenticate."""
        employee_user.is_active = False
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=f"Bearer {employee_token}",
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "inactive" in exc_info.value.detail.lower()


@pytest.mark.asyncio
class TestRoleBasedAuthorization:
    """Test role-based authorization using dependency injectors."""

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

    async def test_get_current_admin_with_employee_role_fails(self, db_session, employee_token):
        """Test get_current_admin with employee role raises 403."""
        mock_auth_header = f"Bearer {employee_token}"

        user = await get_current_user(
            authorization=mock_auth_header,
            db=db_session
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_current_admin(current_user=user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
class TestRolePermissions:
    """Test role-based permissions and methods."""

    async def test_user_has_role_check(self, admin_user, manager_user, employee_user):
        """Test has_role method on User model."""
        assert admin_user.has_role("admin")
        assert not admin_user.has_role("employee")

        assert manager_user.has_role("manager")
        assert not manager_user.has_role("admin")

        assert employee_user.has_role("user")
        assert not employee_user.has_role("manager")

    async def test_admin_has_all_privileges(self, admin_user):
        """Test that admin role provides highest privileges."""
        assert admin_user.has_role("admin")
        assert admin_user.is_active

    async def test_manager_has_intermediate_privileges(self, manager_user):
        """Test that manager role has intermediate privileges."""
        assert manager_user.has_role("manager")
        assert not manager_user.has_role("admin")

    async def test_employee_has_basic_privileges(self, employee_user):
        """Test that employee has basic privileges only."""
        assert employee_user.has_role("user")
        assert not employee_user.has_role("manager")
        assert not employee_user.has_role("admin")


@pytest.mark.asyncio
class TestSecurityEdgeCases:
    """Test security edge cases and boundary conditions."""

    async def test_sql_injection_in_token_payload(self, db_session):
        """Test that SQL injection attempts in tokens are handled safely."""
        malicious_token = "Bearer 1; DROP TABLE users; --"

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=malicious_token,
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_locked_account_cannot_authenticate(self, db_session, employee_user, employee_token):
        """Test that locked accounts cannot authenticate."""
        employee_user.is_locked = True
        employee_user.account_locked_until = datetime.now(timezone.utc) + timedelta(hours=1)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=f"Bearer {employee_token}",
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "locked" in exc_info.value.detail.lower()

    async def test_unverified_user_can_still_authenticate(self, db_session, employee_user, employee_token):
        """Test that unverified users can still authenticate (email verification separate)."""
        employee_user.is_verified = False
        await db_session.commit()

        # Should still work - verification is separate from authentication
        user = await get_current_user(
            authorization=f"Bearer {employee_token}",
            db=db_session
        )

        assert user.id == employee_user.id
        assert not user.is_verified

    async def test_deleted_user_cannot_authenticate(self, db_session, employee_user, employee_token):
        """Test that deleted users cannot authenticate."""
        user_id = employee_user.id

        # Delete user
        await db_session.delete(employee_user)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                authorization=f"Bearer {employee_token}",
                db=db_session
            )

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "not found" in exc_info.value.detail.lower()
