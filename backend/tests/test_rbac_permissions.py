"""
Comprehensive Unit Tests for RBAC Permissions Module

Tests the FastAPI-based RBAC foundation that fixes the P0 security vulnerability.

Coverage Areas:
- Permission enumeration
- Role-permission mappings
- User role retrieval
- User permission retrieval
- Permission checking
- Role checking
- Dependency factories (require_role, require_permission)
"""

import pytest
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

# Add backend to path so 'src' package can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.auth.rbac_permissions import (
    Permission,
    ROLE_PERMISSIONS,
    get_user_roles,
    get_user_permissions,
    check_user_role,
    check_user_permission,
    require_role,
    require_permission,
    require_any_permission,
    require_all_permissions,
)
from src.auth.models import User, Role


@pytest.fixture
def mock_db_session():
    """Mock AsyncSession for database operations"""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def mock_admin_user():
    """Mock user with admin role"""
    user = MagicMock(spec=User)
    user.id = 1
    user.email = "admin@example.com"
    user.first_name = "Admin"
    user.last_name = "User"

    admin_role = MagicMock(spec=Role)
    admin_role.name = "admin"
    admin_role.id = 1

    user.roles = [admin_role]
    return user


@pytest.fixture
def mock_manager_user():
    """Mock user with manager role"""
    user = MagicMock(spec=User)
    user.id = 2
    user.email = "manager@example.com"
    user.first_name = "Manager"
    user.last_name = "User"

    manager_role = MagicMock(spec=Role)
    manager_role.name = "manager"
    manager_role.id = 2

    user.roles = [manager_role]
    return user


@pytest.fixture
def mock_employee_user():
    """Mock user with employee role"""
    user = MagicMock(spec=User)
    user.id = 3
    user.email = "employee@example.com"
    user.first_name = "Employee"
    user.last_name = "User"

    employee_role = MagicMock(spec=Role)
    employee_role.name = "employee"
    employee_role.id = 3

    user.roles = [employee_role]
    return user


@pytest.fixture
def mock_guest_user():
    """Mock user with guest role"""
    user = MagicMock(spec=User)
    user.id = 4
    user.email = "guest@example.com"
    user.first_name = "Guest"
    user.last_name = "User"

    guest_role = MagicMock(spec=Role)
    guest_role.name = "guest"
    guest_role.id = 4

    user.roles = [guest_role]
    return user


class TestPermissionEnum:
    """Test Permission enumeration"""

    def test_permission_enum_values(self):
        """Test all permission enum values are correctly defined"""
        assert Permission.CREATE_EMPLOYEE.value == "create:employee"
        assert Permission.READ_EMPLOYEE.value == "read:employee"
        assert Permission.UPDATE_EMPLOYEE.value == "update:employee"
        assert Permission.DELETE_EMPLOYEE.value == "delete:employee"
        assert Permission.MANAGE_ROLES.value == "manage:roles"
        assert Permission.MANAGE_DEPARTMENTS.value == "manage:departments"
        assert Permission.VIEW_AUDIT_LOGS.value == "view:audit_logs"

    def test_permission_enum_membership(self):
        """Test permission enum membership checks"""
        assert Permission.CREATE_EMPLOYEE in Permission
        assert Permission.READ_SCHEDULE in Permission
        assert Permission.MANAGE_SYSTEM in Permission

    def test_permission_enum_count(self):
        """Test total number of defined permissions"""
        all_permissions = list(Permission)
        assert len(all_permissions) > 20  # Should have at least 20 permissions


