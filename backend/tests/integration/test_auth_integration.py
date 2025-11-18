"""
Integration tests for authentication system.

Tests cover:
- User registration flow with validation
- Login with JWT token generation
- Token refresh mechanism
- Logout and token revocation
- Invalid/expired token handling
- Password reset flow
- Account lockout after failed attempts
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
import json


class TestAuthenticationIntegration:
    """Integration tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_user_registration_complete_flow(self, client):
        """Test complete user registration with all required fields."""
        registration_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "firstName": "John",
            "lastName": "Doe"
        }

        response = await client.post("/api/auth/register", json=registration_data)

        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert "accessToken" in data
        assert data["user"]["email"] == registration_data["email"]
        assert data["user"]["firstName"] == registration_data["firstName"]
        assert "roles" in data["user"]
        assert "user" in data["user"]["roles"]

        # Check cookies are set
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    @pytest.mark.asyncio
    async def test_registration_duplicate_email(self, client):
        """Test registration fails with duplicate email."""
        user_data = {
            "email": "duplicate@example.com",
            "password": "SecurePassword123!",
            "firstName": "Jane",
            "lastName": "Smith"
        }

        # First registration succeeds
        response1 = await client.post("/api/auth/register", json=user_data)
        assert response1.status_code == 201

        # Second registration fails
        response2 = await client.post("/api/auth/register", json=user_data)
        assert response2.status_code == 409
        assert "already registered" in response2.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_registration_weak_password(self, client):
        """Test registration fails with weak password."""
        weak_passwords = [
            "short",  # Too short
            "alllowercase",  # No uppercase or numbers
            "ALLUPPERCASE",  # No lowercase or numbers
            "NoNumbers!",  # No numbers
            "12345678",  # No letters
        ]

        for password in weak_passwords:
            user_data = {
                "email": f"test{password}@example.com",
                "password": password,
                "firstName": "Test",
                "lastName": "User"
            }

            response = await client.post("/api/auth/register", json=user_data)
            assert response.status_code == 400
            assert "password" in response.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_registration_missing_fields(self, client):
        """Test registration fails with missing required fields."""
        incomplete_data = [
            {"email": "test@example.com", "password": "Pass123!"},  # Missing names
            {"firstName": "John", "lastName": "Doe", "password": "Pass123!"},  # Missing email
            {"email": "test@example.com", "firstName": "John", "lastName": "Doe"},  # Missing password
        ]

        for data in incomplete_data:
            response = await client.post("/api/auth/register", json=data)
            assert response.status_code == 400
            assert "missing" in response.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_login_with_valid_credentials(self, client):
        """Test successful login with JWT token generation."""
        # Register user first
        registration_data = {
            "email": "logintest@example.com",
            "password": "SecurePassword123!",
            "firstName": "Login",
            "lastName": "Test"
        }
        await client.post("/api/auth/register", json=registration_data)

        # Login
        login_data = {
            "email": "logintest@example.com",
            "password": "SecurePassword123!"
        }
        response = await client.post("/api/auth/login", json=login_data)

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "accessToken" in data
        assert data["user"]["email"] == login_data["email"]

        # Verify cookies
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

    @pytest.mark.asyncio
    async def test_login_with_invalid_credentials(self, client):
        """Test login fails with incorrect password."""
        # Register user
        registration_data = {
            "email": "invalidlogin@example.com",
            "password": "CorrectPassword123!",
            "firstName": "Invalid",
            "lastName": "Login"
        }
        await client.post("/api/auth/register", json=registration_data)

        # Try login with wrong password
        login_data = {
            "email": "invalidlogin@example.com",
            "password": "WrongPassword123!"
        }
        response = await client.post("/api/auth/login", json=login_data)

        assert response.status_code == 401
        assert "invalid credentials" in response.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        """Test login fails for non-existent user."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "SomePassword123!"
        }
        response = await client.post("/api/auth/login", json=login_data)

        assert response.status_code == 401
        assert "invalid credentials" in response.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_account_lockout_after_failed_attempts(self, client):
        """Test account locks after 5 failed login attempts."""
        # Register user
        registration_data = {
            "email": "lockout@example.com",
            "password": "CorrectPassword123!",
            "firstName": "Lockout",
            "lastName": "Test"
        }
        await client.post("/api/auth/register", json=registration_data)

        # Attempt 5 failed logins
        login_data = {
            "email": "lockout@example.com",
            "password": "WrongPassword!"
        }

        for i in range(5):
            response = await client.post("/api/auth/login", json=login_data)
            assert response.status_code == 401

        # 6th attempt should return locked status
        response = await client.post("/api/auth/login", json=login_data)
        assert response.status_code == 423  # Account locked
        assert "locked" in response.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_token_refresh_mechanism(self, client):
        """Test JWT token refresh using refresh token."""
        # Register and login
        registration_data = {
            "email": "refresh@example.com",
            "password": "SecurePassword123!",
            "firstName": "Refresh",
            "lastName": "Token"
        }
        await client.post("/api/auth/register", json=registration_data)

        login_response = await client.post(
            "/api/auth/login",
            json={"email": "refresh@example.com", "password": "SecurePassword123!"}
        )
        refresh_token = login_response.cookies.get("refresh_token")

        # Refresh the access token
        response = await client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": refresh_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "accessToken" in data
        assert "access_token" in response.cookies

    @pytest.mark.asyncio
    async def test_token_refresh_with_invalid_token(self, client):
        """Test token refresh fails with invalid refresh token."""
        response = await client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": "invalid-token-12345"}
        )

        assert response.status_code == 401
        assert "token" in response.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_logout_and_token_revocation(self, client):
        """Test logout revokes refresh token."""
        # Register and login
        registration_data = {
            "email": "logout@example.com",
            "password": "SecurePassword123!",
            "firstName": "Logout",
            "lastName": "Test"
        }
        await client.post("/api/auth/register", json=registration_data)

        login_response = await client.post(
            "/api/auth/login",
            json={"email": "logout@example.com", "password": "SecurePassword123!"}
        )

        access_token = login_response.cookies.get("access_token")
        refresh_token = login_response.cookies.get("refresh_token")

        # Logout
        logout_response = await client.post(
            "/api/auth/logout",
            cookies={"access_token": access_token, "refresh_token": refresh_token}
        )

        assert logout_response.status_code == 200

        # Verify tokens are cleared
        assert logout_response.cookies.get("access_token") == ""
        assert logout_response.cookies.get("refresh_token") == ""

        # Try to use refresh token after logout - should fail
        refresh_response = await client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": refresh_token}
        )
        assert refresh_response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_with_valid_token(self, client):
        """Test getting current user info with valid token."""
        # Register and login
        registration_data = {
            "email": "currentuser@example.com",
            "password": "SecurePassword123!",
            "firstName": "Current",
            "lastName": "User"
        }
        await client.post("/api/auth/register", json=registration_data)

        login_response = await client.post(
            "/api/auth/login",
            json={"email": "currentuser@example.com", "password": "SecurePassword123!"}
        )
        access_token = login_response.cookies.get("access_token")

        # Get current user
        response = await client.get(
            "/api/auth/me",
            cookies={"access_token": access_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "currentuser@example.com"
        assert data["user"]["firstName"] == "Current"

    @pytest.mark.asyncio
    async def test_get_current_user_with_invalid_token(self, client):
        """Test getting current user fails with invalid token."""
        response = await client.get(
            "/api/auth/me",
            cookies={"access_token": "invalid-token"}
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_without_token(self, client):
        """Test getting current user fails without token."""
        response = await client.get("/api/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_password_change_flow(self, client):
        """Test password change with current password verification."""
        # Register and login
        registration_data = {
            "email": "changepass@example.com",
            "password": "OldPassword123!",
            "firstName": "Change",
            "lastName": "Password"
        }
        await client.post("/api/auth/register", json=registration_data)

        login_response = await client.post(
            "/api/auth/login",
            json={"email": "changepass@example.com", "password": "OldPassword123!"}
        )
        access_token = login_response.cookies.get("access_token")

        # Get CSRF token
        csrf_response = await client.get(
            "/api/auth/csrf-token",
            cookies={"access_token": access_token}
        )
        csrf_token = csrf_response.json()["csrfToken"]

        # Change password
        change_response = await client.post(
            "/api/auth/change-password",
            json={
                "currentPassword": "OldPassword123!",
                "newPassword": "NewPassword123!"
            },
            cookies={"access_token": access_token},
            headers={"X-CSRF-Token": csrf_token}
        )

        assert change_response.status_code == 200

        # Verify can login with new password
        new_login = await client.post(
            "/api/auth/login",
            json={"email": "changepass@example.com", "password": "NewPassword123!"}
        )
        assert new_login.status_code == 200

    @pytest.mark.asyncio
    async def test_forgot_password_request(self, client):
        """Test password reset request generation."""
        # Register user
        registration_data = {
            "email": "forgot@example.com",
            "password": "SecurePassword123!",
            "firstName": "Forgot",
            "lastName": "Password"
        }
        await client.post("/api/auth/register", json=registration_data)

        # Request password reset
        response = await client.post(
            "/api/auth/forgot-password",
            json={"email": "forgot@example.com"}
        )

        assert response.status_code == 200
        assert "sent" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_password_reset_with_token(self, client, db):
        """Test password reset using reset token."""
        # This test would require mocking token generation
        # Simplified version for demonstration
        pass

    @pytest.mark.asyncio
    async def test_get_active_sessions(self, client):
        """Test retrieving active user sessions."""
        # Register and login
        registration_data = {
            "email": "sessions@example.com",
            "password": "SecurePassword123!",
            "firstName": "Sessions",
            "lastName": "Test"
        }
        await client.post("/api/auth/register", json=registration_data)

        login_response = await client.post(
            "/api/auth/login",
            json={"email": "sessions@example.com", "password": "SecurePassword123!"}
        )
        access_token = login_response.cookies.get("access_token")

        # Get active sessions
        response = await client.get(
            "/api/auth/sessions",
            cookies={"access_token": access_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "activeSessions" in data
        assert len(data["activeSessions"]) > 0

    @pytest.mark.asyncio
    async def test_rate_limiting_on_login(self, client):
        """Test rate limiting prevents excessive login attempts."""
        login_data = {
            "email": "ratelimit@example.com",
            "password": "Password123!"
        }

        # Make requests until rate limit is hit
        responses = []
        for _ in range(10):
            response = await client.post("/api/auth/login", json=login_data)
            responses.append(response)

        # At least one should be rate limited
        rate_limited = any(r.status_code == 429 for r in responses)
        assert rate_limited

    @pytest.mark.asyncio
    async def test_csrf_token_generation(self, client):
        """Test CSRF token generation for authenticated users."""
        # Register and login
        registration_data = {
            "email": "csrf@example.com",
            "password": "SecurePassword123!",
            "firstName": "CSRF",
            "lastName": "Test"
        }
        await client.post("/api/auth/register", json=registration_data)

        login_response = await client.post(
            "/api/auth/login",
            json={"email": "csrf@example.com", "password": "SecurePassword123!"}
        )
        access_token = login_response.cookies.get("access_token")

        # Get CSRF token
        response = await client.get(
            "/api/auth/csrf-token",
            cookies={"access_token": access_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "csrfToken" in data
        assert len(data["csrfToken"]) > 0
