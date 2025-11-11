"""
Script to run database migrations
"""

import asyncio
import sys
from pathlib import Path

# Add the parent directory to the path so we can import from src
sys.path.append(str(Path(__file__).parent.parent))

from alembic import command
from alembic.config import Config

from src.database import DatabaseManager, create_tables


async def run_migrations():
    """Run Alembic migrations"""
    print("🔄 Running database migrations...")

    # Check database health first
    if await DatabaseManager.health_check():
        print("✅ Database connection verified")

        # Run Alembic migrations
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        print("✅ Migrations completed successfully")

    else:
        print("❌ Database connection failed")
        print("📋 Creating tables directly...")
        await create_tables()
        print("✅ Tables created successfully")


async def main():
    """Main function"""
    try:
        await run_migrations()
        print("🎉 Database setup completed!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