class TestRolePermissionMapping:
    """Test ROLE_PERMISSIONS mapping dictionary"""

    def test_admin_has_all_permissions(self):
        """Test admin role has all permissions"""
        admin_perms = ROLE_PERMISSIONS["admin"]

        # Admin should have delete permission (highest privilege)
        assert Permission.DELETE_EMPLOYEE in admin_perms
        assert Permission.DELETE_DEPARTMENT in admin_perms
        assert Permission.MANAGE_SYSTEM in admin_perms
        assert Permission.VIEW_AUDIT_LOGS in admin_perms

        # Should have most permissions (at least 20)
        assert len(admin_perms) >= 20

    def test_manager_permissions(self):
        """Test manager role has correct permissions"""
        manager_perms = ROLE_PERMISSIONS["manager"]

        # Manager should be able to manage employees and schedules
        assert Permission.CREATE_EMPLOYEE in manager_perms
        assert Permission.READ_EMPLOYEE in manager_perms
        assert Permission.UPDATE_EMPLOYEE in manager_perms
        assert Permission.CREATE_SCHEDULE in manager_perms
        assert Permission.UPDATE_SCHEDULE in manager_perms

        # Manager should NOT be able to delete employees or view audit logs
        assert Permission.DELETE_EMPLOYEE not in manager_perms
        assert Permission.VIEW_AUDIT_LOGS not in manager_perms
        assert Permission.MANAGE_SYSTEM not in manager_perms

    def test_employee_permissions(self):
        """Test employee role has minimal permissions"""
        employee_perms = ROLE_PERMISSIONS["employee"]

        # Employee should only have read permissions
        assert Permission.READ_EMPLOYEE in employee_perms
        assert Permission.READ_DEPARTMENT in employee_perms
        assert Permission.READ_SCHEDULE in employee_perms

        # Employee should NOT have write permissions
        assert Permission.CREATE_EMPLOYEE not in employee_perms
        assert Permission.UPDATE_EMPLOYEE not in employee_perms
        assert Permission.DELETE_EMPLOYEE not in employee_perms
        assert Permission.CREATE_SCHEDULE not in employee_perms

    def test_guest_permissions(self):
        """Test guest role has very limited permissions"""
        guest_perms = ROLE_PERMISSIONS["guest"]

        # Guest should only read public schedules
        assert Permission.READ_SCHEDULE in guest_perms

        # Guest should NOT have employee or department access
        assert Permission.READ_EMPLOYEE not in guest_perms
        assert Permission.CREATE_EMPLOYEE not in guest_perms
        assert Permission.READ_DEPARTMENT not in guest_perms

    def test_all_roles_defined(self):
        """Test all expected roles are defined in mapping"""
        expected_roles = ["admin", "manager", "employee", "guest", "user"]
        for role in expected_roles:
            assert role in ROLE_PERMISSIONS


class TestGetUserRoles:
    """Test get_user_roles function"""

    @pytest.mark.asyncio
    async def test_get_user_roles_admin(self, mock_db_session, mock_admin_user):
        """Test retrieving roles for admin user"""
        # Setup mock query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_admin_user
        mock_db_session.execute.return_value = mock_result

        # Execute
        roles = await get_user_roles(mock_db_session, user_id=1)

        # Assert
        assert roles == ["admin"]
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_roles_manager(self, mock_db_session, mock_manager_user):
        """Test retrieving roles for manager user"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_manager_user
        mock_db_session.execute.return_value = mock_result

        roles = await get_user_roles(mock_db_session, user_id=2)

        assert roles == ["manager"]

    @pytest.mark.asyncio
    async def test_get_user_roles_employee(self, mock_db_session, mock_employee_user):
        """Test retrieving roles for employee user"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_employee_user
        mock_db_session.execute.return_value = mock_result

        roles = await get_user_roles(mock_db_session, user_id=3)

        assert roles == ["employee"]

    @pytest.mark.asyncio
    async def test_get_user_roles_nonexistent_user(self, mock_db_session):
        """Test retrieving roles for non-existent user returns empty list"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        roles = await get_user_roles(mock_db_session, user_id=999)

        assert roles == []

    @pytest.mark.asyncio
    async def test_get_user_roles_multiple_roles(self, mock_db_session):
        """Test user with multiple roles"""
        user = MagicMock(spec=User)
        user.id = 5

        role1 = MagicMock(spec=Role)
        role1.name = "manager"
        role2 = MagicMock(spec=Role)
        role2.name = "employee"

        user.roles = [role1, role2]

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_db_session.execute.return_value = mock_result

        roles = await get_user_roles(mock_db_session, user_id=5)

        assert set(roles) == {"manager", "employee"}

    @pytest.mark.asyncio
    async def test_get_user_roles_database_error(self, mock_db_session):
        """Test error handling when database query fails"""
        mock_db_session.execute.side_effect = Exception("Database connection error")

        roles = await get_user_roles(mock_db_session, user_id=1)

        # Should return empty list on error
        assert roles == []


class TestGetUserPermissions:
    """Test get_user_permissions function"""

    @pytest.mark.asyncio
    async def test_get_permissions_admin(self, mock_db_session, mock_admin_user):
        """Test admin user gets all permissions"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["admin"]):
            perms = await get_user_permissions(mock_db_session, user_id=1)

            # Admin should have delete permissions
            assert Permission.DELETE_EMPLOYEE in perms
            assert Permission.DELETE_DEPARTMENT in perms
            assert Permission.MANAGE_SYSTEM in perms
            assert len(perms) >= 20

    @pytest.mark.asyncio
    async def test_get_permissions_manager(self, mock_db_session, mock_manager_user):
        """Test manager user gets manager permissions"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["manager"]):
            perms = await get_user_permissions(mock_db_session, user_id=2)

            # Manager should have create/update but not delete
            assert Permission.CREATE_EMPLOYEE in perms
            assert Permission.UPDATE_EMPLOYEE in perms
            assert Permission.DELETE_EMPLOYEE not in perms
            assert Permission.MANAGE_SYSTEM not in perms

    @pytest.mark.asyncio
    async def test_get_permissions_employee(self, mock_db_session, mock_employee_user):
        """Test employee user gets read-only permissions"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["employee"]):
            perms = await get_user_permissions(mock_db_session, user_id=3)

            # Employee should only have read permissions
            assert Permission.READ_EMPLOYEE in perms
            assert Permission.READ_SCHEDULE in perms
            assert Permission.CREATE_EMPLOYEE not in perms
            assert Permission.UPDATE_EMPLOYEE not in perms

    @pytest.mark.asyncio
    async def test_get_permissions_no_roles(self, mock_db_session):
        """Test user with no roles gets empty permissions"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=[]):
            perms = await get_user_permissions(mock_db_session, user_id=999)

            assert perms == set()

    @pytest.mark.asyncio
    async def test_get_permissions_multiple_roles(self, mock_db_session):
        """Test user with multiple roles gets combined permissions"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["manager", "employee"]):
            perms = await get_user_permissions(mock_db_session, user_id=5)

            # Should have union of both role permissions
            assert Permission.CREATE_EMPLOYEE in perms  # from manager
            assert Permission.READ_EMPLOYEE in perms  # from both


