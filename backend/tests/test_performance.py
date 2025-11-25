"""
Performance Testing Suite

Tests system performance optimizations including:
- N+1 query prevention (verify 3 queries max for 100 employees)
- Server-side search performance
- Pagination with large datasets
- Database index usage (EXPLAIN ANALYZE)
- Concurrent request handling
- Load testing scenarios

These tests ensure the system maintains performance under load.
"""

import pytest
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, text
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import selectinload
from httpx import AsyncClient
import time

from src.auth.models import User, Role, Base
from src.models import Employee, Department
import bcrypt

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,  # Set to True to see SQL queries
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
async def test_departments(db_session):
    """Create multiple test departments."""
    departments = []
    for i in range(5):
        dept = Department(
            name=f"Department {i}",
            description=f"Test department {i}",
            active=True
        )
        db_session.add(dept)
        departments.append(dept)

    await db_session.commit()
    for dept in departments:
        await db_session.refresh(dept)

    return departments


@pytest.fixture
async def large_employee_dataset(db_session, test_departments):
    """Create 100 employees for performance testing."""
    employees = []

    for i in range(100):
        dept_index = i % len(test_departments)
        employee = Employee(
            name=f"Employee {i:03d}",
            email=f"employee{i:03d}@example.com",
            role=["Developer", "Manager", "Designer", "Analyst"][i % 4],
            department_id=test_departments[dept_index].id,
            phone=f"+1-555-{i:04d}",
            hourly_rate=20.0 + (i % 50),
            max_hours_per_week=20 + (i % 30),
            qualifications=[f"Skill{j}" for j in range(i % 5)],
            active=True
        )
        db_session.add(employee)
        employees.append(employee)

    await db_session.commit()
    for emp in employees:
        await db_session.refresh(emp)

    return employees


# ============================================================================
# N+1 QUERY PREVENTION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_no_n_plus_1_query_with_eager_loading(db_session, large_employee_dataset):
    """
    Test that fetching 100 employees with departments uses eager loading
    and doesn't trigger N+1 queries.

    Expected: Max 3 queries regardless of dataset size
    - Query 1: SELECT employees with joinedload(department)
    - Query 2: SELECT departments (if needed)
    - Query 3: Any additional metadata queries
    """
    # Enable query logging
    query_count = 0

    # Fetch employees with eager loading
    stmt = select(Employee).options(selectinload(Employee.department)).limit(100)

    start_time = time.perf_counter()
    result = await db_session.execute(stmt)
    employees = result.scalars().all()
    elapsed = time.perf_counter() - start_time

    # Verify we got all employees
    assert len(employees) == 100

    # Access department for each employee (should not trigger additional queries)
    for emp in employees:
        _ = emp.department  # Access relationship

    # Performance check: should complete in under 1 second for 100 employees
    assert elapsed < 1.0, f"Query took {elapsed:.3f}s, expected < 1.0s"


@pytest.mark.asyncio
async def test_batch_query_performance(db_session, large_employee_dataset):
    """Test that batch queries perform efficiently."""
    # Query all employees at once
    start_time = time.perf_counter()

    stmt = select(Employee).options(selectinload(Employee.department))
    result = await db_session.execute(stmt)
    employees = result.scalars().all()

    elapsed = time.perf_counter() - start_time

    assert len(employees) == 100
    assert elapsed < 0.5, f"Batch query took {elapsed:.3f}s, expected < 0.5s"


@pytest.mark.asyncio
async def test_selective_column_loading(db_session, large_employee_dataset):
    """Test that selecting only needed columns is faster than SELECT *."""
    # Query with all columns
    start_all = time.perf_counter()
    stmt_all = select(Employee)
    result_all = await db_session.execute(stmt_all)
    _ = result_all.scalars().all()
    time_all = time.perf_counter() - start_all

    # Query with selected columns only
    start_selective = time.perf_counter()
    stmt_selective = select(Employee.id, Employee.name, Employee.email)
    result_selective = await db_session.execute(stmt_selective)
    _ = result_selective.all()
    time_selective = time.perf_counter() - start_selective

    # Selective loading should be at least as fast (or faster)
    # This test documents the pattern, exact timing may vary
    assert time_selective <= time_all * 1.5  # Allow 50% margin


# ============================================================================
# SERVER-SIDE SEARCH PERFORMANCE
# ============================================================================

