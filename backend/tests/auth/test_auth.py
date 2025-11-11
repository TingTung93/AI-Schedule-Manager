"""
Authentication Tests

Comprehensive test suite for JWT authentication system including
user registration, login, token refresh, password management,
and security features.
"""

import pytest
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
from flask import Flask
from werkzeug.test import Client

from backend.src.auth import (
    auth_service,
    AuthenticationError,
    AuthorizationError,
    token_required,
    require_role,
    require_permission,
    rate_limit,
    User,
    Role,
    Permission,
    LoginAttempt,
)
from backend.src.auth.auth import AuthService
from backend.src.auth.middleware import RateLimiter, CSRFProtection


class TestAuthService:
    """Test authentication service functionality"""

    def setup_method(self):
        """Setup test environment"""
        self.app = Flask(__name__)
        self.app.config["JWT_SECRET_KEY"] = "test-secret-key"
        self.app.config["JWT_REFRESH_SECRET_KEY"] = "test-refresh-secret"
        self.app.config["TESTING"] = True

        # Initialize auth service
        self.auth_service = AuthService()
        self.auth_service.init_app(self.app)

        # Mock Redis client
        self.mock_redis = MagicMock()
        self.auth_service.redis_client = self.mock_redis

        # Test user data
        self.test_user_data = {
            "id": 1,
            "email": "test@example.com",
            "role": "user",
            "permissions": ["schedule.read", "schedule.write"],
        }

    def test_password_hashing(self):
        """Test password hashing and verification"""
        password = "TestPassword123!"

        # Test hashing
        hashed = self.auth_service.hash_password(password)
        assert hashed is not None
        assert hashed != password
        assert len(hashed) > 50  # bcrypt produces long hashes

        # Test verification
        assert self.auth_service.verify_password(password, hashed) is True
        assert self.auth_service.verify_password("wrong_password", hashed) is False

    def test_access_token_generation_verification(self):
        """Test JWT access token generation and verification"""
        with self.app.app_context():
            # Generate token
            token = self.auth_service.generate_access_token(self.test_user_data)
            assert token is not None
            assert isinstance(token, str)

            # Verify token
            payload = self.auth_service.verify_access_token(token)
            assert payload["user_id"] == self.test_user_data["id"]
            assert payload["email"] == self.test_user_data["email"]
            assert payload["role"] == self.test_user_data["role"]
            assert payload["type"] == "access"

    def test_refresh_token_generation_verification(self):
        """Test JWT refresh token generation and verification"""
        with self.app.app_context():
            user_id = 1

            # Mock Redis operations
            self.mock_redis.setex.return_value = True
            self.mock_redis.exists.return_value = True

            # Generate refresh token
            token = self.auth_service.generate_refresh_token(user_id)
            assert token is not None
            assert isinstance(token, str)

            # Verify token
            payload = self.auth_service.verify_refresh_token(token)
            assert payload["user_id"] == user_id
            assert payload["type"] == "refresh"
            assert "jti" in payload

    def test_token_expiration(self):
        """Test token expiration handling"""
        with self.app.app_context():
            # Create service with very short expiration
            short_service = AuthService()
            short_service.init_app(self.app)
            short_service.access_token_expires = timedelta(milliseconds=1)
            short_service.redis_client = self.mock_redis

            # Generate token
            token = short_service.generate_access_token(self.test_user_data)

            # Wait for expiration (simulate)
            import time

            time.sleep(0.002)

            # Verify token is expired
            with pytest.raises(AuthenticationError, match="Token has expired"):
                short_service.verify_access_token(token)

    def test_invalid_token(self):
        """Test invalid token handling"""
        with self.app.app_context():
            # Test malformed token
            with pytest.raises(AuthenticationError, match="Invalid token"):
                self.auth_service.verify_access_token("invalid.token.here")

            # Test wrong secret
            wrong_service = AuthService()
            wrong_service.secret_key = "wrong-secret"
            wrong_token = wrong_service.generate_access_token(self.test_user_data)

            with pytest.raises(AuthenticationError, match="Invalid token"):
                self.auth_service.verify_access_token(wrong_token)

    def test_refresh_token_revocation(self):
        """Test refresh token revocation"""
        with self.app.app_context():
            user_id = 1

            # Mock Redis operations
            self.mock_redis.setex.return_value = True
            self.mock_redis.exists.return_value = True
            self.mock_redis.delete.return_value = True

            # Generate and revoke token
            token = self.auth_service.generate_refresh_token(user_id)
            result = self.auth_service.revoke_refresh_token(token)

            assert result is True
            self.mock_redis.delete.assert_called()

    def test_password_reset_token(self):
        """Test password reset token generation and verification"""
        with self.app.app_context():
            user_id = 1
            email = "test@example.com"

            # Mock Redis operations
            self.mock_redis.setex.return_value = True
            self.mock_redis.exists.return_value = True

            # Generate reset token
            token = self.auth_service.generate_password_reset_token(user_id, email)
            assert token is not None

            # Verify reset token
            payload = self.auth_service.verify_password_reset_token(token)
            assert payload["user_id"] == user_id
            assert payload["email"] == email
            assert payload["type"] == "password_reset"

    def test_email_validation(self):
        """Test email format validation"""
        valid_emails = ["test@example.com", "user.name@domain.co.uk", "user+tag@example.org"]

        invalid_emails = ["invalid-email", "@example.com", "user@", "user..name@example.com"]

        for email in valid_emails:
            assert self.auth_service.validate_email_format(email) is True

        for email in invalid_emails:
            assert self.auth_service.validate_email_format(email) is False

    def test_password_strength_validation(self):
        """Test password strength checking"""
        strong_passwords = ["StrongPassword123!", "MySecure@Pass1", "Complex#Password9"]

        weak_passwords = [
            "weak",
            "password",
            "12345678",
            "NoSpecialChar123",
            "nouppercasechar1!",
            "NOLOWERCASECHAR1!",
            "NoNumbers!@#",
        ]

        for password in strong_passwords:
            is_valid, issues = self.auth_service.check_password_strength(password)
            assert is_valid is True
            assert len(issues) == 0

        for password in weak_passwords:
            is_valid, issues = self.auth_service.check_password_strength(password)
            assert is_valid is False
            assert len(issues) > 0


