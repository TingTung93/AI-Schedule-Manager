"""
Tests for Account Status Management API

Tests account status changes (active/inactive, locked/unlocked, verified/unverified)
and audit trail tracking.
"""

import pytest
from fastapi import status
from sqlalchemy import select

from src.auth.models import User
from src.models.account_status_history import AccountStatusHistory


class TestAccountStatusManagement:
    """Test suite for account status management endpoints."""

    @pytest.mark.asyncio
    async def test_activate_inactive_account(self, client, admin_token, db_session):
        """Test activating an inactive account."""
        # Create inactive employee
        employee = User(
            email="inactive@test.com",
            password_hash="hash",
            first_name="Inactive",
            last_name="User",
            is_active=False
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Activate account
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "active", "reason": "Account approved"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] is True

        # Verify history was created
        result = await db_session.execute(
            select(AccountStatusHistory).where(
                AccountStatusHistory.user_id == employee.id
            )
        )
        history = result.scalar_one()
        assert history.old_status == "inactive"
        assert history.new_status == "active"
        assert history.reason == "Account approved"

    @pytest.mark.asyncio
    async def test_deactivate_account_requires_reason(self, client, admin_token, db_session):
        """Test that deactivating requires a reason."""
        # Create active employee
        employee = User(
            email="active@test.com",
            password_hash="hash",
            first_name="Active",
            last_name="User",
            is_active=True
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Try to deactivate without reason - should fail
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "inactive"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Deactivate with reason - should succeed
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "inactive", "reason": "Employee resigned"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] is False

    @pytest.mark.asyncio
    async def test_lock_account(self, client, admin_token, db_session):
        """Test locking an account."""
        # Create active employee
        employee = User(
            email="locked@test.com",
            password_hash="hash",
            first_name="Locked",
            last_name="User",
            is_active=True,
            is_locked=False
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Lock account
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "locked", "reason": "Security breach suspected"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_locked"] is True

    @pytest.mark.asyncio
    async def test_unlock_account_resets_failed_attempts(self, client, admin_token, db_session):
        """Test unlocking resets failed login attempts."""
        # Create locked employee with failed attempts
        employee = User(
            email="unlock@test.com",
            password_hash="hash",
            first_name="Unlock",
            last_name="User",
            is_active=True,
            is_locked=True,
            failed_login_attempts=5
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Unlock account
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "unlocked", "reason": "User identity verified"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify failed attempts were reset
        await db_session.refresh(employee)
        assert employee.is_locked is False
        assert employee.failed_login_attempts == 0
        assert employee.account_locked_until is None

    @pytest.mark.asyncio
    async def test_verify_account(self, client, admin_token, db_session):
        """Test marking account as verified."""
        # Create unverified employee
        employee = User(
            email="verify@test.com",
            password_hash="hash",
            first_name="Verify",
            last_name="User",
            is_verified=False
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Verify account
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "verified", "reason": "Email verified"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_verified"] is True

    @pytest.mark.asyncio
    async def test_cannot_modify_own_status(self, client, admin_token, admin_user, db_session):
        """Test that admin cannot modify their own account status."""
        response = client.patch(
            f"/api/employees/{admin_user.id}/status",
            json={"status": "inactive", "reason": "Testing"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "own account status" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_non_admin_cannot_change_status(self, client, user_token, db_session):
        """Test that non-admin users cannot change status."""
        # Create employee
        employee = User(
            email="employee@test.com",
            password_hash="hash",
            first_name="Employee",
            last_name="User"
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Try to change status as regular user
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "inactive", "reason": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_invalid_status_action(self, client, admin_token, db_session):
        """Test that invalid status actions are rejected."""
        # Create employee
        employee = User(
            email="invalid@test.com",
            password_hash="hash",
            first_name="Invalid",
            last_name="User"
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Try invalid status
        response = client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "deleted", "reason": "Test"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_get_status_history(self, client, admin_token, db_session):
        """Test retrieving account status history."""
        # Create employee
        employee = User(
            email="history@test.com",
            password_hash="hash",
            first_name="History",
            last_name="User",
            is_active=False
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Activate account
        client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "active", "reason": "Approved"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Lock account
        client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "locked", "reason": "Security"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Get history
        response = client.get(
            f"/api/employees/{employee.id}/status-history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

        # Verify history order (newest first)
        assert data["items"][0]["new_status"] == "locked"
        assert data["items"][1]["new_status"] == "active"

    @pytest.mark.asyncio
    async def test_status_history_pagination(self, client, admin_token, admin_user, db_session):
        """Test pagination of status history."""
        # Create employee
        employee = User(
            email="pagination@test.com",
            password_hash="hash",
            first_name="Pagination",
            last_name="User"
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Create multiple history records manually
        for i in range(5):
            history = AccountStatusHistory(
                user_id=employee.id,
                old_status="active",
                new_status="inactive",
                changed_by_id=admin_user.id,
                reason=f"Change {i}"
            )
            db_session.add(history)
        await db_session.commit()

        # Get first page
        response = client.get(
            f"/api/employees/{employee.id}/status-history?skip=0&limit=2",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["skip"] == 0
        assert data["limit"] == 2

    @pytest.mark.asyncio
    async def test_user_can_view_own_status_history(self, client, user_token, test_user):
        """Test that users can view their own status history."""
        response = client.get(
            f"/api/employees/{test_user.id}/status-history",
            headers={"Authorization": f"Bearer {user_token}"}
        )

        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    async def test_user_cannot_view_others_status_history(self, client, user_token, db_session):
        """Test that users cannot view others' status history."""
        # Create another employee
        employee = User(
            email="other@test.com",
            password_hash="hash",
            first_name="Other",
            last_name="User"
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        response = client.get(
            f"/api/employees/{employee.id}/status-history",
            headers={"Authorization": f"Bearer {user_token}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_status_history_includes_metadata(self, client, admin_token, admin_user, db_session):
        """Test that status history includes metadata."""
        # Create employee
        employee = User(
            email="metadata@test.com",
            password_hash="hash",
            first_name="Metadata",
            last_name="User"
        )
        db_session.add(employee)
        await db_session.commit()
        await db_session.refresh(employee)

        # Change status
        client.patch(
            f"/api/employees/{employee.id}/status",
            json={"status": "inactive", "reason": "Test with metadata"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Get history
        response = client.get(
            f"/api/employees/{employee.id}/status-history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) > 0

        history_item = data["items"][0]
        assert "metadata_json" in history_item
        assert history_item["metadata_json"]["action"] == "status_change"
        assert "api_endpoint" in history_item["metadata_json"]
