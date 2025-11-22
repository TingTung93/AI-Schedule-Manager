"""
Seed script to populate initial data for AI Schedule Manager

This script creates:
- Initial roles (admin, manager, supervisor, employee)
- Initial permissions
- Demo admin user
- Sample departments
- Sample employees
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from datetime import datetime
import bcrypt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.models import Base, Department, Employee
from src.models.employee import Employee as EmployeeModel

# Database URL - use environment variable or default
import os
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@postgres:5432/schedule_manager")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    # Convert password to bytes and hash
    password_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')


async def seed_roles_and_permissions(session: AsyncSession):
    """Create initial roles and permissions"""
    print("Creating roles...")

    # Note: The roles and permissions tables are created by migration 003
    # We'll insert data using text SQL for async compatibility

    roles_data = [
        ("admin", "System Administrator with full access"),
        ("manager", "Department Manager with scheduling authority"),
        ("supervisor", "Team Supervisor with limited scheduling"),
        ("employee", "Regular Employee"),
    ]

    for role_name, description in roles_data:
        # Check if role exists
        result = await session.execute(
            text("SELECT id FROM roles WHERE name = :name"),
            {"name": role_name}
        )
        if not result.scalar():
            await session.execute(
                text("INSERT INTO roles (name, description, created_at, updated_at) "
                     "VALUES (:name, :description, NOW(), NOW())"),
                {"name": role_name, "description": description}
            )
            print(f"  ✓ Created role: {role_name}")

    await session.commit()
    print("Roles created successfully!")


async def seed_permissions(session: AsyncSession):
    """Create initial permissions"""
    print("\nCreating permissions...")

    permissions_data = [
        # User management
        ("user:create", "Create users"),
        ("user:read", "View users"),
        ("user:update", "Update users"),
        ("user:delete", "Delete users"),

        # Schedule management
        ("schedule:create", "Create schedules"),
        ("schedule:read", "View schedules"),
        ("schedule:update", "Update schedules"),
        ("schedule:delete", "Delete schedules"),
        ("schedule:publish", "Publish schedules"),

        # Department management
        ("department:create", "Create departments"),
        ("department:read", "View departments"),
        ("department:update", "Update departments"),
        ("department:delete", "Delete departments"),

        # Shift management
        ("shift:create", "Create shifts"),
        ("shift:read", "View shifts"),
        ("shift:update", "Update shifts"),
        ("shift:delete", "Delete shifts"),

        # Reports
        ("report:view", "View reports"),
        ("report:export", "Export reports"),
    ]

    for permission_name, description in permissions_data:
        # Check if permission exists
        result = await session.execute(
            text("SELECT id FROM permissions WHERE name = :name"),
            {"name": permission_name}
        )
        if not result.scalar():
            await session.execute(
                text("INSERT INTO permissions (name, description, resource, action, created_at) "
                     "VALUES (:name, :description, :resource, :action, NOW())"),
                {
                    "name": permission_name,
                    "description": description,
                    "resource": permission_name.split(':')[0],
                    "action": permission_name.split(':')[1]
                }
            )
            print(f"  ✓ Created permission: {permission_name}")

    await session.commit()
    print("Permissions created successfully!")


async def seed_role_permissions(session: AsyncSession):
    """Assign permissions to roles"""
    print("\nAssigning permissions to roles...")

    # Get role IDs
    admin_role = await session.execute(text("SELECT id FROM roles WHERE name = 'admin'"))
    manager_role = await session.execute(text("SELECT id FROM roles WHERE name = 'manager'"))
    supervisor_role = await session.execute(text("SELECT id FROM roles WHERE name = 'supervisor'"))
    employee_role = await session.execute(text("SELECT id FROM roles WHERE name = 'employee'"))

    admin_role_id = admin_role.scalar()
    manager_role_id = manager_role.scalar()
    supervisor_role_id = supervisor_role.scalar()
    employee_role_id = employee_role.scalar()

    # Get all permission IDs
    all_permissions = await session.execute(text("SELECT id, name FROM permissions"))
    permissions = {row[1]: row[0] for row in all_permissions}

    # Admin gets all permissions
    for perm_id in permissions.values():
        await session.execute(
            text("INSERT INTO role_permissions (role_id, permission_id) "
                 "VALUES (:role_id, :permission_id) "
                 "ON CONFLICT DO NOTHING"),
            {"role_id": admin_role_id, "permission_id": perm_id}
        )
    print("  ✓ Assigned all permissions to admin role")

    # Manager permissions
    manager_perms = [
        "user:read", "user:update",
        "schedule:create", "schedule:read", "schedule:update", "schedule:publish",
        "department:read",
        "shift:create", "shift:read", "shift:update", "shift:delete",
        "report:view", "report:export"
    ]
    for perm_name in manager_perms:
        if perm_name in permissions:
            await session.execute(
                text("INSERT INTO role_permissions (role_id, permission_id) "
                     "VALUES (:role_id, :permission_id) "
                     "ON CONFLICT DO NOTHING"),
                {"role_id": manager_role_id, "permission_id": permissions[perm_name]}
            )
    print("  ✓ Assigned permissions to manager role")

    # Supervisor permissions
    supervisor_perms = [
        "user:read",
        "schedule:read", "schedule:update",
        "department:read",
        "shift:read", "shift:update",
        "report:view"
    ]
    for perm_name in supervisor_perms:
        if perm_name in permissions:
            await session.execute(
                text("INSERT INTO role_permissions (role_id, permission_id) "
                     "VALUES (:role_id, :permission_id) "
                     "ON CONFLICT DO NOTHING"),
                {"role_id": supervisor_role_id, "permission_id": permissions[perm_name]}
            )
    print("  ✓ Assigned permissions to supervisor role")

    # Employee permissions
    employee_perms = ["schedule:read", "shift:read", "user:read"]
    for perm_name in employee_perms:
        if perm_name in permissions:
            await session.execute(
                text("INSERT INTO role_permissions (role_id, permission_id) "
                     "VALUES (:role_id, :permission_id) "
                     "ON CONFLICT DO NOTHING"),
                {"role_id": employee_role_id, "permission_id": permissions[perm_name]}
            )
    print("  ✓ Assigned permissions to employee role")

    await session.commit()
    print("Role permissions assigned successfully!")


async def seed_departments(session: AsyncSession):
    """Create sample departments"""
    print("\nCreating departments...")

    departments_data = [
        {
            "name": "Administration",
            "description": "Administrative and management staff",
            "settings": {"default_shift_hours": 8, "min_staff": 2}
        },
        {
            "name": "Sales",
            "description": "Sales and customer service team",
            "settings": {"default_shift_hours": 8, "min_staff": 3}
        },
        {
            "name": "Operations",
            "description": "Operations and logistics",
            "settings": {"default_shift_hours": 8, "min_staff": 4}
        },
        {
            "name": "Support",
            "description": "Technical support and IT",
            "settings": {"default_shift_hours": 8, "min_staff": 2}
        },
    ]

    for dept_data in departments_data:
        # Check if department exists
        result = await session.execute(
            select(Department).where(Department.name == dept_data["name"])
        )
        if not result.scalar():
            department = Department(**dept_data)
            session.add(department)
            print(f"  ✓ Created department: {dept_data['name']}")

    await session.commit()
    print("Departments created successfully!")


async def seed_users_and_employees(session: AsyncSession):
    """Create demo users and employees"""
    print("\nCreating users and employees...")

    # Get department IDs
    admin_dept = await session.execute(
        select(Department).where(Department.name == "Administration")
    )
    sales_dept = await session.execute(
        select(Department).where(Department.name == "Sales")
    )
    ops_dept = await session.execute(
        select(Department).where(Department.name == "Operations")
    )
    support_dept = await session.execute(
        select(Department).where(Department.name == "Support")
    )

    admin_dept_obj = admin_dept.scalar()
    sales_dept_obj = sales_dept.scalar()
    ops_dept_obj = ops_dept.scalar()
    support_dept_obj = support_dept.scalar()

    admin_dept_id = admin_dept_obj.id if admin_dept_obj else None
    sales_dept_id = sales_dept_obj.id if sales_dept_obj else None
    ops_dept_id = ops_dept_obj.id if ops_dept_obj else None
    support_dept_id = support_dept_obj.id if support_dept_obj else None

    # Get role IDs
    admin_role = await session.execute(text("SELECT id FROM roles WHERE name = 'admin'"))
    manager_role = await session.execute(text("SELECT id FROM roles WHERE name = 'manager'"))
    supervisor_role = await session.execute(text("SELECT id FROM roles WHERE name = 'supervisor'"))
    employee_role = await session.execute(text("SELECT id FROM roles WHERE name = 'employee'"))

    admin_role_id = admin_role.scalar()
    manager_role_id = manager_role.scalar()
    supervisor_role_id = supervisor_role.scalar()
    employee_role_id = employee_role.scalar()

    users_data = [
        {
            "email": "admin@example.com",
            "password": "Admin123!",
            "first_name": "Admin",
            "last_name": "User",
            "role": "admin",
            "department_id": admin_dept_id,
            "is_admin": True,
            "role_id": admin_role_id,
        },
        {
            "email": "manager@example.com",
            "password": "Manager123!",
            "first_name": "Sarah",
            "last_name": "Johnson",
            "role": "manager",
            "department_id": sales_dept_id,
            "is_admin": False,
            "role_id": manager_role_id,
        },
        {
            "email": "supervisor@example.com",
            "password": "Supervisor123!",
            "first_name": "Mike",
            "last_name": "Williams",
            "role": "supervisor",
            "department_id": ops_dept_id,
            "is_admin": False,
            "role_id": supervisor_role_id,
        },
        {
            "email": "employee1@example.com",
            "password": "Employee123!",
            "first_name": "John",
            "last_name": "Smith",
            "role": "employee",
            "department_id": sales_dept_id,
            "is_admin": False,
            "role_id": employee_role_id,
        },
        {
            "email": "employee2@example.com",
            "password": "Employee123!",
            "first_name": "Emily",
            "last_name": "Davis",
            "role": "employee",
            "department_id": sales_dept_id,
            "is_admin": False,
            "role_id": employee_role_id,
        },
        {
            "email": "employee3@example.com",
            "password": "Employee123!",
            "first_name": "David",
            "last_name": "Brown",
            "role": "employee",
            "department_id": ops_dept_id,
            "is_admin": False,
            "role_id": employee_role_id,
        },
    ]

    for user_data in users_data:
        # Check if user exists in users table
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": user_data["email"]}
        )
        user_id = result.scalar()

        if not user_id:
            # Create user
            hashed_password = hash_password(user_data["password"])
            result = await session.execute(
                text("INSERT INTO users (email, password_hash, first_name, last_name, department_id, is_active, created_at, updated_at) "
                     "VALUES (:email, :password_hash, :first_name, :last_name, :department_id, TRUE, NOW(), NOW()) "
                     "RETURNING id"),
                {
                    "email": user_data["email"],
                    "password_hash": hashed_password,
                    "first_name": user_data["first_name"],
                    "last_name": user_data["last_name"],
                    "department_id": user_data["department_id"],
                }
            )
            user_id = result.scalar()

            # Assign role to user
            await session.execute(
                text("INSERT INTO user_roles (user_id, role_id) "
                     "VALUES (:user_id, :role_id)"),
                {"user_id": user_id, "role_id": user_data["role_id"]}
            )

            print(f"  ✓ Created user: {user_data['email']} ({user_data['role']})")

        # Note: Employees table was removed in favor of users table
        # Skipping employee creation as users table now handles all user data
        print(f"  → User {user_data['first_name']} {user_data['last_name']} created (employees table deprecated)")

    await session.commit()
    print("Users and employees created successfully!")


async def main():
    """Main seed function"""
    print("=" * 60)
    print("AI Schedule Manager - Database Seeding")
    print("=" * 60)

    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)

    # Create async session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        try:
            # Seed data in order
            await seed_roles_and_permissions(session)
            await seed_permissions(session)
            await seed_role_permissions(session)
            await seed_departments(session)
            await seed_users_and_employees(session)

            print("\n" + "=" * 60)
            print("✅ Database seeding completed successfully!")
            print("=" * 60)
            print("\nDemo Credentials:")
            print("-" * 60)
            print("Admin User:")
            print("  Email: admin@example.com")
            print("  Password: Admin123!")
            print()
            print("Manager User:")
            print("  Email: manager@example.com")
            print("  Password: Manager123!")
            print()
            print("Supervisor User:")
            print("  Email: supervisor@example.com")
            print("  Password: Supervisor123!")
            print()
            print("Employee User:")
            print("  Email: employee1@example.com")
            print("  Password: Employee123!")
            print("=" * 60)

        except Exception as e:
            print(f"\n❌ Error during seeding: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
