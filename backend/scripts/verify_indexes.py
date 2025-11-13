#!/usr/bin/env python3
"""
Verify Performance Indexes

This script verifies that the performance indexes from migration 004
have been created successfully and are being used by queries.
"""

import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Import database URL from settings
try:
    from src.core.config import settings
    DATABASE_URL = settings.DATABASE_URL
except ImportError:
    DATABASE_URL = "postgresql+asyncpg://postgres:password@localhost:5432/ai_schedule_manager"
    # Convert asyncpg to psycopg2 for this script
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


def verify_indexes(engine):
    """Verify that performance indexes exist."""

    expected_indexes = [
        'idx_assignment_lookup',
        'idx_shift_date_dept',
        'idx_schedule_week_range',
        'idx_employee_email'
    ]

    print("Checking for Performance Indexes...")
    print("=" * 60)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname IN :index_names
            ORDER BY indexname
        """), {"index_names": tuple(expected_indexes)})

        found_indexes = []
        for row in result:
            found_indexes.append(row.indexname)
            print(f"\n✓ {row.indexname}")
            print(f"  Table: {row.tablename}")
            print(f"  Definition: {row.indexdef}")

        # Check for missing indexes
        missing = set(expected_indexes) - set(found_indexes)
        if missing:
            print(f"\n✗ Missing indexes: {', '.join(missing)}")
            return False

        print(f"\n\n✓ All {len(expected_indexes)} performance indexes found!")
        return True


def check_index_usage(engine):
    """Check if indexes are being used."""

    print("\n\nIndex Usage Statistics:")
    print("=" * 60)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                schemaname,
                tablename,
                indexname,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size
            FROM pg_stat_user_indexes
            WHERE indexname LIKE 'idx_%'
            ORDER BY idx_scan DESC
        """))

        for row in result:
            print(f"\n{row.indexname}:")
            print(f"  Table: {row.tablename}")
            print(f"  Scans: {row.idx_scan}")
            print(f"  Tuples Read: {row.idx_tup_read}")
            print(f"  Size: {row.index_size}")


def analyze_query_plans(engine):
    """Analyze query plans to ensure indexes are being used."""

    print("\n\nQuery Plan Analysis:")
    print("=" * 60)

    test_queries = [
        {
            "name": "Assignment Lookup",
            "query": """
                EXPLAIN (FORMAT TEXT)
                SELECT * FROM schedule_assignments
                WHERE employee_id = 1 AND schedule_id = 1
            """,
            "expected_index": "idx_assignment_lookup"
        },
        {
            "name": "Shift by Date and Department",
            "query": """
                EXPLAIN (FORMAT TEXT)
                SELECT * FROM shifts
                WHERE date = '2025-11-13' AND department_id = 1
            """,
            "expected_index": "idx_shift_date_dept"
        },
        {
            "name": "Schedule Week Range",
            "query": """
                EXPLAIN (FORMAT TEXT)
                SELECT * FROM schedules
                WHERE week_start >= '2025-11-01' AND week_end <= '2025-11-30'
            """,
            "expected_index": "idx_schedule_week_range"
        },
        {
            "name": "Employee Email Lookup",
            "query": """
                EXPLAIN (FORMAT TEXT)
                SELECT * FROM employees
                WHERE email = 'test@example.com'
            """,
            "expected_index": "idx_employee_email"
        }
    ]

    with engine.connect() as conn:
        for test in test_queries:
            print(f"\n{test['name']}:")
            print("-" * 40)

            try:
                result = conn.execute(text(test["query"]))
                plan = "\n".join([row[0] for row in result])
                print(plan)

                # Check if expected index is mentioned in plan
                if test["expected_index"] in plan:
                    print(f"\n✓ Using {test['expected_index']}")
                else:
                    print(f"\n⚠ {test['expected_index']} not found in plan")

            except Exception as e:
                print(f"\n✗ Error analyzing query: {e}")


def main():
    """Main verification function."""

    print("\nPerformance Index Verification")
    print("=" * 60)
    print(f"Database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}\n")

    try:
        # Create engine
        engine = create_engine(DATABASE_URL)

        # Verify indexes exist
        indexes_exist = verify_indexes(engine)

        if not indexes_exist:
            print("\n✗ Migration may not have been applied yet.")
            print("Run: cd backend && alembic upgrade head")
            return 1

        # Check index usage
        check_index_usage(engine)

        # Analyze query plans
        analyze_query_plans(engine)

        print("\n\n✓ Verification complete!")
        print("\nRecommendations:")
        print("- Run ANALYZE on tables after migration to update statistics")
        print("- Monitor index usage over time")
        print("- Check query performance before/after migration")

        return 0

    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure PostgreSQL is running")
        print("2. Check database connection settings")
        print("3. Verify migration has been applied")
        return 1


if __name__ == "__main__":
    sys.exit(main())
