#!/usr/bin/env python3
"""
Test Database Connection
Run with: python scripts/test-database.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "backend" / "src"
sys.path.insert(0, str(backend_src))

from database import engine, AsyncSessionLocal
from sqlalchemy import text


async def test_database_connection():
    """Test database connection and display info"""

    print("=" * 60)
    print("Database Connection Test")
    print("=" * 60)
    print()

    try:
        # Test connection
        print("🔌 Testing database connection...")
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected to PostgreSQL")
            print(f"   Version: {version}")

        print()

        # Test session
        print("🧪 Testing session management...")
        async with AsyncSessionLocal() as session:
            # Test users table
            result = await session.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"✅ Users table accessible")
            print(f"   Users count: {user_count}")

            # Test schedules table
            result = await session.execute(text("SELECT COUNT(*) FROM schedules"))
            schedule_count = result.scalar()
            print(f"✅ Schedules table accessible")
            print(f"   Schedules count: {schedule_count}")

            # Test departments table
            result = await session.execute(text("SELECT COUNT(*) FROM departments"))
            dept_count = result.scalar()
            print(f"✅ Departments table accessible")
            print(f"   Departments count: {dept_count}")

            # Test employees table
            result = await session.execute(text("SELECT COUNT(*) FROM employees"))
            emp_count = result.scalar()
            print(f"✅ Employees table accessible")
            print(f"   Employees count: {emp_count}")

        print()

        # List all tables
        print("📋 Database tables:")
        async with engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = result.fetchall()
            for table in tables:
                print(f"   - {table[0]}")

        print()

        # Check indexes
        print("📊 Performance indexes:")
        async with engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT
                    tablename,
                    indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                ORDER BY tablename, indexname
            """))
            indexes = result.fetchall()

            current_table = None
            for table, index in indexes:
                if table != current_table:
                    print(f"\n   {table}:")
                    current_table = table
                print(f"      - {index}")

        print()
        print("=" * 60)
        print("✅ All database tests passed!")
        print("=" * 60)

    except Exception as e:
        print()
        print("=" * 60)
        print(f"❌ Database test failed!")
        print("=" * 60)
        print(f"\nError: {e}")
        print()
        print("Troubleshooting:")
        print("1. Check if PostgreSQL is running:")
        print("   sudo service postgresql status")
        print()
        print("2. Verify DATABASE_URL in backend/.env")
        print()
        print("3. Ensure migrations are applied:")
        print("   cd backend && alembic upgrade head")
        print()
        sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_database_connection())
