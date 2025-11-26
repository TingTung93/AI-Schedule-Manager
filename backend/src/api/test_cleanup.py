"""
Test Cleanup Routes (FastAPI)

Provides endpoints for cleaning up test data in non-production environments.
ONLY AVAILABLE IN TEST MODE!
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_database_session

# Create router
router = APIRouter(prefix="/api/test", tags=["test"])
logger = logging.getLogger(__name__)

# Only enable test routes in test/development environments
# Check ENVIRONMENT (used by FastAPI) in addition to FLASK_ENV
TEST_MODE = (
    os.getenv("FLASK_ENV") in ["development", "testing"] or
    os.getenv("ENVIRONMENT") in ["development", "testing"] or
    os.getenv("ENABLE_TEST_ROUTES") == "true"
)


@router.delete("/cleanup")
async def cleanup_test_data(session: AsyncSession = Depends(get_database_session)):
    """
    Clean up test data from database

    Deletes all users and employees with @test.com email addresses.
    Only works in test/development mode.
    """
    if not TEST_MODE:
        raise HTTPException(status_code=403, detail="Test routes are disabled in production")

    try:
        # Delete test users from users table
        result_users = await session.execute(
            text("DELETE FROM users WHERE email LIKE '%test.com'")
        )
        users_deleted = result_users.rowcount

        # Delete test employees from employees table
        result_employees = await session.execute(
            text("DELETE FROM employees WHERE email LIKE '%test.com'")
        )
        employees_deleted = result_employees.rowcount

        await session.commit()

        logger.info(f"Test cleanup: Deleted {users_deleted} users and {employees_deleted} employees")

        return {
            "message": "Test data cleaned up successfully",
            "users_deleted": users_deleted,
            "employees_deleted": employees_deleted
        }

    except Exception as e:
        logger.error(f"Test cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


@router.get("/health")
async def test_health():
    """Check if test routes are enabled"""
    return {
        "test_routes_enabled": TEST_MODE,
        "environment": os.getenv("FLASK_ENV", "production")
    }
