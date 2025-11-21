#!/usr/bin/env python3
"""
Create Initial Admin User
Run with: python scripts/create-admin-user.py
"""

import asyncio
import sys
import os
from getpass import getpass
from pathlib import Path

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "backend" / "src"
sys.path.insert(0, str(backend_src))

from database import AsyncSessionLocal, engine
from models import User
from auth.password import hash_password


async def create_admin_user():
    """Create an admin user interactively"""

    print("=" * 60)
    print("Create Initial Admin User")
    print("=" * 60)
    print()

    # Get user input
    email = input("Admin email: ").strip()
    if not email:
        print("❌ Email is required!")
        return

    full_name = input("Full name: ").strip()
    if not full_name:
        print("❌ Full name is required!")
        return

    password = getpass("Password: ")
    if not password:
        print("❌ Password is required!")
        return

    password_confirm = getpass("Confirm password: ")
    if password != password_confirm:
        print("❌ Passwords do not match!")
        return

    if len(password) < 8:
        print("❌ Password must be at least 8 characters!")
        return

    print()
    print("Creating admin user...")

    async with AsyncSessionLocal() as db:
        try:
            # Check if user already exists
            from sqlalchemy import select
            result = await db.execute(
                select(User).where(User.email == email)
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"❌ User with email '{email}' already exists!")
                return

            # Create admin user
            admin = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=full_name,
                role="admin",
                is_active=True
            )

            db.add(admin)
            await db.commit()
            await db.refresh(admin)

            print()
            print("✅ Admin user created successfully!")
            print()
            print(f"User ID: {admin.id}")
            print(f"Email: {admin.email}")
            print(f"Name: {admin.full_name}")
            print(f"Role: {admin.role}")
            print()
            print("You can now login with these credentials.")

        except Exception as e:
            print(f"❌ Error creating admin user: {e}")
            await db.rollback()
            raise
        finally:
            await engine.dispose()


async def create_default_admin():
    """Create default admin user (for automated setup)"""

    print("=" * 60)
    print("Creating Default Admin User")
    print("=" * 60)
    print()

    async with AsyncSessionLocal() as db:
        try:
            # Check if any admin exists
            from sqlalchemy import select
            result = await db.execute(
                select(User).where(User.role == "admin")
            )
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                print(f"✅ Admin user already exists: {existing_admin.email}")
                return

            # Create default admin
            admin = User(
                email="admin@example.com",
                hashed_password=hash_password("admin123"),
                full_name="System Administrator",
                role="admin",
                is_active=True
            )

            db.add(admin)
            await db.commit()
            await db.refresh(admin)

            print("✅ Default admin user created!")
            print()
            print("⚠️  IMPORTANT: Change these credentials immediately!")
            print(f"Email: {admin.email}")
            print("Password: admin123")
            print()

        except Exception as e:
            print(f"❌ Error creating admin user: {e}")
            await db.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Create admin user")
    parser.add_argument(
        "--default",
        action="store_true",
        help="Create default admin@example.com with password admin123"
    )

    args = parser.parse_args()

    if args.default:
        asyncio.run(create_default_admin())
    else:
        asyncio.run(create_admin_user())