class TestCheckUserRole:
    """Test check_user_role function"""

    @pytest.mark.asyncio
    async def test_check_role_admin_allowed(self, mock_db_session):
        """Test admin user has admin role"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["admin"]):
            has_role = await check_user_role(mock_db_session, user_id=1, allowed_roles=["admin"])
            assert has_role is True

    @pytest.mark.asyncio
    async def test_check_role_manager_allowed(self, mock_db_session):
        """Test manager user has manager role"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["manager"]):
            has_role = await check_user_role(mock_db_session, user_id=2, allowed_roles=["manager", "admin"])
            assert has_role is True

    @pytest.mark.asyncio
    async def test_check_role_employee_denied(self, mock_db_session):
        """Test employee user denied for admin-only access"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["employee"]):
            has_role = await check_user_role(mock_db_session, user_id=3, allowed_roles=["admin"])
            assert has_role is False

    @pytest.mark.asyncio
    async def test_check_role_multiple_allowed(self, mock_db_session):
        """Test user with one of multiple allowed roles"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=["manager"]):
            has_role = await check_user_role(mock_db_session, user_id=2, allowed_roles=["admin", "manager"])
            assert has_role is True

    @pytest.mark.asyncio
    async def test_check_role_no_roles(self, mock_db_session):
        """Test user with no roles is denied"""
        with patch('src.auth.rbac_permissions.get_user_roles', return_value=[]):
            has_role = await check_user_role(mock_db_session, user_id=999, allowed_roles=["admin"])
            assert has_role is False


class TestCheckUserPermission:
    """Test check_user_permission function"""

    @pytest.mark.asyncio
    async def test_check_permission_admin_has_delete(self, mock_db_session):
        """Test admin has delete permission"""
        admin_perms = ROLE_PERMISSIONS["admin"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=admin_perms):
            has_perm = await check_user_permission(mock_db_session, user_id=1, permission=Permission.DELETE_EMPLOYEE)
            assert has_perm is True

    @pytest.mark.asyncio
    async def test_check_permission_manager_has_create(self, mock_db_session):
        """Test manager has create permission"""
        manager_perms = ROLE_PERMISSIONS["manager"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=manager_perms):
            has_perm = await check_user_permission(mock_db_session, user_id=2, permission=Permission.CREATE_EMPLOYEE)
            assert has_perm is True

    @pytest.mark.asyncio
    async def test_check_permission_manager_no_delete(self, mock_db_session):
        """Test manager does NOT have delete permission"""
        manager_perms = ROLE_PERMISSIONS["manager"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=manager_perms):
            has_perm = await check_user_permission(mock_db_session, user_id=2, permission=Permission.DELETE_EMPLOYEE)
            assert has_perm is False

    @pytest.mark.asyncio
    async def test_check_permission_employee_has_read(self, mock_db_session):
        """Test employee has read permission"""
        employee_perms = ROLE_PERMISSIONS["employee"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=employee_perms):
            has_perm = await check_user_permission(mock_db_session, user_id=3, permission=Permission.READ_EMPLOYEE)
            assert has_perm is True

    @pytest.mark.asyncio
    async def test_check_permission_employee_no_create(self, mock_db_session):
        """Test employee does NOT have create permission"""
        employee_perms = ROLE_PERMISSIONS["employee"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=employee_perms):
            has_perm = await check_user_permission(mock_db_session, user_id=3, permission=Permission.CREATE_EMPLOYEE)
            assert has_perm is False


