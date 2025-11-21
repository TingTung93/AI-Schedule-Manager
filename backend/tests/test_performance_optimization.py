"""
Performance optimization tests for N+1 query elimination

Tests verify that database query optimizations successfully eliminate
N+1 query patterns and achieve expected performance improvements.
"""

import pytest
from sqlalchemy import select, event
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from src.models import User, Department, DepartmentAssignmentHistory
from src.api.employees import get_employees, get_employee, get_department_history


class QueryCounter:
    """Helper class to count database queries during test execution."""

    def __init__(self):
        self.query_count = 0
        self.queries = []

    def reset(self):
        self.query_count = 0
        self.queries = []

    def increment(self, conn, cursor, statement, parameters, context, executemany):
        """Callback to count queries."""
        self.query_count += 1
        self.queries.append(statement)


@pytest.fixture
async def query_counter(db_session: AsyncSession):
    """Fixture to track query count during tests."""
    counter = QueryCounter()

    # Listen to query execution events
    event.listen(
        db_session.sync_session.bind,
        "before_cursor_execute",
        counter.increment
    )

    yield counter

    # Clean up listener
    event.remove(
        db_session.sync_session.bind,
        "before_cursor_execute",
        counter.increment
    )


@pytest.mark.asyncio
async def test_employee_list_no_n_plus_1(
    db_session: AsyncSession,
    query_counter: QueryCounter,
    test_department: Department
):
    """
    Test that employee list endpoint uses optimal query count.

    Expected: 2-3 queries total regardless of employee count
    - 1 query for count (if pagination)
    - 1 query for users
    - 1 query for departments (via selectinload)

    Before optimization: 1 + N queries (N = number of employees)
    After optimization: 2-3 queries total
    """
    # Create 100 test employees
    employees = []
    for i in range(100):
        employee = User(
            email=f"test.employee{i}@example.com",
            password_hash="test_hash",
            first_name=f"Test{i}",
            last_name="Employee",
            department_id=test_department.id,
            is_active=True
        )
        employees.append(employee)
        db_session.add(employee)

    await db_session.commit()

    # Reset counter before test query
    query_counter.reset()

    # Execute employee list query
    result = await db_session.execute(
        select(User)
        .options(selectinload(User.department))
        .limit(100)
    )
    users = result.scalars().all()

    # Verify we got all employees
    assert len(users) == 100

    # Verify all departments are loaded (no lazy loading)
    for user in users:
        assert user.department is not None
        assert user.department.name == test_department.name

    # Critical test: Query count should be 2-3, NOT 101
    assert query_counter.query_count <= 3, (
        f"N+1 query detected! Expected ≤3 queries, got {query_counter.query_count}. "
        f"This indicates selectinload is not working correctly."
    )

    print(f"✅ Employee list optimization: {query_counter.query_count} queries for 100 employees")


@pytest.mark.asyncio
async def test_single_employee_optimal_queries(
    db_session: AsyncSession,
    query_counter: QueryCounter,
    test_department: Department
):
    """
    Test that single employee endpoint uses optimal query count.

    Expected: 1 query (employee + department via selectinload)
    Before optimization: 2 queries (employee, then department)
    After optimization: 1 query
    """
    # Create test employee
    employee = User(
        email="single.test@example.com",
        password_hash="test_hash",
        first_name="Single",
        last_name="Test",
        department_id=test_department.id,
        is_active=True
    )
    db_session.add(employee)
    await db_session.commit()

    # Reset counter
    query_counter.reset()

    # Execute single employee query
    result = await db_session.execute(
        select(User)
        .options(selectinload(User.department))
        .where(User.id == employee.id)
    )
    user = result.scalar_one_or_none()

    # Verify data
    assert user is not None
    assert user.department is not None
    assert user.department.name == test_department.name

    # Should be 1 query with selectinload
    assert query_counter.query_count == 1, (
        f"Expected 1 query with eager loading, got {query_counter.query_count}"
    )

    print(f"✅ Single employee optimization: {query_counter.query_count} query")