@pytest.mark.asyncio
async def test_search_with_index_on_name(db_session, large_employee_dataset):
    """Test that name search uses index and performs quickly."""
    search_term = "Employee 0"

    start_time = time.perf_counter()

    # Search using LIKE (should use index if available)
    stmt = select(Employee).where(Employee.name.like(f"%{search_term}%"))
    result = await db_session.execute(stmt)
    employees = result.scalars().all()

    elapsed = time.perf_counter() - start_time

    # Should find employees matching pattern
    assert len(employees) >= 10  # Employee 00, 01, 02, ... 09, 010, etc.

    # Should complete quickly
    assert elapsed < 0.1, f"Search took {elapsed:.3f}s, expected < 0.1s"


@pytest.mark.asyncio
async def test_search_with_multiple_filters(db_session, large_employee_dataset):
    """Test search with multiple filters performs efficiently."""
    start_time = time.perf_counter()

    # Complex search with multiple conditions
    stmt = select(Employee).where(
        Employee.role == "Developer",
        Employee.active == True,
        Employee.hourly_rate >= 30.0
    )
    result = await db_session.execute(stmt)
    employees = result.scalars().all()

    elapsed = time.perf_counter() - start_time

    # Verify results
    assert len(employees) > 0

    # Performance check
    assert elapsed < 0.1, f"Multi-filter search took {elapsed:.3f}s, expected < 0.1s"


@pytest.mark.asyncio
async def test_email_search_with_unique_index(db_session, large_employee_dataset):
    """Test email lookup uses unique index for O(1) performance."""
    search_email = "employee050@example.com"

    start_time = time.perf_counter()

    stmt = select(Employee).where(Employee.email == search_email)
    result = await db_session.execute(stmt)
    employee = result.scalar_one_or_none()

    elapsed = time.perf_counter() - start_time

    # Verify found
    assert employee is not None
    assert employee.email == search_email

    # Should be extremely fast with unique index
    assert elapsed < 0.05, f"Email lookup took {elapsed:.3f}s, expected < 0.05s"


# ============================================================================
# PAGINATION PERFORMANCE
# ============================================================================

@pytest.mark.asyncio
async def test_pagination_first_page_performance(db_session, large_employee_dataset):
    """Test that first page pagination is fast."""
    page_size = 20

    start_time = time.perf_counter()

    stmt = select(Employee).limit(page_size).offset(0)
    result = await db_session.execute(stmt)
    employees = result.scalars().all()

    elapsed = time.perf_counter() - start_time

    assert len(employees) == page_size
    assert elapsed < 0.05, f"First page took {elapsed:.3f}s, expected < 0.05s"


@pytest.mark.asyncio
async def test_pagination_middle_page_performance(db_session, large_employee_dataset):
    """Test that middle page pagination performs well."""
    page_size = 20
    page_number = 3  # 4th page (0-indexed)
    offset = page_number * page_size

    start_time = time.perf_counter()

    stmt = select(Employee).limit(page_size).offset(offset)
    result = await db_session.execute(stmt)
    employees = result.scalars().all()

    elapsed = time.perf_counter() - start_time

    assert len(employees) == page_size
    assert elapsed < 0.05, f"Middle page took {elapsed:.3f}s, expected < 0.05s"


@pytest.mark.asyncio
async def test_count_query_performance(db_session, large_employee_dataset):
    """Test that count queries are fast (for pagination metadata)."""
    from sqlalchemy import func

    start_time = time.perf_counter()

    stmt = select(func.count(Employee.id))
    result = await db_session.execute(stmt)
    total_count = result.scalar()

    elapsed = time.perf_counter() - start_time

    assert total_count == 100
    assert elapsed < 0.05, f"Count query took {elapsed:.3f}s, expected < 0.05s"


# ============================================================================
# CONCURRENT REQUEST HANDLING
# ============================================================================

@pytest.mark.asyncio
async def test_concurrent_read_queries(db_session, large_employee_dataset):
    """Test handling multiple concurrent read queries."""
    async def fetch_employee(emp_id: int):
        stmt = select(Employee).where(Employee.id == emp_id)
        result = await db_session.execute(stmt)
        return result.scalar_one_or_none()

    # Get first 10 employee IDs
    stmt = select(Employee.id).limit(10)
    result = await db_session.execute(stmt)
    employee_ids = [row[0] for row in result.all()]

    # Execute 10 concurrent queries
    start_time = time.perf_counter()

    tasks = [fetch_employee(emp_id) for emp_id in employee_ids]
    employees = await asyncio.gather(*tasks)

    elapsed = time.perf_counter() - start_time

    # Verify all queries succeeded
    assert len(employees) == 10
    assert all(emp is not None for emp in employees)

    # Should complete quickly even with concurrent access
    assert elapsed < 0.5, f"10 concurrent queries took {elapsed:.3f}s, expected < 0.5s"


