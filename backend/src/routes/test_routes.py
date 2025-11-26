"""
Test Cleanup Routes

Provides endpoints for cleaning up test data in non-production environments.
ONLY AVAILABLE IN TEST MODE!
"""

import logging
import os

from flask import Blueprint, jsonify, request
from sqlalchemy import text

from ..database import get_db_session

# Create blueprint
test_bp = Blueprint("test", __name__, url_prefix="/api/test")
logger = logging.getLogger(__name__)

# Only enable test routes in test/development environments
TEST_MODE = os.getenv("FLASK_ENV") in ["development", "testing"] or os.getenv("ENABLE_TEST_ROUTES") == "true"


@test_bp.route("/cleanup", methods=["DELETE"])
def cleanup_test_data():
    """
    Clean up test data from database

    Deletes all users and employees with @test.com email addresses.
    Only works in test/development mode.
    """
    if not TEST_MODE:
        return jsonify({"error": "Test routes are disabled in production"}), 403

    try:
        session = get_db_session()

        # Delete test users from users table
        result_users = session.execute(
            text("DELETE FROM users WHERE email LIKE '%test.com'")
        )
        users_deleted = result_users.rowcount

        # Delete test employees from employees table
        result_employees = session.execute(
            text("DELETE FROM employees WHERE email LIKE '%test.com'")
        )
        employees_deleted = result_employees.rowcount

        session.commit()
        session.close()

        logger.info(f"Test cleanup: Deleted {users_deleted} users and {employees_deleted} employees")

        return jsonify({
            "message": "Test data cleaned up successfully",
            "users_deleted": users_deleted,
            "employees_deleted": employees_deleted
        }), 200

    except Exception as e:
        logger.error(f"Test cleanup failed: {e}")
        return jsonify({"error": "Cleanup failed", "message": str(e)}), 500


@test_bp.route("/health", methods=["GET"])
def test_health():
    """Check if test routes are enabled"""
    return jsonify({
        "test_routes_enabled": TEST_MODE,
        "environment": os.getenv("FLASK_ENV", "production")
    }), 200