class TestMiddleware:
    """Test authentication middleware and decorators"""

    def setup_method(self):
        """Setup test environment"""
        self.app = Flask(__name__)
        self.app.config["JWT_SECRET_KEY"] = "test-secret-key"
        self.app.config["TESTING"] = True

        # Initialize auth service
        auth_service.init_app(self.app)
        auth_service.redis_client = MagicMock()

        # Test client
        self.client = self.app.test_client()

    def test_token_required_decorator(self):
        """Test token_required decorator"""

        @self.app.route("/protected")
        @token_required
        def protected_route():
            from flask import g

            return {"user_id": g.user_id}

        with self.app.app_context():
            # Test without token
            response = self.client.get("/protected")
            assert response.status_code == 401

            # Test with valid token
            user_data = {"id": 1, "email": "test@example.com", "role": "user"}
            token = auth_service.generate_access_token(user_data)

            response = self.client.get("/protected", headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 200

    def test_role_required_decorator(self):
        """Test require_role decorator"""

        @self.app.route("/admin")
        @token_required
        @require_role("admin")
        def admin_route():
            return {"message": "Admin access granted"}

        with self.app.app_context():
            # Test with user role
            user_data = {"id": 1, "email": "test@example.com", "role": "user"}
            token = auth_service.generate_access_token(user_data)

            response = self.client.get("/admin", headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 403

            # Test with admin role
            admin_data = {"id": 2, "email": "admin@example.com", "role": "admin"}
            admin_token = auth_service.generate_access_token(admin_data)

            response = self.client.get("/admin", headers={"Authorization": f"Bearer {admin_token}"})
            assert response.status_code == 200

    def test_permission_required_decorator(self):
        """Test require_permission decorator"""

        @self.app.route("/delete-user")
        @token_required
        @require_permission("user.delete")
        def delete_user_route():
            return {"message": "User deleted"}

        with self.app.app_context():
            # Test without permission
            user_data = {"id": 1, "email": "test@example.com", "role": "user", "permissions": ["user.read"]}
            token = auth_service.generate_access_token(user_data)

            response = self.client.get("/delete-user", headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 403

            # Test with permission
            admin_data = {"id": 2, "email": "admin@example.com", "role": "admin", "permissions": ["user.delete"]}
            admin_token = auth_service.generate_access_token(admin_data)

            response = self.client.get("/delete-user", headers={"Authorization": f"Bearer {admin_token}"})
            assert response.status_code == 200


class TestRateLimiting:
    """Test rate limiting functionality"""

    def setup_method(self):
        """Setup test environment"""
        self.mock_redis = MagicMock()
        self.rate_limiter = RateLimiter(self.mock_redis)

    def test_rate_limiting_first_request(self):
        """Test first request is allowed"""
        self.mock_redis.get.return_value = None
        self.mock_redis.setex.return_value = True

        is_limited = self.rate_limiter.is_rate_limited("test_key", 5, 300)
        assert is_limited is False

        self.mock_redis.setex.assert_called_with("rate_limit:test_key", 300, 1)

    def test_rate_limiting_within_limit(self):
        """Test requests within limit are allowed"""
        self.mock_redis.get.return_value = b"3"  # 3 previous requests
        self.mock_redis.incr.return_value = 4

        is_limited = self.rate_limiter.is_rate_limited("test_key", 5, 300)
        assert is_limited is False

        self.mock_redis.incr.assert_called_with("rate_limit:test_key")

    def test_rate_limiting_exceeds_limit(self):
        """Test requests exceeding limit are blocked"""
        self.mock_redis.get.return_value = b"5"  # Already at limit

        is_limited = self.rate_limiter.is_rate_limited("test_key", 5, 300)
        assert is_limited is True

        # Should not increment counter
        self.mock_redis.incr.assert_not_called()

    def test_remaining_attempts(self):
        """Test remaining attempts calculation"""
        self.mock_redis.get.return_value = b"3"

        remaining = self.rate_limiter.get_remaining_attempts("test_key", 5)
        assert remaining == 2

        # Test when no attempts yet
        self.mock_redis.get.return_value = None
        remaining = self.rate_limiter.get_remaining_attempts("test_key", 5)
        assert remaining == 5


class TestCSRFProtection:
    """Test CSRF protection functionality"""

    def setup_method(self):
        """Setup test environment"""
        self.mock_redis = MagicMock()
        self.csrf_protection = CSRFProtection(self.mock_redis)

    def test_csrf_token_generation(self):
        """Test CSRF token generation"""
        self.mock_redis.setex.return_value = True

        token = self.csrf_protection.generate_csrf_token("session_123")
        assert token is not None
        assert len(token) > 20  # Should be a reasonable length

        self.mock_redis.setex.assert_called()

    def test_csrf_token_validation_success(self):
        """Test successful CSRF token validation"""
        test_token = "test_csrf_token_123"
        self.mock_redis.get.return_value = test_token.encode("utf-8")

        is_valid = self.csrf_protection.validate_csrf_token("session_123", test_token)
        assert is_valid is True

    def test_csrf_token_validation_failure(self):
        """Test failed CSRF token validation"""
        self.mock_redis.get.return_value = b"different_token"

        is_valid = self.csrf_protection.validate_csrf_token("session_123", "wrong_token")
        assert is_valid is False

    def test_csrf_token_missing(self):
        """Test validation when no token exists"""
        self.mock_redis.get.return_value = None

        is_valid = self.csrf_protection.validate_csrf_token("session_123", "any_token")
        assert is_valid is False


class TestIntegration:
    """Integration tests for authentication flow"""

    def setup_method(self):
        """Setup test environment"""
        self.app = Flask(__name__)
        self.app.config.update(
            {"JWT_SECRET_KEY": "test-secret-key", "JWT_REFRESH_SECRET_KEY": "test-refresh-secret", "TESTING": True}
        )

        # Initialize auth service
        auth_service.init_app(self.app)
        auth_service.redis_client = MagicMock()

        # Mock successful Redis operations
        auth_service.redis_client.setex.return_value = True
        auth_service.redis_client.exists.return_value = True
        auth_service.redis_client.get.return_value = None

        self.client = self.app.test_client()

    def test_complete_authentication_flow(self):
        """Test complete authentication flow"""
        with self.app.app_context():
            # 1. Generate tokens (simulating registration/login)
            user_data = {
                "id": 1,
                "email": "test@example.com",
                "role": "user",
                "permissions": ["schedule.read", "schedule.write"],
            }

            access_token = auth_service.generate_access_token(user_data)
            refresh_token = auth_service.generate_refresh_token(user_data["id"])

            assert access_token is not None
            assert refresh_token is not None

            # 2. Verify access token
            payload = auth_service.verify_access_token(access_token)
            assert payload["user_id"] == user_data["id"]
            assert payload["email"] == user_data["email"]

            # 3. Verify refresh token
            refresh_payload = auth_service.verify_refresh_token(refresh_token)
            assert refresh_payload["user_id"] == user_data["id"]
            assert refresh_payload["type"] == "refresh"

            # 4. Test token refresh
            new_access_token = auth_service.generate_access_token(user_data)
            new_payload = auth_service.verify_access_token(new_access_token)
            assert new_payload["user_id"] == user_data["id"]

    def test_security_features(self):
        """Test security features integration"""
        with self.app.app_context():
            # Test password hashing
            password = "SecurePassword123!"
            hashed = auth_service.hash_password(password)
            assert auth_service.verify_password(password, hashed) is True

            # Test email validation
            assert auth_service.validate_email_format("valid@example.com") is True
            assert auth_service.validate_email_format("invalid-email") is False

            # Test password strength
            is_strong, issues = auth_service.check_password_strength(password)
            assert is_strong is True
            assert len(issues) == 0

            weak_password = "weak"
            is_weak, weak_issues = auth_service.check_password_strength(weak_password)
            assert is_weak is False
            assert len(weak_issues) > 0


# Memory storage for test results
def store_test_results():
    """Store test implementation details in memory"""
    try:
        if hasattr(pytest, "current_test_results"):
            implementation = {
                "backend_auth_tests": {
                    "test_classes": [
                        "TestAuthService - Core authentication functionality",
                        "TestMiddleware - Decorators and route protection",
                        "TestRateLimiting - Rate limiting mechanisms",
                        "TestCSRFProtection - CSRF token handling",
                        "TestIntegration - Complete authentication flow",
                    ],
                    "coverage_areas": [
                        "JWT token generation and validation",
                        "Password hashing and verification",
                        "Role-based access control",
                        "Permission-based access control",
                        "Rate limiting",
                        "CSRF protection",
                        "Token refresh mechanism",
                        "Password reset flow",
                        "Email validation",
                        "Password strength checking",
                    ],
                    "security_tests": [
                        "Token expiration handling",
                        "Invalid token rejection",
                        "Token revocation",
                        "Rate limit enforcement",
                        "CSRF token validation",
                        "Role-based access denial",
                        "Permission-based access denial",
                    ],
                }
            }

            # Store in memory if available
            pytest.current_test_results = implementation

    except Exception as e:
        print(f"Failed to store test results: {e}")


# Run test storage
store_test_results()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