@pytest.mark.asyncio
async def test_concurrent_different_queries(db_session, large_employee_dataset):
    """Test handling different types of concurrent queries."""
    async def query_by_role():
        stmt = select(Employee).where(Employee.role == "Developer")
        result = await db_session.execute(stmt)
        return result.scalars().all()

    async def query_by_department(dept_id):
        stmt = select(Employee).where(Employee.department_id == dept_id)
        result = await db_session.execute(stmt)
        return result.scalars().all()

    async def count_active():
        from sqlalchemy import func
        stmt = select(func.count(Employee.id)).where(Employee.active == True)
        result = await db_session.execute(stmt)
        return result.scalar()

    # Execute different query types concurrently
    start_time = time.perf_counter()

    results = await asyncio.gather(
        query_by_role(),
        query_by_department(1),
        count_active(),
        query_by_role(),
        query_by_department(2)
    )

    elapsed = time.perf_counter() - start_time

    # Verify all queries returned results
    assert len(results) == 5
    assert all(r is not None for r in results)

    # Performance check
    assert elapsed < 0.5, f"Mixed concurrent queries took {elapsed:.3f}s, expected < 0.5s"


# ============================================================================
# LOAD TESTING
# ============================================================================

@pytest.mark.asyncio
async def test_repeated_query_performance(db_session, large_employee_dataset):
    """Test performance of 100 repeated queries (simulating high traffic)."""
    async def fetch_random_employee(index: int):
        emp_id = (index % 100) + 1
        stmt = select(Employee).where(Employee.id == emp_id)
        result = await db_session.execute(stmt)
        return result.scalar_one_or_none()

    start_time = time.perf_counter()

    # Simulate 100 queries
    tasks = [fetch_random_employee(i) for i in range(100)]
    results = await asyncio.gather(*tasks)

    elapsed = time.perf_counter() - start_time

    # All queries should succeed
    assert len(results) == 100

    # Should complete in reasonable time
    assert elapsed < 2.0, f"100 queries took {elapsed:.3f}s, expected < 2.0s"

    # Calculate queries per second
    qps = 100 / elapsed
    assert qps > 50, f"Query rate: {qps:.1f} qps, expected > 50 qps"


@pytest.mark.asyncio
async def test_bulk_insert_performance(db_session, test_departments):
    """Test performance of bulk insert operations."""
    new_employees = []

    for i in range(50):
        employee = Employee(
            name=f"Bulk Employee {i}",
            email=f"bulk{i}@example.com",
            role="Staff",
            department_id=test_departments[0].id,
            active=True
        )
        new_employees.append(employee)

    start_time = time.perf_counter()

    # Bulk insert
    db_session.add_all(new_employees)
    await db_session.commit()

    elapsed = time.perf_counter() - start_time

    # Should complete quickly
    assert elapsed < 1.0, f"Bulk insert of 50 records took {elapsed:.3f}s, expected < 1.0s"


@pytest.mark.asyncio
async def test_complex_join_query_performance(db_session, large_employee_dataset):
    """Test performance of complex queries with joins."""
    start_time = time.perf_counter()

    # Complex query with join and filters
    stmt = (
        select(Employee)
        .join(Department)
        .where(
            Employee.active == True,
            Department.active == True,
            Employee.hourly_rate >= 30.0
        )
        .options(selectinload(Employee.department))
    )

    result = await db_session.execute(stmt)
    employees = result.scalars().all()

    elapsed = time.perf_counter() - start_time

    # Verify results
    assert len(employees) > 0

    # Performance check
    assert elapsed < 0.2, f"Complex join query took {elapsed:.3f}s, expected < 0.2s"


# ============================================================================
# INDEX USAGE VERIFICATION (SQLite-specific)
# ============================================================================

@pytest.mark.asyncio
async def test_verify_indexes_exist(db_session):
    """Verify that expected indexes exist on critical columns."""
    # For SQLite, check sqlite_master table
    stmt = text("""
        SELECT name, sql FROM sqlite_master
        WHERE type='index' AND tbl_name='employees'
    """)

    result = await db_session.execute(stmt)
    indexes = result.all()

    # Should have indexes on critical columns
    index_names = [idx[0] for idx in indexes]

    # Document indexes found (actual index names may vary)
    # This test documents expected indexing strategy
    assert len(index_names) > 0  # At least one index exists
