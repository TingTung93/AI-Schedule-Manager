"""
Comprehensive tests for authentication routes.
Tests password reset, token validation, registration, login, and security features.

Coverage target: >85%
"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, status
from httpx import AsyncClient

from backend.src.auth.auth import auth_service
from backend.src.models.user import User


class TestRegistration:
    """Test user registration endpoints."""

    @pytest.mark.asyncio
    async def test_register_new_user_success(self, client: AsyncClient, db_session):
        """Test successful user registration."""
        payload = {
            "email": "newuser@test.com",
            "password": "SecurePass123!",
            "first_name": "New",
            "last_name": "User"
        }

        response = await client.post("/api/auth/register", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == payload["email"]
        assert "password" not in data
        assert "id" in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, existing_user):
        """Test registration with existing email fails."""
        payload = {
            "email": existing_user.email,
            "password": "NewPass123!",
            "first_name": "Duplicate",
            "last_name": "User"
        }

        response = await client.post("/api/auth/register", json=payload)

        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_missing_required_fields(self, client: AsyncClient):
        """Test registration fails with missing fields."""
        payload = {
            "email": "incomplete@test.com",
            # Missing password, first_name, last_name
        }

        response = await client.post("/api/auth/register", json=payload)

        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("password" in str(e).lower() for e in errors)

    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient):
        """Test registration fails with weak password."""
        payload = {
            "email": "weakpass@test.com",
            "password": "123",  # Too short
            "first_name": "Weak",
            "last_name": "Password"
        }

        response = await client.post("/api/auth/register", json=payload)

        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_register_invalid_email_format(self, client: AsyncClient):
        """Test registration fails with invalid email."""
        payload = {
            "email": "not-an-email",
            "password": "SecurePass123!",
            "first_name": "Invalid",
            "last_name": "Email"
        }

        response = await client.post("/api/auth/register", json=payload)

        assert response.status_code == 422


class TestLogin:
    """Test login functionality."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, existing_user):
        """Test successful login returns tokens."""
        payload = {
            "email": existing_user.email,
            "password": "TestPassword123!"
        }

        response = await client.post("/api/auth/login", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_incorrect_password(self, client: AsyncClient, existing_user):
        """Test login fails with wrong password."""
        payload = {
            "email": existing_user.email,
            "password": "WrongPassword123!"
        }

        response = await client.post("/api/auth/login", json=payload)

        assert response.status_code == 401
        assert "credentials" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login fails for non-existent user."""
        payload = {
            "email": "nonexistent@test.com",
            "password": "AnyPassword123!"
        }

        response = await client.post("/api/auth/login", json=payload)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_inactive_user(self, client: AsyncClient, db_session):
        """Test login fails for inactive users."""
        inactive_user = User(
            email="inactive@test.com",
            password_hash=auth_service.hash_password("TestPass123!"),
            first_name="Inactive",
            last_name="User",
            is_active=False
        )
        db_session.add(inactive_user)
        await db_session.commit()

        payload = {
            "email": inactive_user.email,
            "password": "TestPass123!"
        }

        response = await client.post("/api/auth/login", json=payload)

        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()


class TestPasswordReset:
    """Test password reset functionality."""

    @pytest.mark.asyncio
    async def test_request_password_reset(self, client: AsyncClient, existing_user):
        """Test password reset request sends email."""
        payload = {"email": existing_user.email}

        with patch('backend.src.services.email.email_service.send_email') as mock_email:
            response = await client.post("/api/auth/password-reset/request", json=payload)

        assert response.status_code == 200
        assert "email sent" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_request_password_reset_nonexistent_email(self, client: AsyncClient):
        """Test password reset for non-existent email doesn't reveal user existence."""
        payload = {"email": "nonexistent@test.com"}

        response = await client.post("/api/auth/password-reset/request", json=payload)

        # Should return 200 to prevent user enumeration
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_verify_reset_token_valid(self, client: AsyncClient, existing_user):
        """Test valid reset token verification."""
        reset_token = auth_service.create_password_reset_token(existing_user.id)

        response = await client.get(f"/api/auth/password-reset/verify/{reset_token}")

        assert response.status_code == 200
        assert response.json()["valid"] is True

    @pytest.mark.asyncio
    async def test_verify_reset_token_invalid(self, client: AsyncClient):
        """Test invalid reset token verification."""
        invalid_token = "invalid.token.here"

        response = await client.get(f"/api/auth/password-reset/verify/{invalid_token}")

        assert response.status_code in [400, 401]
        assert response.json()["valid"] is False

    @pytest.mark.asyncio
    async def test_verify_reset_token_expired(self, client: AsyncClient, existing_user):
        """Test expired reset token verification."""
        # Create token that expired 1 hour ago
        with patch('backend.src.auth.auth.datetime') as mock_datetime:
            mock_datetime.now.return_value = datetime.now(timezone.utc) - timedelta(hours=2)
            expired_token = auth_service.create_password_reset_token(existing_user.id)

        response = await client.get(f"/api/auth/password-reset/verify/{expired_token}")

        assert response.status_code in [400, 401]
        assert "expired" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_reset_password_with_valid_token(self, client: AsyncClient, existing_user):
        """Test password reset with valid token."""
        reset_token = auth_service.create_password_reset_token(existing_user.id)
        new_password = "NewSecurePass123!"

        payload = {
            "token": reset_token,
            "new_password": new_password
        }

        response = await client.post("/api/auth/password-reset/confirm", json=payload)

        assert response.status_code == 200
        assert "success" in response.json()["message"].lower()

        # Verify can login with new password
        login_response = await client.post("/api/auth/login", json={
            "email": existing_user.email,
            "password": new_password
        })
        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_reset_password_with_invalid_token(self, client: AsyncClient):
        """Test password reset fails with invalid token."""
        payload = {
            "token": "invalid.token.here",
            "new_password": "NewSecurePass123!"
        }

        response = await client.post("/api/auth/password-reset/confirm", json=payload)

        assert response.status_code in [400, 401]


class TestTokenValidation:
    """Test token validation and refresh."""

    @pytest.mark.asyncio
    async def test_validate_access_token(self, client: AsyncClient, auth_headers):
        """Test access token validation."""
        response = await client.get("/api/auth/validate", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "exp" in data

    @pytest.mark.asyncio
    async def test_validate_invalid_token(self, client: AsyncClient):
        """Test validation fails with invalid token."""
        headers = {"Authorization": "Bearer invalid.token.here"}

        response = await client.get("/api/auth/validate", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_validate_expired_token(self, client: AsyncClient, existing_user):
        """Test validation fails with expired token."""
        # Create token that expired
        with patch('backend.src.auth.auth.datetime') as mock_datetime:
            mock_datetime.now.return_value = datetime.now(timezone.utc) - timedelta(hours=2)
            expired_token = auth_service.create_access_token({"sub": str(existing_user.id)})

        headers = {"Authorization": f"Bearer {expired_token}"}
        response = await client.get("/api/auth/validate", headers=headers)

        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_refresh_access_token(self, client: AsyncClient, existing_user):
        """Test refreshing access token with refresh token."""
        # Get initial tokens
        login_response = await client.post("/api/auth/login", json={
            "email": existing_user.email,
            "password": "TestPassword123!"
        })
        refresh_token = login_response.json()["refresh_token"]

        # Refresh
        response = await client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] != login_response.json()["access_token"]

    @pytest.mark.asyncio
    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        """Test refresh fails with invalid refresh token."""
        response = await client.post("/api/auth/refresh", json={
            "refresh_token": "invalid.refresh.token"
        })

        assert response.status_code == 401


class TestAccountSecurity:
    """Test account security features."""

    @pytest.mark.asyncio
    async def test_change_password_authenticated(self, client: AsyncClient, auth_headers, existing_user):
        """Test password change for authenticated user."""
        payload = {
            "current_password": "TestPassword123!",
            "new_password": "NewSecurePass456!"
        }

        response = await client.post("/api/auth/change-password",
                                    json=payload,
                                    headers=auth_headers)

        assert response.status_code == 200

        # Verify can login with new password
        login_response = await client.post("/api/auth/login", json={
            "email": existing_user.email,
            "password": "NewSecurePass456!"
        })
        assert login_response.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client: AsyncClient, auth_headers):
        """Test password change fails with wrong current password."""
        payload = {
            "current_password": "WrongPassword123!",
            "new_password": "NewSecurePass456!"
        }

        response = await client.post("/api/auth/change-password",
                                    json=payload,
                                    headers=auth_headers)

        assert response.status_code == 400
        assert "current password" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_logout_invalidates_token(self, client: AsyncClient, auth_headers):
        """Test logout invalidates the access token."""
        # Logout
        response = await client.post("/api/auth/logout", headers=auth_headers)
        assert response.status_code == 200

        # Try to use same token
        validate_response = await client.get("/api/auth/validate", headers=auth_headers)
        assert validate_response.status_code == 401

    @pytest.mark.asyncio
    async def test_rate_limiting_login_attempts(self, client: AsyncClient):
        """Test rate limiting on login attempts."""
        payload = {
            "email": "test@test.com",
            "password": "WrongPassword123!"
        }

        # Make multiple failed login attempts
        responses = []
        for _ in range(10):
            response = await client.post("/api/auth/login", json=payload)
            responses.append(response.status_code)

        # Should eventually get rate limited
        assert 429 in responses  # Too Many Requests

    @pytest.mark.asyncio
    async def test_account_lockout_after_failed_attempts(self, client: AsyncClient, existing_user):
        """Test account lockout after multiple failed login attempts."""
        payload = {
            "email": existing_user.email,
            "password": "WrongPassword123!"
        }

        # Make 5+ failed attempts
        for _ in range(6):
            await client.post("/api/auth/login", json=payload)

        # Next attempt should be locked
        response = await client.post("/api/auth/login", json={
            "email": existing_user.email,
            "password": "TestPassword123!"  # Even correct password
        })

        assert response.status_code == 403
        assert "locked" in response.json()["detail"].lower()


class TestEmailVerification:
    """Test email verification flow."""

    @pytest.mark.asyncio
    async def test_send_verification_email(self, client: AsyncClient, existing_user):
        """Test sending verification email."""
        with patch('backend.src.services.email.email_service.send_email') as mock_email:
            response = await client.post(f"/api/auth/verify-email/send/{existing_user.id}")

        assert response.status_code == 200
        mock_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_email_with_valid_token(self, client: AsyncClient, existing_user):
        """Test email verification with valid token."""
        verify_token = auth_service.create_email_verification_token(existing_user.id)

        response = await client.get(f"/api/auth/verify-email/{verify_token}")

        assert response.status_code == 200
        assert "verified" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_verify_email_with_invalid_token(self, client: AsyncClient):
        """Test email verification fails with invalid token."""
        response = await client.get("/api/auth/verify-email/invalid.token")

        assert response.status_code == 400


class TestTwoFactorAuthentication:
    """Test 2FA setup and validation."""

    @pytest.mark.asyncio
    async def test_enable_2fa(self, client: AsyncClient, auth_headers):
        """Test enabling 2FA for user."""
        response = await client.post("/api/auth/2fa/enable", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "qr_code" in data

    @pytest.mark.asyncio
    async def test_verify_2fa_code(self, client: AsyncClient, auth_headers):
        """Test verifying 2FA code."""
        # First enable 2FA
        enable_response = await client.post("/api/auth/2fa/enable", headers=auth_headers)
        secret = enable_response.json()["secret"]

        # Generate valid TOTP code
        import pyotp
        totp = pyotp.TOTP(secret)
        valid_code = totp.now()

        response = await client.post("/api/auth/2fa/verify",
                                    json={"code": valid_code},
                                    headers=auth_headers)

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_disable_2fa(self, client: AsyncClient, auth_headers):
        """Test disabling 2FA."""
        response = await client.post("/api/auth/2fa/disable", headers=auth_headers)

        assert response.status_code == 200
        assert "disabled" in response.json()["message"].lower()
