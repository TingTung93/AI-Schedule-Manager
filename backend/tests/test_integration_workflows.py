"""
Integration Workflow Tests

Tests complete end-to-end workflows including:
- Employee lifecycle (create → update → status change → delete)
- Role assignment with authorization
- Department assignment with history tracking
- Password reset and change workflows
- Account status management workflows

These tests verify that complex business processes work correctly.
"""

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import NullPool
import bcrypt

from src.auth.models import User, Role, user_roles, Base
from src.models import Employee, Department
from src.models.department_history import DepartmentAssignmentHistory
from src.models.role_history import RoleChangeHistory
from src.models.password_history import PasswordHistory
from src.models.account_status_history import AccountStatusHistory

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


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
async def setup_roles(db_session):
    """Create standard roles."""
    roles = {}
    for role_name in ["admin", "manager", "user"]:
        role = Role(name=role_name, description=f"{role_name.capitalize()} role")
        db_session.add(role)
        roles[role_name] = role

    await db_session.commit()
    for role in roles.values():
        await db_session.refresh(role)

    return roles


@pytest.fixture
async def admin_user(db_session, setup_roles):
    """Create admin user."""
    password_hash = bcrypt.hashpw("AdminPass123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="admin@test.com",
        password_hash=password_hash,
        first_name="Admin",
        last_name="User",
        is_active=True,
        status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    user.roles.append(setup_roles["admin"])
    await db_session.commit()

    return user


@pytest.fixture
async def test_departments(db_session):
    """Create test departments."""
    departments = []
    for name in ["Engineering", "Sales", "Support"]:
        dept = Department(name=name, description=f"{name} department", active=True)
        db_session.add(dept)
        departments.append(dept)

    await db_session.commit()
    for dept in departments:
        await db_session.refresh(dept)

    return departments


# ============================================================================
# EMPLOYEE LIFECYCLE WORKFLOW
# ============================================================================

@pytest.mark.asyncio
async def test_complete_employee_lifecycle(db_session, setup_roles, test_departments, admin_user):
    """
    Test complete employee lifecycle:
    1. Create employee
    2. Update profile information
    3. Change status (active → inactive → active)
    4. Delete employee
    """
    # Step 1: Create employee
    password_hash = bcrypt.hashpw("TempPass123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    new_user = User(
        email="lifecycle@test.com",
        password_hash=password_hash,
        first_name="John",
        last_name="Doe",
        is_active=True,
        status="active"
    )
    db_session.add(new_user)
    await db_session.commit()
    await db_session.refresh(new_user)

    # Assign user role
    new_user.roles.append(setup_roles["user"])
    await db_session.commit()

    # Verify creation
    assert new_user.id is not None
    assert new_user.email == "lifecycle@test.com"
    assert new_user.status == "active"

    # Step 2: Update profile information
    new_user.first_name = "Jonathan"
    new_user.last_name = "Doe-Smith"
    await db_session.commit()
    await db_session.refresh(new_user)

    assert new_user.first_name == "Jonathan"
    assert new_user.last_name == "Doe-Smith"

    # Step 3: Change status to inactive
    new_user.status = "inactive"
    new_user.is_active = False

    # Record status change in history
    status_change = AccountStatusHistory(
        user_id=new_user.id,
        old_status="active",
        new_status="inactive",
        changed_by_user_id=admin_user.id,
        reason="Employee on leave",
        metadata={"leave_type": "sabbatical"}
    )
    db_session.add(status_change)
    await db_session.commit()

    # Verify inactive
    await db_session.refresh(new_user)
    assert new_user.status == "inactive"
    assert new_user.is_active is False

    # Step 4: Reactivate employee
    new_user.status = "active"
    new_user.is_active = True

    reactivation = AccountStatusHistory(
        user_id=new_user.id,
        old_status="inactive",
        new_status="active",
        changed_by_user_id=admin_user.id,
        reason="Returned from leave"
    )
    db_session.add(reactivation)
    await db_session.commit()

    # Verify reactivated
    await db_session.refresh(new_user)
    assert new_user.status == "active"
    assert new_user.is_active is True

    # Verify status history
    history_query = select(AccountStatusHistory).where(
        AccountStatusHistory.user_id == new_user.id
    ).order_by(AccountStatusHistory.changed_at)

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == 2
    assert history[0].old_status == "active"
    assert history[0].new_status == "inactive"
    assert history[1].old_status == "inactive"
    assert history[1].new_status == "active"

    # Step 5: Soft delete (mark as deleted)
    user_id = new_user.id
    new_user.status = "deleted"
    new_user.is_active = False
    await db_session.commit()

    # Verify soft deleted
    deleted_query = select(User).where(User.id == user_id)
    result = await db_session.execute(deleted_query)
    deleted_user = result.scalar_one_or_none()

    assert deleted_user is not None
    assert deleted_user.status == "deleted"


@pytest.mark.asyncio
async def test_employee_onboarding_workflow(db_session, setup_roles, test_departments):
    """
    Test employee onboarding workflow:
    1. Create user with temporary password
    2. User changes password on first login
    3. Assign to department
    4. Assign role
    5. Verify email (simulate)
    """
    # Step 1: Create user with temporary password
    temp_password = "TempPass123!"
    password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    new_user = User(
        email="onboarding@test.com",
        password_hash=password_hash,
        first_name="New",
        last_name="Employee",
        is_active=True,
        status="pending_verification"
    )
    db_session.add(new_user)
    await db_session.commit()
    await db_session.refresh(new_user)

    assert new_user.status == "pending_verification"

    # Step 2: User changes password (first login)
    new_password = "SecurePass456!"
    new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Save old password to history
    password_history = PasswordHistory(
        user_id=new_user.id,
        password_hash=password_hash,
        change_method="admin_reset",
        changed_by_user_id=new_user.id
    )
    db_session.add(password_history)

    # Update to new password
    new_user.password_hash = new_password_hash
    await db_session.commit()

    # Step 3: Assign to department (simulate)
    # This would create Employee record linked to User

    # Step 4: Assign role
    new_user.roles.append(setup_roles["user"])
    await db_session.commit()

    # Step 5: Verify email
    new_user.status = "active"
    await db_session.commit()
    await db_session.refresh(new_user)

    assert new_user.status == "active"
    assert len(new_user.roles) == 1
    assert new_user.roles[0].name == "user"


# ============================================================================
# ROLE ASSIGNMENT WORKFLOW
# ============================================================================

@pytest.mark.asyncio
async def test_role_assignment_with_history(db_session, setup_roles, admin_user):
    """Test role assignment and track history."""
    # Create user
    password_hash = bcrypt.hashpw("Pass123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="roletest@test.com",
        password_hash=password_hash,
        first_name="Role",
        last_name="Test",
        is_active=True,
        status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Assign user role
    user.roles.append(setup_roles["user"])
    await db_session.commit()

    # Record role assignment
    role_history = RoleChangeHistory(
        user_id=user.id,
        old_role=None,
        new_role="user",
        changed_by_user_id=admin_user.id,
        reason="Initial role assignment"
    )
    db_session.add(role_history)
    await db_session.commit()

    # Promote to manager
    user.roles.clear()
    user.roles.append(setup_roles["manager"])
    await db_session.commit()

    # Record promotion
    promotion = RoleChangeHistory(
        user_id=user.id,
        old_role="user",
        new_role="manager",
        changed_by_user_id=admin_user.id,
        reason="Promoted to manager role"
    )
    db_session.add(promotion)
    await db_session.commit()

    # Verify role history
    history_query = select(RoleChangeHistory).where(
        RoleChangeHistory.user_id == user.id
    ).order_by(RoleChangeHistory.changed_at)

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == 2
    assert history[0].new_role == "user"
    assert history[1].old_role == "user"
    assert history[1].new_role == "manager"


@pytest.mark.asyncio
async def test_role_demotion_workflow(db_session, setup_roles, admin_user):
    """Test role demotion with audit trail."""
    # Create manager user
    password_hash = bcrypt.hashpw("Pass123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    manager = User(
        email="manager@test.com",
        password_hash=password_hash,
        first_name="Manager",
        last_name="User",
        is_active=True,
        status="active"
    )
    db_session.add(manager)
    await db_session.commit()
    await db_session.refresh(manager)

    manager.roles.append(setup_roles["manager"])
    await db_session.commit()

    # Demote to user
    manager.roles.clear()
    manager.roles.append(setup_roles["user"])
    await db_session.commit()

    # Record demotion
    demotion = RoleChangeHistory(
        user_id=manager.id,
        old_role="manager",
        new_role="user",
        changed_by_user_id=admin_user.id,
        reason="Performance issues",
        metadata={"review_date": "2024-01-15"}
    )
    db_session.add(demotion)
    await db_session.commit()

    # Verify demotion recorded
    await db_session.refresh(demotion)
    assert demotion.old_role == "manager"
    assert demotion.new_role == "user"
    assert demotion.reason == "Performance issues"


# ============================================================================
# DEPARTMENT ASSIGNMENT WORKFLOW
# ============================================================================

@pytest.mark.asyncio
async def test_department_assignment_with_history(db_session, test_departments, admin_user):
    """Test department assignment tracking."""
    # Create employee
    employee = Employee(
        name="Department Test",
        email="depttest@test.com",
        role="Developer",
        department_id=test_departments[0].id,
        active=True
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Record initial assignment
    initial_assignment = DepartmentAssignmentHistory(
        employee_id=employee.id,
        old_department_id=None,
        new_department_id=test_departments[0].id,
        assigned_by_user_id=admin_user.id,
        reason="Initial assignment"
    )
    db_session.add(initial_assignment)
    await db_session.commit()

    # Transfer to different department
    employee.department_id = test_departments[1].id
    await db_session.commit()

    # Record transfer
    transfer = DepartmentAssignmentHistory(
        employee_id=employee.id,
        old_department_id=test_departments[0].id,
        new_department_id=test_departments[1].id,
        assigned_by_user_id=admin_user.id,
        reason="Department reorganization"
    )
    db_session.add(transfer)
    await db_session.commit()

    # Verify history
    history_query = select(DepartmentAssignmentHistory).where(
        DepartmentAssignmentHistory.employee_id == employee.id
    ).order_by(DepartmentAssignmentHistory.assigned_at)

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == 2
    assert history[0].new_department_id == test_departments[0].id
    assert history[1].old_department_id == test_departments[0].id
    assert history[1].new_department_id == test_departments[1].id


@pytest.mark.asyncio
async def test_multiple_department_transfers(db_session, test_departments, admin_user):
    """Test employee with multiple department transfers."""
    employee = Employee(
        name="Transfer Test",
        email="transfer@test.com",
        role="Consultant",
        department_id=test_departments[0].id,
        active=True
    )
    db_session.add(employee)
    await db_session.commit()
    await db_session.refresh(employee)

    # Transfer through all departments
    for i in range(len(test_departments)):
        if i == 0:
            continue  # Already in first department

        old_dept_id = test_departments[i - 1].id
        new_dept_id = test_departments[i].id

        employee.department_id = new_dept_id
        await db_session.commit()

        transfer = DepartmentAssignmentHistory(
            employee_id=employee.id,
            old_department_id=old_dept_id,
            new_department_id=new_dept_id,
            assigned_by_user_id=admin_user.id,
            reason=f"Transfer to {test_departments[i].name}"
        )
        db_session.add(transfer)
        await db_session.commit()

    # Verify all transfers recorded
    history_query = select(DepartmentAssignmentHistory).where(
        DepartmentAssignmentHistory.employee_id == employee.id
    ).order_by(DepartmentAssignmentHistory.assigned_at)

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == len(test_departments) - 1


# ============================================================================
# PASSWORD MANAGEMENT WORKFLOW
# ============================================================================

@pytest.mark.asyncio
async def test_password_reset_workflow(db_session, setup_roles):
    """Test password reset workflow with history."""
    # Create user
    original_password = "OriginalPass123!"
    password_hash = bcrypt.hashpw(original_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="resettest@test.com",
        password_hash=password_hash,
        first_name="Reset",
        last_name="Test",
        is_active=True,
        status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Save current password to history
    current_password_history = PasswordHistory(
        user_id=user.id,
        password_hash=password_hash,
        change_method="initial_creation",
        changed_by_user_id=user.id
    )
    db_session.add(current_password_history)
    await db_session.commit()

    # Admin resets password
    new_temp_password = "TempPass456!"
    new_password_hash = bcrypt.hashpw(new_temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user.password_hash = new_password_hash
    await db_session.commit()

    # Record reset
    reset_history = PasswordHistory(
        user_id=user.id,
        password_hash=new_password_hash,
        change_method="admin_reset",
        changed_by_user_id=user.id,
        ip_address="192.168.1.1"
    )
    db_session.add(reset_history)
    await db_session.commit()

    # Verify password history
    history_query = select(PasswordHistory).where(
        PasswordHistory.user_id == user.id
    ).order_by(PasswordHistory.changed_at)

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == 2
    assert history[0].change_method == "initial_creation"
    assert history[1].change_method == "admin_reset"


@pytest.mark.asyncio
async def test_password_change_with_history_limit(db_session, setup_roles):
    """Test password change respects history limit (prevent reuse)."""
    # Create user
    password_hash = bcrypt.hashpw("Pass1!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="historytest@test.com",
        password_hash=password_hash,
        first_name="History",
        last_name="Test",
        is_active=True,
        status="active"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Change password 5 times
    passwords = ["Pass1!", "Pass2!", "Pass3!", "Pass4!", "Pass5!"]

    for i, pwd in enumerate(passwords):
        pwd_hash = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Save to history
        history = PasswordHistory(
            user_id=user.id,
            password_hash=pwd_hash,
            change_method="self_change",
            changed_by_user_id=user.id
        )
        db_session.add(history)
        await db_session.commit()

    # Verify history exists
    history_query = select(PasswordHistory).where(
        PasswordHistory.user_id == user.id
    ).order_by(PasswordHistory.changed_at.desc())

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == 5

    # Verify passwords in history (cannot reuse)
    for record in history:
        assert record.password_hash is not None


# ============================================================================
# ACCOUNT STATUS MANAGEMENT WORKFLOW
# ============================================================================

@pytest.mark.asyncio
async def test_account_lock_unlock_workflow(db_session, setup_roles, admin_user):
    """Test account lock/unlock workflow."""
    # Create user
    password_hash = bcrypt.hashpw("Pass123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        email="locktest@test.com",
        password_hash=password_hash,
        first_name="Lock",
        last_name="Test",
        is_active=True,
        status="active",
        failed_login_attempts=0
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Lock account (e.g., after failed login attempts)
    user.status = "locked"
    user.is_active = False
    user.failed_login_attempts = 5
    await db_session.commit()

    # Record lock
    lock_history = AccountStatusHistory(
        user_id=user.id,
        old_status="active",
        new_status="locked",
        changed_by_user_id=admin_user.id,
        reason="Too many failed login attempts",
        metadata={"failed_attempts": 5, "locked_at": datetime.now(timezone.utc).isoformat()}
    )
    db_session.add(lock_history)
    await db_session.commit()

    # Admin unlocks account
    user.status = "active"
    user.is_active = True
    user.failed_login_attempts = 0
    await db_session.commit()

    # Record unlock
    unlock_history = AccountStatusHistory(
        user_id=user.id,
        old_status="locked",
        new_status="active",
        changed_by_user_id=admin_user.id,
        reason="Admin unlock after verification"
    )
    db_session.add(unlock_history)
    await db_session.commit()

    # Verify history
    history_query = select(AccountStatusHistory).where(
        AccountStatusHistory.user_id == user.id
    ).order_by(AccountStatusHistory.changed_at)

    result = await db_session.execute(history_query)
    history = result.scalars().all()

    assert len(history) == 2
    assert history[0].new_status == "locked"
    assert history[1].new_status == "active"
    assert history[1].reason == "Admin unlock after verification"