class TestDependencyFactories:
    """Test FastAPI dependency factory functions"""

    @pytest.mark.asyncio
    async def test_require_role_creates_dependency(self):
        """Test require_role creates a callable dependency"""
        dependency = require_role(["admin", "manager"])
        assert callable(dependency)

    @pytest.mark.asyncio
    async def test_require_permission_creates_dependency(self):
        """Test require_permission creates a callable dependency"""
        dependency = require_permission(Permission.CREATE_EMPLOYEE)
        assert callable(dependency)

    @pytest.mark.asyncio
    async def test_require_any_permission_creates_dependency(self):
        """Test require_any_permission creates a callable dependency"""
        dependency = require_any_permission([Permission.READ_EMPLOYEE, Permission.MANAGE_USERS])
        assert callable(dependency)

    @pytest.mark.asyncio
    async def test_require_all_permissions_creates_dependency(self):
        """Test require_all_permissions creates a callable dependency"""
        dependency = require_all_permissions([Permission.MANAGE_SYSTEM, Permission.DELETE_EMPLOYEE])
        assert callable(dependency)


class TestSecurityScenarios:
    """Test real-world security scenarios"""

    @pytest.mark.asyncio
    async def test_employee_cannot_delete_employees(self, mock_db_session):
        """CRITICAL: Test employee cannot delete other employees"""
        employee_perms = ROLE_PERMISSIONS["employee"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=employee_perms):
            has_perm = await check_user_permission(
                mock_db_session,
                user_id=3,
                permission=Permission.DELETE_EMPLOYEE
            )
            assert has_perm is False

    @pytest.mark.asyncio
    async def test_employee_cannot_create_employees(self, mock_db_session):
        """CRITICAL: Test employee cannot create employees"""
        employee_perms = ROLE_PERMISSIONS["employee"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=employee_perms):
            has_perm = await check_user_permission(
                mock_db_session,
                user_id=3,
                permission=Permission.CREATE_EMPLOYEE
            )
            assert has_perm is False

    @pytest.mark.asyncio
    async def test_employee_cannot_update_employees(self, mock_db_session):
        """CRITICAL: Test employee cannot update employees"""
        employee_perms = ROLE_PERMISSIONS["employee"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=employee_perms):
            has_perm = await check_user_permission(
                mock_db_session,
                user_id=3,
                permission=Permission.UPDATE_EMPLOYEE
            )
            assert has_perm is False

    @pytest.mark.asyncio
    async def test_manager_can_create_employees(self, mock_db_session):
        """Test manager CAN create employees"""
        manager_perms = ROLE_PERMISSIONS["manager"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=manager_perms):
            has_perm = await check_user_permission(
                mock_db_session,
                user_id=2,
                permission=Permission.CREATE_EMPLOYEE
            )
            assert has_perm is True

    @pytest.mark.asyncio
    async def test_manager_cannot_delete_employees(self, mock_db_session):
        """Test manager CANNOT delete employees (admin only)"""
        manager_perms = ROLE_PERMISSIONS["manager"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=manager_perms):
            has_perm = await check_user_permission(
                mock_db_session,
                user_id=2,
                permission=Permission.DELETE_EMPLOYEE
            )
            assert has_perm is False

    @pytest.mark.asyncio
    async def test_admin_has_full_employee_access(self, mock_db_session):
        """Test admin has full CRUD access to employees"""
        admin_perms = ROLE_PERMISSIONS["admin"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=admin_perms):
            # Admin can CREATE
            assert await check_user_permission(mock_db_session, 1, Permission.CREATE_EMPLOYEE)
            # Admin can READ
            assert await check_user_permission(mock_db_session, 1, Permission.READ_EMPLOYEE)
            # Admin can UPDATE
            assert await check_user_permission(mock_db_session, 1, Permission.UPDATE_EMPLOYEE)
            # Admin can DELETE
            assert await check_user_permission(mock_db_session, 1, Permission.DELETE_EMPLOYEE)

    @pytest.mark.asyncio
    async def test_guest_has_no_employee_access(self, mock_db_session):
        """Test guest has no employee access"""
        guest_perms = ROLE_PERMISSIONS["guest"]
        with patch('src.auth.rbac_permissions.get_user_permissions', return_value=guest_perms):
            # Guest CANNOT read employees
            assert not await check_user_permission(mock_db_session, 4, Permission.READ_EMPLOYEE)
            # Guest CANNOT create employees
            assert not await check_user_permission(mock_db_session, 4, Permission.CREATE_EMPLOYEE)
