#!/usr/bin/env python3
"""
Seed Test Data Script
Creates sample users and employees for migration testing
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta
import random

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models import Base, User, Employee
from src.utils.security import get_password_hash
import os


async def seed_test_data():
    """Seed database with test data"""

    # Get database URL from environment
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost/test_employee_system"
    )

    print(f"🔌 Connecting to database: {database_url}")

    # Create engine and session
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Sample departments
        departments = ["Engineering", "Sales", "Marketing", "HR", "Finance"]

        # Sample positions
        positions = {
            "Engineering": ["Software Engineer", "Senior Engineer", "Tech Lead", "Engineering Manager"],
            "Sales": ["Sales Representative", "Account Executive", "Sales Manager"],
            "Marketing": ["Marketing Specialist", "Marketing Manager", "Content Creator"],
            "HR": ["HR Specialist", "HR Manager", "Recruiter"],
            "Finance": ["Accountant", "Financial Analyst", "Finance Manager"]
        }

        # 1. Create users
        print("\n👤 Creating users...")
        users = []

        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        users.append(admin_user)

        # Create 9 employee users
        first_names = ["John", "Jane", "Michael", "Emily", "David", "Sarah", "Robert", "Lisa", "James"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez"]

        for i in range(9):
            user = User(
                username=f"user{i+1}",
                email=f"user{i+1}@example.com",
                hashed_password=get_password_hash("password123"),
                role="employee",
                is_active=True
            )
            db.add(user)
            users.append(user)

        db.flush()  # Flush to get user IDs
        print(f"✅ Created {len(users)} users")

        # 2. Create employees
        print("\n👷 Creating employees...")
        employees = []

        hire_date_start = datetime.now() - timedelta(days=365*5)  # 5 years ago

        for i, user in enumerate(users):
            # Skip admin user for employee creation
            if user.role == "admin":
                continue

            department = random.choice(departments)
            position = random.choice(positions[department])

            # Random hire date within last 5 years
            days_offset = random.randint(0, 365*5)
            hire_date = hire_date_start + timedelta(days=days_offset)

            employee = Employee(
                user_id=user.id,
                first_name=first_names[i-1],  # -1 because we skip admin
                last_name=last_names[i-1],
                department=department,
                position=position,
                hire_date=hire_date.date(),
                extended_fields={
                    "phone": f"+1-555-{random.randint(1000, 9999)}",
                    "emergency_contact": f"+1-555-{random.randint(1000, 9999)}",
                    "employee_id": f"EMP{1000 + i}",
                    "office_location": random.choice(["Building A", "Building B", "Remote"])
                }
            )
            db.add(employee)
            employees.append(employee)

        db.flush()  # Flush to get employee IDs
        print(f"✅ Created {len(employees)} employees")

        # 3. Create department assignment history
        print("\n📋 Creating department assignment history...")

        from src.models import DepartmentAssignmentHistory

        # Randomly assign some employees to have department changes
        changed_employees = random.sample(employees, min(5, len(employees)))

        for employee in changed_employees:
            old_dept = random.choice([d for d in departments if d != employee.department])

            assignment = DepartmentAssignmentHistory(
                employee_id=employee.id,
                old_department=old_dept,
                new_department=employee.department,
                changed_by=admin_user.id,
                changed_at=datetime.utcnow() - timedelta(days=random.randint(30, 365)),
                reason=f"Promotion from {old_dept} to {employee.department}"
            )
            db.add(assignment)

        print(f"✅ Created {len(changed_employees)} department assignment records")

        # Commit all changes
        db.commit()

        print("\n" + "="*60)
        print("🎉 Test data seeding completed successfully!")
        print("="*60)
        print(f"📊 Summary:")
        print(f"  - Users created: {len(users)}")
        print(f"  - Employees created: {len(employees)}")
        print(f"  - Department assignments: {len(changed_employees)}")
        print(f"  - Departments used: {', '.join(departments)}")
        print("="*60)

    except Exception as e:
        print(f"\n❌ Error seeding test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(seed_test_data())