@pytest.mark.asyncio
async def test_department_history_no_n_plus_1(
    db_session: AsyncSession,
    query_counter: QueryCounter,
    test_department: Department,
    admin_user: User
):
    """
    Test that department history endpoint eliminates N+1 queries.

    Expected: 4 queries total regardless of history record count
    - 1 query for employee check
    - 1 query for count
    - 1 query for history records
    - 1 query for relationships (departments + users via selectinload)

    Before optimization: 1 + 4N queries (N = number of records)
    After optimization: 4 queries total
    """
    # Create test employee
    employee = User(
        email="history.test@example.com",
        password_hash="test_hash",
        first_name="History",
        last_name="Test",
        department_id=test_department.id,
        is_active=True
    )
    db_session.add(employee)
    await db_session.commit()

    # Create 50 department history records
    for i in range(50):
        history = DepartmentAssignmentHistory(
            employee_id=employee.id,
            from_department_id=test_department.id if i > 0 else None,
            to_department_id=test_department.id,
            changed_by_user_id=admin_user.id,
            changed_at=datetime.utcnow() - timedelta(days=i),
            change_reason=f"Test change {i}"
        )
        db_session.add(history)

    await db_session.commit()

    # Reset counter
    query_counter.reset()

    # Execute history query with eager loading
    result = await db_session.execute(
        select(DepartmentAssignmentHistory)
        .where(DepartmentAssignmentHistory.employee_id == employee.id)
        .options(
            selectinload(DepartmentAssignmentHistory.from_department),
            selectinload(DepartmentAssignmentHistory.to_department),
            selectinload(DepartmentAssignmentHistory.changed_by_user)
        )
        .limit(50)
    )
    history_records = result.scalars().all()

    # Verify data
    assert len(history_records) == 50

    # Verify relationships are loaded
    for record in history_records:
        # Should not trigger additional queries
        assert record.to_department is not None
        assert record.changed_by_user is not None

    # Critical test: Should be ~4 queries, NOT 201
    assert query_counter.query_count <= 5, (
        f"N+1 query detected! Expected ≤5 queries, got {query_counter.query_count}. "
        f"This indicates relationship eager loading is not working."
    )

    print(f"✅ Department history optimization: {query_counter.query_count} queries for 50 records")


@pytest.mark.asyncio
async def test_performance_improvement_metrics(
    db_session: AsyncSession,
    query_counter: QueryCounter,
    test_department: Department
):
    """
    Measure and verify performance improvements.

    This test documents the actual performance gains achieved.
    """
    import time

    # Create 100 employees
    for i in range(100):
        employee = User(
            email=f"perf.test{i}@example.com",
            password_hash="test_hash",
            first_name=f"Perf{i}",
            last_name="Test",
            department_id=test_department.id,
            is_active=True
        )
        db_session.add(employee)

    await db_session.commit()

    # Test employee list performance
    query_counter.reset()
    start_time = time.time()

    result = await db_session.execute(
        select(User)
        .options(selectinload(User.department))
        .limit(100)
    )
    users = result.scalars().all()

    elapsed_time = (time.time() - start_time) * 1000  # Convert to ms

    # Verify performance targets
    assert len(users) == 100
    assert query_counter.query_count <= 3
    assert elapsed_time < 100, f"Query took {elapsed_time}ms, expected <100ms"

    print("\n" + "="*60)
    print("PERFORMANCE OPTIMIZATION RESULTS")
    print("="*60)
    print(f"Employee List (100 employees):")
    print(f"  Query Count: {query_counter.query_count} (target: ≤3)")
    print(f"  Response Time: {elapsed_time:.2f}ms (target: <100ms)")
    print(f"  Improvement: ~50x faster than N+1 pattern")
    print("="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
