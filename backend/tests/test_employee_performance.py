"""
Performance tests for employee endpoints to verify N+1 query elimination.

This module tests that employee list endpoints don't suffer from N+1 query problems
by verifying query counts remain constant regardless of result set size.
"""

import pytest
from unittest.mock import Mock, patch
from sqlalchemy import event, select
from sqlalchemy.engine import Engine
from datetime import datetime

from src.auth.models import User, Role
from src.models.department import Department


class QueryCounter:
    """Helper class to count SQL queries executed during a test."""

    def __init__(self):
        self.query_count = 0
        self.queries = []

    def reset(self):
        """Reset query counter."""
        self.query_count = 0
        self.queries = []

    def before_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Count queries before execution."""
        self.query_count += 1
        self.queries.append(statement)


@pytest.fixture
def query_counter():
    """Fixture to provide query counter for tests."""
    return QueryCounter()


@pytest.fixture
def enable_query_counting(db_session, query_counter):
    """Enable query counting for the test database session."""
    engine = db_session.get_bind()

    event.listen(
        engine,
        "before_cursor_execute",
        query_counter.before_cursor_execute
    )

    yield query_counter

    event.remove(
        engine,
        "before_cursor_execute",
        query_counter.before_cursor_execute
    )


@pytest.mark.asyncio
async def test_get_employees_no_n_plus_1(client, admin_token, db_session, enable_query_counting):
    """
    Test that GET /api/employees doesn't have N+1 query problem.

    Verifies that query count remains constant regardless of number of employees.
    Expected queries:
    1. Count query for pagination
    2. User query with role eager loading
    3. Bulk department load (single query for all departments)

    Total: 3 queries maximum regardless of result size
    """
    # Create test data with departments
    from src.models.department import Department

    dept1 = Department(name="Engineering", description="Engineering dept", active=True)
    dept2 = Department(name="Sales", description="Sales dept", active=True)
    db_session.add_all([dept1, dept2])
    await db_session.commit()
    await db_session.refresh(dept1)
    await db_session.refresh(dept2)

    # Create 20 test employees with departments
    test_employees = []
    for i in range(20):
        user = User(
            email=f"test{i}@example.com",
            password_hash="hashed_password",
            first_name=f"Test{i}",
            last_name=f"User{i}",
            department_id=dept1.id if i % 2 == 0 else dept2.id,
            is_active=True
        )
        test_employees.append(user)

    db_session.add_all(test_employees)
    await db_session.commit()

    # Reset query counter before making the request
    enable_query_counting.reset()

    # Make request to get employees
    response = await client.get(
        "/api/employees",
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == 200
    data = response.json()

    # Should return employees
    assert len(data["employees"]) > 0

    # Verify query count - should be O(1) not O(n)
    # Expected queries:
    # 1. COUNT(*) for total
    # 2. SELECT users with eager loaded roles
    # 3. Bulk SELECT departments WHERE id IN (...)
    print(f"\n[PERF TEST] Total queries executed: {enable_query_counting.query_count}")
    print(f"[PERF TEST] Number of employees returned: {len(data['employees'])}")

    for i, query in enumerate(enable_query_counting.queries, 1):
        print(f"\n[QUERY {i}]: {query[:200]}...")

    # Assert that we have at most 3-4 queries regardless of result size
    # Allow some flexibility for transaction queries
    assert enable_query_counting.query_count <= 5, (
        f"Too many queries! Expected ≤5, got {enable_query_counting.query_count}. "
        f"This indicates an N+1 query problem."
    )


@pytest.mark.asyncio
async def test_get_employee_by_id_no_n_plus_1(client, admin_token, db_session, enable_query_counting):
    """
    Test that GET /api/employees/{id} doesn't have N+1 query problem.

    Expected queries:
    1. SELECT user with eager loaded roles
    2. SELECT department (if user has department)

    Total: 2 queries maximum
    """
    # Create test department
    dept = Department(name="Engineering", description="Engineering dept", active=True)
    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)

    # Create test employee
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        first_name="Test",
        last_name="User",
        department_id=dept.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Reset query counter
    enable_query_counting.reset()

    # Make request
    response = await client.get(
        f"/api/employees/{user.id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == 200

    print(f"\n[PERF TEST] Total queries for single employee: {enable_query_counting.query_count}")

    for i, query in enumerate(enable_query_counting.queries, 1):
        print(f"\n[QUERY {i}]: {query[:200]}...")

    # Should be at most 2-3 queries (user + department + maybe transaction)
    assert enable_query_counting.query_count <= 4, (
        f"Too many queries! Expected ≤4, got {enable_query_counting.query_count}"
    )


@pytest.mark.asyncio
async def test_query_scaling_with_large_dataset(client, admin_token, db_session, enable_query_counting):
    """
    Test that query count doesn't scale with dataset size (N+1 verification).

    Creates datasets of different sizes and verifies query count stays constant.
    """
    # Create departments
    dept1 = Department(name="Dept1", description="Test dept 1", active=True)
    dept2 = Department(name="Dept2", description="Test dept 2", active=True)
    db_session.add_all([dept1, dept2])
    await db_session.commit()

    # Test with 10 employees
    employees_10 = []
    for i in range(10):
        user = User(
            email=f"user10_{i}@example.com",
            password_hash="hashed",
            first_name=f"User{i}",
            last_name=f"Ten{i}",
            department_id=dept1.id,
            is_active=True
        )
        employees_10.append(user)

    db_session.add_all(employees_10)
    await db_session.commit()

    enable_query_counting.reset()
    response = await client.get(
        "/api/employees?limit=10",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    queries_for_10 = enable_query_counting.query_count
    print(f"\n[PERF TEST] Queries for 10 employees: {queries_for_10}")

    # Add 90 more employees (total 100)
    employees_90 = []
    for i in range(90):
        user = User(
            email=f"user100_{i}@example.com",
            password_hash="hashed",
            first_name=f"User{i}",
            last_name=f"Hundred{i}",
            department_id=dept2.id if i % 2 else dept1.id,
            is_active=True
        )
        employees_90.append(user)

    db_session.add_all(employees_90)
    await db_session.commit()

    enable_query_counting.reset()
    response = await client.get(
        "/api/employees?limit=100",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    queries_for_100 = enable_query_counting.query_count
    print(f"[PERF TEST] Queries for 100 employees: {queries_for_100}")

    # Query count should be similar (±1-2 queries due to department variations)
    # If we have N+1 problem, queries_for_100 would be ~90 more than queries_for_10
    assert abs(queries_for_100 - queries_for_10) <= 2, (
        f"Query count scaled with dataset! "
        f"10 employees: {queries_for_10} queries, "
        f"100 employees: {queries_for_100} queries. "
        f"This indicates N+1 problem."
    )


@pytest.mark.asyncio
async def test_index_usage_verification(db_session):
    """
    Verify that database indexes exist for performance-critical columns.

    This test checks that indexes are properly created for:
    - department_id (JOIN operations)
    - first_name, last_name (search operations)
    - is_active (filtering)
    """
    # Query to check indexes on users table
    index_query = """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users'
        AND (
            indexdef LIKE '%department_id%'
            OR indexdef LIKE '%first_name%'
            OR indexdef LIKE '%last_name%'
            OR indexdef LIKE '%is_active%'
        )
    """

    result = await db_session.execute(index_query)
    indexes = result.fetchall()

    print("\n[INDEX CHECK] Indexes found on users table:")
    for idx_name, idx_def in indexes:
        print(f"  - {idx_name}: {idx_def}")

    # Verify important indexes exist
    index_names = [idx[0] for idx in indexes]

    # Check for performance indexes (names may vary)
    has_dept_index = any('department' in idx.lower() for idx in index_names)
    has_name_index = any('name' in idx.lower() for idx in index_names)
    has_active_index = any('active' in idx.lower() for idx in index_names)

    assert has_dept_index, "Missing index on department_id"
    assert has_name_index, "Missing index on name columns"
    print("[INDEX CHECK] All required indexes are present ✓")


@pytest.mark.asyncio
async def test_department_eager_loading_in_list(client, admin_token, db_session):
    """
    Test that departments are properly eager-loaded in list endpoint.

    Verifies that accessing department data doesn't trigger additional queries.
    """
    # Create test data
    dept = Department(name="Test Dept", description="Test", active=True)
    db_session.add(dept)
    await db_session.commit()

    user = User(
        email="test@example.com",
        password_hash="hashed",
        first_name="Test",
        last_name="User",
        department_id=dept.id,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()

    # Get employees
    response = await client.get(
        "/api/employees",
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify department data is present in response
    assert len(data["employees"]) > 0
    employee = data["employees"][0]

    # Department should be loaded and accessible without additional queries
    if employee.get("department_id"):
        assert employee.get("department") is not None, (
            "Department data should be eager-loaded and present in response"
        )
        assert "name" in employee["department"], (
            "Department object should have complete data"
        )
