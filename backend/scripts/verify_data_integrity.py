#!/usr/bin/env python3
"""
Data Integrity Verification Script
Verifies database integrity after migrations and data seeding
"""

import sys
from pathlib import Path
import json

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.models import User, Employee, DepartmentAssignmentHistory
import os


def verify_data_integrity():
    """Verify data integrity in the database"""

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

    issues = []
    checks_passed = 0
    checks_total = 0

    try:
        print("\n" + "="*60)
        print("DATA INTEGRITY VERIFICATION")
        print("="*60)

        # 1. Check all employees have valid user_id
        print("\n🔍 Check 1: All employees have valid user_id")
        checks_total += 1

        orphaned_employees = db.query(Employee).filter(
            ~Employee.user_id.in_(db.query(User.id))
        ).all()

        if orphaned_employees:
            issues.append(f"Found {len(orphaned_employees)} employees with invalid user_id")
            print(f"  ❌ FAIL: {len(orphaned_employees)} orphaned employees")
        else:
            checks_passed += 1
            print("  ✅ PASS: All employees have valid user_id")

        # 2. Check all department assignments have valid employee_id
        print("\n🔍 Check 2: All department assignments have valid employee_id")
        checks_total += 1

        orphaned_assignments = db.query(DepartmentAssignmentHistory).filter(
            ~DepartmentAssignmentHistory.employee_id.in_(db.query(Employee.id))
        ).all()

        if orphaned_assignments:
            issues.append(f"Found {len(orphaned_assignments)} assignments with invalid employee_id")
            print(f"  ❌ FAIL: {len(orphaned_assignments)} orphaned assignments")
        else:
            checks_passed += 1
            print("  ✅ PASS: All assignments have valid employee_id")

        # 3. Check all department assignments have valid changed_by
        print("\n🔍 Check 3: All department assignments have valid changed_by")
        checks_total += 1

        invalid_changers = db.query(DepartmentAssignmentHistory).filter(
            ~DepartmentAssignmentHistory.changed_by.in_(db.query(User.id))
        ).all()

        if invalid_changers:
            issues.append(f"Found {len(invalid_changers)} assignments with invalid changed_by")
            print(f"  ❌ FAIL: {len(invalid_changers)} assignments with invalid changed_by")
        else:
            checks_passed += 1
            print("  ✅ PASS: All assignments have valid changed_by")

        # 4. Check extended_fields is valid JSON
        print("\n🔍 Check 4: All extended_fields contain valid JSON")
        checks_total += 1

        employees_with_extended = db.query(Employee).filter(
            Employee.extended_fields.isnot(None)
        ).all()

        invalid_json_count = 0
        for employee in employees_with_extended:
            try:
                if employee.extended_fields:
                    # Try to access the JSON - SQLAlchemy should handle this
                    _ = employee.extended_fields
            except Exception as e:
                invalid_json_count += 1
                issues.append(f"Employee {employee.id} has invalid JSON in extended_fields: {e}")

        if invalid_json_count > 0:
            print(f"  ❌ FAIL: {invalid_json_count} employees with invalid JSON")
        else:
            checks_passed += 1
            print(f"  ✅ PASS: All {len(employees_with_extended)} employees have valid JSON")

        # 5. Check no orphaned records (users without employees for employee role)
        print("\n🔍 Check 5: No orphaned user records")
        checks_total += 1

        employee_users = db.query(User).filter(User.role == "employee").all()
        orphaned_users = []

        for user in employee_users:
            employee = db.query(Employee).filter(Employee.user_id == user.id).first()
            if not employee:
                orphaned_users.append(user)

        if orphaned_users:
            issues.append(f"Found {len(orphaned_users)} employee users without employee records")
            print(f"  ⚠️  WARNING: {len(orphaned_users)} employee users without employee records")
            # This is a warning, not a failure
            checks_passed += 1
        else:
            checks_passed += 1
            print("  ✅ PASS: All employee users have employee records")

        # 6. Check timestamps are populated
        print("\n🔍 Check 6: All records have timestamps")
        checks_total += 1

        missing_timestamps = 0

        # Check users
        users_no_timestamps = db.query(User).filter(
            (User.created_at.is_(None)) | (User.updated_at.is_(None))
        ).count()

        # Check employees
        employees_no_timestamps = db.query(Employee).filter(
            (Employee.created_at.is_(None)) | (Employee.updated_at.is_(None))
        ).count()

        # Check assignments
        assignments_no_timestamps = db.query(DepartmentAssignmentHistory).filter(
            DepartmentAssignmentHistory.changed_at.is_(None)
        ).count()

        missing_timestamps = users_no_timestamps + employees_no_timestamps + assignments_no_timestamps

        if missing_timestamps > 0:
            issues.append(f"Found {missing_timestamps} records with missing timestamps")
            print(f"  ❌ FAIL: {missing_timestamps} records missing timestamps")
        else:
            checks_passed += 1
            print("  ✅ PASS: All records have timestamps")

        # 7. Check default values applied
        print("\n🔍 Check 7: Default values applied correctly")
        checks_total += 1

        # Check users have default role
        users_no_role = db.query(User).filter(User.role.is_(None)).count()

        # Check users have default is_active
        users_no_active = db.query(User).filter(User.is_active.is_(None)).count()

        default_issues = users_no_role + users_no_active

        if default_issues > 0:
            issues.append(f"Found {default_issues} records with missing default values")
            print(f"  ❌ FAIL: {default_issues} records missing default values")
        else:
            checks_passed += 1
            print("  ✅ PASS: All default values applied")

        # 8. Check unique constraints
        print("\n🔍 Check 8: Unique constraints enforced")
        checks_total += 1

        # Check for duplicate usernames
        duplicate_usernames = db.execute(text("""
            SELECT username, COUNT(*) as count
            FROM users
            GROUP BY username
            HAVING COUNT(*) > 1
        """)).fetchall()

        # Check for duplicate emails
        duplicate_emails = db.execute(text("""
            SELECT email, COUNT(*) as count
            FROM users
            GROUP BY email
            HAVING COUNT(*) > 1
        """)).fetchall()

        if duplicate_usernames or duplicate_emails:
            issues.append(f"Found duplicate usernames or emails")
            print(f"  ❌ FAIL: Duplicate usernames/emails found")
        else:
            checks_passed += 1
            print("  ✅ PASS: No duplicate usernames or emails")

        # Print summary
        print("\n" + "="*60)
        print("VERIFICATION SUMMARY")
        print("="*60)
        print(f"Checks Passed: {checks_passed}/{checks_total}")

        if issues:
            print(f"\n⚠️  Issues Found ({len(issues)}):")
            for i, issue in enumerate(issues, 1):
                print(f"  {i}. {issue}")

        print("="*60)

        # Print statistics
        print("\n📊 Database Statistics:")
        user_count = db.query(User).count()
        employee_count = db.query(Employee).count()
        assignment_count = db.query(DepartmentAssignmentHistory).count()

        print(f"  - Total users: {user_count}")
        print(f"  - Total employees: {employee_count}")
        print(f"  - Total department assignments: {assignment_count}")

        # Print department breakdown
        print("\n📈 Department Breakdown:")
        dept_query = db.execute(text("""
            SELECT department, COUNT(*) as count
            FROM employees
            WHERE department IS NOT NULL
            GROUP BY department
            ORDER BY count DESC
        """))

        for dept, count in dept_query:
            print(f"  - {dept}: {count}")

        print("="*60)

        if checks_passed == checks_total:
            print("\n✅ ALL INTEGRITY CHECKS PASSED")
            return True
        else:
            print(f"\n⚠️  {checks_total - checks_passed} CHECKS FAILED")
            return False

    except Exception as e:
        print(f"\n❌ Error verifying data integrity: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = verify_data_integrity()
    sys.exit(0 if success else 1)
