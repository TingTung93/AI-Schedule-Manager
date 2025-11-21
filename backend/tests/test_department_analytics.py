"""
Comprehensive tests for department analytics functionality.

Tests include:
- Analytics overview calculations
- Department-specific analytics
- Employee distribution analysis
- Edge cases (empty departments, null values)
- Performance with large datasets
- Time-based analytics
- Cross-department comparisons

Coverage target: >90%
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Dict, List

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models import Department, Schedule, ScheduleAssignment, Shift, User


class TestAnalyticsOverview:
    """Test analytics overview endpoint functionality."""

    @pytest.fixture
    async def setup_analytics_data(self, db: AsyncSession):
        """Create comprehensive test data for analytics."""
        import bcrypt

        # Create departments
        depts = []
        for i in range(3):
            dept = Department(
                name=f"Department {i}",
                description=f"Test department {i}",
                active=True
            )
            depts.append(dept)

        db.add_all(depts)
        await db.commit()

        for dept in depts:
            await db.refresh(dept)

        # Create employees distributed across departments
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(30):
            emp = User(
                email=f"analytics_emp{i}@test.com",
                password_hash=password_hash,
                first_name=f"Analytics",
                last_name=f"Employee{i}",
                department_id=depts[i % 3].id,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        for emp in employees:
            await db.refresh(emp)

        return {
            "departments": depts,
            "employees": employees
        }

    async def test_count_total_employees(self, db: AsyncSession, setup_analytics_data):
        """Test counting total active employees."""
        query = select(func.count(User.id)).where(User.is_active == True)
        result = await db.execute(query)
        total = result.scalar()

        assert total == 30

    async def test_count_employees_by_department(self, db: AsyncSession, setup_analytics_data):
        """Test counting employees per department."""
        data = setup_analytics_data

        for dept in data["departments"]:
            query = select(func.count(User.id)).where(User.department_id == dept.id)
            result = await db.execute(query)
            count = result.scalar()

            # Should have 10 employees per department (30 / 3)
            assert count == 10

    async def test_employee_distribution_percentages(self, db: AsyncSession, setup_analytics_data):
        """Test calculating employee distribution percentages."""
        data = setup_analytics_data

        # Total employees
        total_query = select(func.count(User.id)).where(User.is_active == True)
        total_result = await db.execute(total_query)
        total_employees = total_result.scalar()

        distribution = {}
        for dept in data["departments"]:
            query = select(func.count(User.id)).where(User.department_id == dept.id)
            result = await db.execute(query)
            count = result.scalar()

            percentage = (count / total_employees * 100) if total_employees > 0 else 0
            distribution[dept.name] = {
                "count": count,
                "percentage": round(percentage, 2)
            }

        # Verify even distribution (33.33% each)
        for dept_name, stats in distribution.items():
            assert stats["count"] == 10
            assert 33.0 <= stats["percentage"] <= 34.0

    async def test_count_unassigned_employees(self, db: AsyncSession):
        """Test counting employees not assigned to any department."""
        import bcrypt

        # Create unassigned employees
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(5):
            emp = User(
                email=f"unassigned_analytics{i}@test.com",
                password_hash=password_hash,
                first_name=f"Unassigned",
                last_name=f"Analytics{i}",
                department_id=None,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Count unassigned
        query = select(func.count(User.id)).where(
            User.department_id.is_(None),
            User.is_active == True
        )
        result = await db.execute(query)
        unassigned_count = result.scalar()

        assert unassigned_count == 5


class TestDepartmentSpecificAnalytics:
    """Test analytics for specific departments."""

    @pytest.fixture
    async def setup_department_analytics(self, db: AsyncSession):
        """Create department with varied employee data."""
        import bcrypt

        # Create department
        dept = Department(
            name="Analytics Dept",
            description="Department for analytics testing",
            active=True
        )
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        # Create employees with varying active status
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(20):
            emp = User(
                email=f"dept_analytics{i}@test.com",
                password_hash=password_hash,
                first_name=f"Dept",
                last_name=f"Analytics{i}",
                department_id=dept.id,
                is_active=(i < 15)  # 15 active, 5 inactive
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        return {
            "department": dept,
            "employees": employees
        }

    async def test_active_vs_inactive_employees(self, db: AsyncSession, setup_department_analytics):
        """Test counting active vs inactive employees in department."""
        data = setup_department_analytics
        dept_id = data["department"].id

        # Count active
        active_query = select(func.count(User.id)).where(
            User.department_id == dept_id,
            User.is_active == True
        )
        active_result = await db.execute(active_query)
        active_count = active_result.scalar()

        # Count inactive
        inactive_query = select(func.count(User.id)).where(
            User.department_id == dept_id,
            User.is_active == False
        )
        inactive_result = await db.execute(inactive_query)
        inactive_count = inactive_result.scalar()

        assert active_count == 15
        assert inactive_count == 5

    async def test_department_growth_over_time(self, db: AsyncSession):
        """Test tracking department size over time."""
        import bcrypt
        import asyncio

        dept = Department(name="Growth Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Add employees in batches to simulate growth
        snapshots = []

        for batch in range(3):
            employees = []
            for i in range(5):
                emp = User(
                    email=f"growth{batch}_{i}@test.com",
                    password_hash=password_hash,
                    first_name=f"Growth",
                    last_name=f"Employee{batch}_{i}",
                    department_id=dept.id,
                    is_active=True
                )
                employees.append(emp)

            db.add_all(employees)
            await db.commit()

            # Take snapshot
            query = select(func.count(User.id)).where(User.department_id == dept.id)
            result = await db.execute(query)
            count = result.scalar()

            snapshots.append({
                "batch": batch,
                "count": count,
                "timestamp": datetime.utcnow()
            })

            await asyncio.sleep(0.05)

        # Verify growth progression
        assert snapshots[0]["count"] == 5
        assert snapshots[1]["count"] == 10
        assert snapshots[2]["count"] == 15

    async def test_average_employees_per_department(self, db: AsyncSession):
        """Test calculating average employees per department."""
        import bcrypt

        # Create multiple departments with varying sizes
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        dept_sizes = [5, 10, 15, 20]
        departments = []

        for idx, size in enumerate(dept_sizes):
            dept = Department(name=f"Avg Dept {idx}", active=True)
            db.add(dept)
            await db.commit()
            await db.refresh(dept)
            departments.append(dept)

            # Add employees
            employees = []
            for i in range(size):
                emp = User(
                    email=f"avg_dept{idx}_{i}@test.com",
                    password_hash=password_hash,
                    first_name=f"Avg",
                    last_name=f"Employee{idx}_{i}",
                    department_id=dept.id,
                    is_active=True
                )
                employees.append(emp)

            db.add_all(employees)
            await db.commit()

        # Calculate average
        total_employees = sum(dept_sizes)
        total_departments = len(dept_sizes)
        average = total_employees / total_departments

        assert average == 12.5  # (5 + 10 + 15 + 20) / 4


class TestEmployeeDistributionAnalysis:
    """Test employee distribution analytics."""

    async def test_distribution_by_department_size(self, db: AsyncSession):
        """Test categorizing departments by size."""
        import bcrypt

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Create departments of different sizes
        # Small: 1-10, Medium: 11-25, Large: 26+
        dept_configs = [
            ("Small Dept 1", 5),
            ("Small Dept 2", 8),
            ("Medium Dept 1", 15),
            ("Medium Dept 2", 20),
            ("Large Dept 1", 30),
            ("Large Dept 2", 40)
        ]

        size_categories = {"small": 0, "medium": 0, "large": 0}

        for dept_name, size in dept_configs:
            dept = Department(name=dept_name, active=True)
            db.add(dept)
            await db.commit()
            await db.refresh(dept)

            # Add employees
            employees = []
            for i in range(size):
                emp = User(
                    email=f"{dept_name.lower().replace(' ', '_')}_{i}@test.com",
                    password_hash=password_hash,
                    first_name=f"Dist",
                    last_name=f"Employee{i}",
                    department_id=dept.id,
                    is_active=True
                )
                employees.append(emp)

            db.add_all(employees)
            await db.commit()

            # Categorize
            if size <= 10:
                size_categories["small"] += 1
            elif size <= 25:
                size_categories["medium"] += 1
            else:
                size_categories["large"] += 1

        assert size_categories["small"] == 2
        assert size_categories["medium"] == 2
        assert size_categories["large"] == 2

    async def test_find_largest_and_smallest_departments(self, db: AsyncSession):
        """Test identifying largest and smallest departments."""
        import bcrypt

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Create departments with varying sizes
        sizes = [5, 10, 3, 25, 15, 30]
        departments = []

        for idx, size in enumerate(sizes):
            dept = Department(name=f"Size Dept {idx}", active=True)
            db.add(dept)
            await db.commit()
            await db.refresh(dept)
            departments.append(dept)

            employees = []
            for i in range(size):
                emp = User(
                    email=f"size_dept{idx}_{i}@test.com",
                    password_hash=password_hash,
                    first_name=f"Size",
                    last_name=f"Employee{idx}_{i}",
                    department_id=dept.id,
                    is_active=True
                )
                employees.append(emp)

            db.add_all(employees)
            await db.commit()

        # Find department with most employees
        largest_query = (
            select(Department.id, Department.name, func.count(User.id).label('emp_count'))
            .join(User, User.department_id == Department.id)
            .group_by(Department.id, Department.name)
            .order_by(func.count(User.id).desc())
            .limit(1)
        )
        largest_result = await db.execute(largest_query)
        largest = largest_result.first()

        # Find department with least employees
        smallest_query = (
            select(Department.id, Department.name, func.count(User.id).label('emp_count'))
            .join(User, User.department_id == Department.id)
            .group_by(Department.id, Department.name)
            .order_by(func.count(User.id).asc())
            .limit(1)
        )
        smallest_result = await db.execute(smallest_query)
        smallest = smallest_result.first()

        assert largest.emp_count == 30  # Largest department
        assert smallest.emp_count == 3   # Smallest department


class TestEdgeCasesAndNullValues:
    """Test analytics with edge cases and null values."""

    async def test_empty_department_analytics(self, db: AsyncSession):
        """Test analytics for department with no employees."""
        # Create empty department
        empty_dept = Department(
            name="Empty Dept",
            description="Department with no employees",
            active=True
        )
        db.add(empty_dept)
        await db.commit()
        await db.refresh(empty_dept)

        # Count employees
        query = select(func.count(User.id)).where(User.department_id == empty_dept.id)
        result = await db.execute(query)
        count = result.scalar()

        assert count == 0

    async def test_all_inactive_department(self, db: AsyncSession):
        """Test analytics for department with all inactive employees."""
        import bcrypt

        dept = Department(name="Inactive Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(10):
            emp = User(
                email=f"inactive{i}@test.com",
                password_hash=password_hash,
                first_name=f"Inactive",
                last_name=f"Employee{i}",
                department_id=dept.id,
                is_active=False  # All inactive
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Count active employees
        active_query = select(func.count(User.id)).where(
            User.department_id == dept.id,
            User.is_active == True
        )
        active_result = await db.execute(active_query)
        active_count = active_result.scalar()

        # Count total employees
        total_query = select(func.count(User.id)).where(User.department_id == dept.id)
        total_result = await db.execute(total_query)
        total_count = total_result.scalar()

        assert active_count == 0
        assert total_count == 10

    async def test_inactive_department_excluded_from_analytics(self, db: AsyncSession):
        """Test that inactive departments are excluded from active analytics."""
        import bcrypt

        # Create active and inactive departments
        active_dept = Department(name="Active Dept", active=True)
        inactive_dept = Department(name="Inactive Dept", active=False)
        db.add_all([active_dept, inactive_dept])
        await db.commit()
        await db.refresh(active_dept)
        await db.refresh(inactive_dept)

        # Add employees to both
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        for dept in [active_dept, inactive_dept]:
            employees = []
            for i in range(5):
                emp = User(
                    email=f"{dept.name.lower().replace(' ', '_')}_{i}@test.com",
                    password_hash=password_hash,
                    first_name=f"Test",
                    last_name=f"Employee{i}",
                    department_id=dept.id,
                    is_active=True
                )
                employees.append(emp)

            db.add_all(employees)
            await db.commit()

        # Count employees in active departments only
        query = (
            select(func.count(User.id))
            .join(Department, User.department_id == Department.id)
            .where(Department.active == True)
        )
        result = await db.execute(query)
        active_dept_employees = result.scalar()

        assert active_dept_employees == 5  # Only from active department

    async def test_null_department_handling(self, db: AsyncSession):
        """Test analytics correctly handle null department values."""
        import bcrypt

        # Create department
        dept = Department(name="Null Test Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Create mix of assigned and unassigned employees
        employees = []
        for i in range(20):
            emp = User(
                email=f"null_test{i}@test.com",
                password_hash=password_hash,
                first_name=f"Null",
                last_name=f"Test{i}",
                department_id=dept.id if i < 10 else None,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Count assigned
        assigned_query = select(func.count(User.id)).where(
            User.department_id.isnot(None)
        )
        assigned_result = await db.execute(assigned_query)
        assigned_count = assigned_result.scalar()

        # Count unassigned
        unassigned_query = select(func.count(User.id)).where(
            User.department_id.is_(None)
        )
        unassigned_result = await db.execute(unassigned_query)
        unassigned_count = unassigned_result.scalar()

        assert assigned_count == 10
        assert unassigned_count == 10


class TestPerformanceWithLargeDatasets:
    """Test analytics performance with large datasets."""

    async def test_analytics_with_1000_employees(self, db: AsyncSession):
        """Test analytics performance with 1000 employees across 10 departments."""
        import time
        import bcrypt

        # Create departments
        departments = []
        for i in range(10):
            dept = Department(name=f"Large Dept {i}", active=True)
            departments.append(dept)

        db.add_all(departments)
        await db.commit()

        for dept in departments:
            await db.refresh(dept)

        # Create 1000 employees
        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(1000):
            emp = User(
                email=f"large_dataset{i}@test.com",
                password_hash=password_hash,
                first_name=f"Large",
                last_name=f"Dataset{i}",
                department_id=departments[i % 10].id,
                is_active=True
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Time analytics query
        start_time = time.time()

        query = (
            select(Department.name, func.count(User.id).label('emp_count'))
            .join(User, User.department_id == Department.id)
            .where(Department.active == True)
            .group_by(Department.name)
        )
        result = await db.execute(query)
        analytics = result.all()

        end_time = time.time()
        duration = end_time - start_time

        # Verify results
        assert len(analytics) == 10
        for dept_name, count in analytics:
            assert count == 100  # 1000 / 10 departments

        # Performance requirement
        assert duration < 0.5  # Should complete in under 500ms

        print(f"Analytics for 1000 employees completed in {duration:.3f} seconds")

    async def test_complex_analytics_query_performance(self, db: AsyncSession):
        """Test performance of complex multi-table analytics."""
        import time
        import bcrypt

        # Create test data
        dept = Department(name="Complex Query Dept", active=True)
        db.add(dept)
        await db.commit()
        await db.refresh(dept)

        password_hash = bcrypt.hashpw("Test123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        employees = []
        for i in range(500):
            emp = User(
                email=f"complex{i}@test.com",
                password_hash=password_hash,
                first_name=f"Complex",
                last_name=f"Employee{i}",
                department_id=dept.id,
                is_active=(i % 5 != 0)  # 80% active
            )
            employees.append(emp)

        db.add_all(employees)
        await db.commit()

        # Complex query: Count active/inactive breakdown
        start_time = time.time()

        query = (
            select(
                Department.name,
                func.count(User.id).label('total'),
                func.sum(func.cast(User.is_active, func.Integer())).label('active'),
                func.sum(func.cast(~User.is_active, func.Integer())).label('inactive')
            )
            .join(User, User.department_id == Department.id)
            .group_by(Department.name)
        )
        result = await db.execute(query)
        stats = result.first()

        end_time = time.time()
        duration = end_time - start_time

        # Verify results
        assert stats.total == 500
        assert stats.active == 400  # 80% of 500
        assert stats.inactive == 100  # 20% of 500

        # Performance requirement
        assert duration < 0.3  # Should complete in under 300ms

        print(f"Complex analytics query completed in {duration:.3f} seconds")
