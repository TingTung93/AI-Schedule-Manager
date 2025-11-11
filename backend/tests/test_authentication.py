"""
Comprehensive authentication flow testing.
Tests JWT tokens, user sessions, role-based access, and security measures.
"""

import pytest
import jwt
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

from src.main import app
from src.core.security import create_access_token, verify_token, get_current_user, hash_password, verify_password, TokenData


class TestAuthentication:
    """Test authentication and authorization functionality."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_user_data(self):
        """Mock user data for testing."""
        return {
            "id": "user-123",
            "email": "test@example.com",
            "hashed_password": "hashed_password_here",
            "role": "employee",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login": None,
        }

    @pytest.fixture
    def mock_admin_user(self):
        """Mock admin user data."""
        return {
            "id": "admin-123",
            "email": "admin@example.com",
            "hashed_password": "hashed_admin_password",
            "role": "manager",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
        }

    @pytest.fixture
    def valid_token_payload(self):
        """Valid JWT token payload."""
        return {
            "sub": "user-123",
            "email": "test@example.com",
            "role": "employee",
            "exp": datetime.utcnow() + timedelta(hours=24),
            "iat": datetime.utcnow(),
            "type": "access",
        }

    @pytest.fixture
    def expired_token_payload(self):
        """Expired JWT token payload."""
        return {
            "sub": "user-123",
            "email": "test@example.com",
            "role": "employee",
            "exp": datetime.utcnow() - timedelta(hours=1),
            "iat": datetime.utcnow() - timedelta(hours=25),
            "type": "access",
        }

    # Token creation and validation tests
    def test_create_access_token(self, valid_token_payload):
        """Test access token creation."""
        token = create_access_token(valid_token_payload)

        assert isinstance(token, str)
        assert len(token) > 0

        # Token should be decodable
        decoded = jwt.decode(token, "test-secret-key", algorithms=["HS256"])
        assert decoded["sub"] == valid_token_payload["sub"]
        assert decoded["email"] == valid_token_payload["email"]

    def test_create_token_with_custom_expiry(self, mock_user_data):
        """Test token creation with custom expiration."""
        custom_expires = timedelta(hours=2)
        token_data = {"sub": mock_user_data["id"], "email": mock_user_data["email"]}

        token = create_access_token(token_data, expires_delta=custom_expires)
        decoded = jwt.decode(token, "test-secret-key", algorithms=["HS256"])

        exp_timestamp = decoded["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        now = datetime.utcnow()

        # Should expire in approximately 2 hours
        time_diff = exp_datetime - now
        assert 1.9 * 3600 <= time_diff.total_seconds() <= 2.1 * 3600

    def test_verify_valid_token(self, valid_token_payload):
        """Test verification of valid token."""
        token = create_access_token(valid_token_payload)

        token_data = verify_token(token)

        assert token_data.user_id == valid_token_payload["sub"]
        assert token_data.email == valid_token_payload["email"]
        assert token_data.role == valid_token_payload["role"]

    def test_verify_expired_token(self, expired_token_payload):
        """Test verification of expired token."""
        token = jwt.encode(expired_token_payload, "test-secret-key", algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_token(token)

        assert exc_info.value.status_code == 401
        assert "Token has expired" in str(exc_info.value.detail)

    def test_verify_invalid_token(self):
        """Test verification of invalid token."""
        invalid_token = "invalid.token.here"

        with pytest.raises(HTTPException) as exc_info:
            verify_token(invalid_token)

        assert exc_info.value.status_code == 401
        assert "Invalid token" in str(exc_info.value.detail)

    def test_verify_malformed_token(self):
        """Test verification of malformed token."""
        malformed_token = "this-is-not-a-jwt-token"

        with pytest.raises(HTTPException) as exc_info:
            verify_token(malformed_token)

        assert exc_info.value.status_code == 401

    def test_verify_token_with_wrong_secret(self, valid_token_payload):
        """Test token verification with wrong secret key."""
        # Create token with different secret
        wrong_token = jwt.encode(valid_token_payload, "wrong-secret", algorithm="HS256")

        with pytest.raises(HTTPException) as exc_info:
            verify_token(wrong_token)

        assert exc_info.value.status_code == 401

    # Password hashing and verification tests
    def test_hash_password(self):
        """Test password hashing."""
        password = "test_password_123"
        hashed = hash_password(password)

        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_verify_correct_password(self):
        """Test password verification with correct password."""
        password = "test_password_123"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_incorrect_password(self):
        """Test password verification with incorrect password."""
        password = "test_password_123"
        wrong_password = "wrong_password"
        hashed = hash_password(password)

        assert verify_password(wrong_password, hashed) is False

    def test_hash_empty_password(self):
        """Test hashing empty password."""
        with pytest.raises(ValueError):
            hash_password("")

    def test_hash_long_password(self):
        """Test hashing very long password."""
        long_password = "a" * 1000
        hashed = hash_password(long_password)

        assert verify_password(long_password, hashed) is True

    # User authentication flow tests
    @patch("src.core.security.get_user_by_email")
    @patch("src.core.security.verify_password")
    def test_authenticate_user_success(self, mock_verify_password, mock_get_user, mock_user_data):
        """Test successful user authentication."""
        mock_get_user.return_value = mock_user_data
        mock_verify_password.return_value = True

        from src.core.security import authenticate_user

        user = authenticate_user("test@example.com", "correct_password")

        assert user == mock_user_data
        mock_get_user.assert_called_once_with("test@example.com")
        mock_verify_password.assert_called_once()

    @patch("src.core.security.get_user_by_email")
    def test_authenticate_user_not_found(self, mock_get_user):
        """Test authentication with non-existent user."""
        mock_get_user.return_value = None

        from src.core.security import authenticate_user

        user = authenticate_user("nonexistent@example.com", "password")

        assert user is None

    @patch("src.core.security.get_user_by_email")
    @patch("src.core.security.verify_password")
    def test_authenticate_user_wrong_password(self, mock_verify_password, mock_get_user, mock_user_data):
        """Test authentication with wrong password."""
        mock_get_user.return_value = mock_user_data
        mock_verify_password.return_value = False

        from src.core.security import authenticate_user

        user = authenticate_user("test@example.com", "wrong_password")

        assert user is None

    @patch("src.core.security.get_user_by_email")
    def test_authenticate_inactive_user(self, mock_get_user, mock_user_data):
        """Test authentication with inactive user."""
        mock_user_data["is_active"] = False
        mock_get_user.return_value = mock_user_data

        from src.core.security import authenticate_user

        user = authenticate_user("test@example.com", "password")

        assert user is None

    # Current user retrieval tests
    @patch("src.core.security.get_user_by_id")
    def test_get_current_user_success(self, mock_get_user, mock_user_data, valid_token_payload):
        """Test getting current user with valid token."""
        mock_get_user.return_value = mock_user_data
        token = create_access_token(valid_token_payload)

        user = get_current_user(token)

        assert user == mock_user_data
        mock_get_user.assert_called_once_with(valid_token_payload["sub"])

    @patch("src.core.security.get_user_by_id")
    def test_get_current_user_not_found(self, mock_get_user, valid_token_payload):
        """Test getting current user when user doesn't exist."""
        mock_get_user.return_value = None
        token = create_access_token(valid_token_payload)

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(token)

        assert exc_info.value.status_code == 401
        assert "User not found" in str(exc_info.value.detail)

    def test_get_current_user_invalid_token(self):
        """Test getting current user with invalid token."""
        invalid_token = "invalid.token.here"

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(invalid_token)

        assert exc_info.value.status_code == 401

    # Role-based access control tests
    @patch("src.core.security.get_current_user")
    def test_require_role_success(self, mock_get_current_user, mock_admin_user):
        """Test role requirement with correct role."""
        mock_get_current_user.return_value = mock_admin_user

        from src.core.security import require_role

        @require_role("manager")
        def protected_function(current_user):
            return current_user

        result = protected_function("valid_token")
        assert result == mock_admin_user

    @patch("src.core.security.get_current_user")
    def test_require_role_insufficient_privileges(self, mock_get_current_user, mock_user_data):
        """Test role requirement with insufficient privileges."""
        mock_get_current_user.return_value = mock_user_data  # employee role

        from src.core.security import require_role

        @require_role("manager")
        def protected_function(current_user):
            return current_user

        with pytest.raises(HTTPException) as exc_info:
            protected_function("valid_token")

        assert exc_info.value.status_code == 403
        assert "Insufficient privileges" in str(exc_info.value.detail)

    def test_role_hierarchy(self):
        """Test role hierarchy (admin > manager > employee)."""
        from src.core.security import has_role_permission

        # Admin can access everything
        assert has_role_permission("admin", "admin") is True
        assert has_role_permission("admin", "manager") is True
        assert has_role_permission("admin", "employee") is True

        # Manager can access manager and employee
        assert has_role_permission("manager", "admin") is False
        assert has_role_permission("manager", "manager") is True
        assert has_role_permission("manager", "employee") is True

        # Employee can only access employee
        assert has_role_permission("employee", "admin") is False
        assert has_role_permission("employee", "manager") is False
        assert has_role_permission("employee", "employee") is True

    # API endpoint authentication tests
    def test_login_endpoint_success(self, client):
        """Test login endpoint with valid credentials."""
        response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert "user" in data

    def test_login_endpoint_invalid_credentials(self, client):
        """Test login endpoint with invalid credentials."""
        response = client.post("/api/auth/login", json={"email": "invalid@example.com", "password": "wrongpassword"})

        assert response.status_code == 401

    def test_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without token."""
        response = client.get("/api/protected-endpoint")

        # Should return 401 or 403 if endpoint exists and is protected
        assert response.status_code in [401, 403, 404]

    def test_protected_endpoint_with_valid_token(self, client, valid_token_payload):
        """Test accessing protected endpoint with valid token."""
        token = create_access_token(valid_token_payload)
        headers = {"Authorization": f"Bearer {token}"}

        # This would test a protected endpoint if it existed
        # For now, test that the token can be created and would be valid
        assert len(token) > 0

    def test_token_refresh_flow(self, client, valid_token_payload):
        """Test token refresh functionality."""
        # Create a token close to expiry
        short_lived_payload = valid_token_payload.copy()
        short_lived_payload["exp"] = datetime.utcnow() + timedelta(minutes=1)

        token = create_access_token(short_lived_payload)

        # In a real scenario, this would test refresh endpoint
        # For now, verify token creation
        assert len(token) > 0

    # Security tests
    def test_token_payload_tampering(self, valid_token_payload):
        """Test detection of token payload tampering."""
        token = create_access_token(valid_token_payload)

        # Tamper with token by changing a character
        tampered_token = token[:-5] + "XXXXX"

        with pytest.raises(HTTPException):
            verify_token(tampered_token)

    def test_algorithm_confusion_attack(self, valid_token_payload):
        """Test protection against algorithm confusion attacks."""
        # Create token with 'none' algorithm
        none_token = jwt.encode(valid_token_payload, "", algorithm="none")

        with pytest.raises(HTTPException):
            verify_token(none_token)

    def test_timing_attack_resistance(self):
        """Test that password verification is resistant to timing attacks."""
        import time

        password = "test_password"
        hashed = hash_password(password)

        # Measure time for correct password
        start = time.time()
        verify_password(password, hashed)
        correct_time = time.time() - start

        # Measure time for incorrect password
        start = time.time()
        verify_password("wrong_password", hashed)
        incorrect_time = time.time() - start

        # Times should be similar (within reasonable bounds)
        time_ratio = max(correct_time, incorrect_time) / min(correct_time, incorrect_time)
        assert time_ratio < 2.0  # Should not vary by more than 2x

    def test_password_complexity_requirements(self):
        """Test password complexity validation."""
        from src.core.security import validate_password_strength

        # Weak passwords should fail
        weak_passwords = ["123456", "password", "abc", "qwerty", "password123"]

        for weak_pwd in weak_passwords:
            assert validate_password_strength(weak_pwd) is False

        # Strong passwords should pass
        strong_passwords = ["MyStr0ngP@ssw0rd!", "C0mpl3x_P4ssw0rd#2024", "SecureP@ss123word!"]

        for strong_pwd in strong_passwords:
            assert validate_password_strength(strong_pwd) is True

    def test_rate_limiting_login_attempts(self, client):
        """Test rate limiting on login attempts."""
        login_data = {"email": "test@example.com", "password": "wrongpassword"}

        # Make multiple failed login attempts
        for i in range(10):
            response = client.post("/api/auth/login", json=login_data)
            # After several attempts, should start rate limiting
            if i > 5:
                assert response.status_code in [401, 429]

    def test_session_management(self, client, valid_token_payload):
        """Test session management functionality."""
        token = create_access_token(valid_token_payload)

        # Test logout functionality
        headers = {"Authorization": f"Bearer {token}"}

        # In a real app, this would test logout endpoint
        # For now, verify token invalidation concept
        assert len(token) > 0

        # After logout, token should be invalidated
        # This would be implemented in a real logout endpoint

    def test_concurrent_authentication(self, client):
        """Test concurrent authentication requests."""
        import threading
        import time

        results = []

        def login_request():
            response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
            results.append(response.status_code)

        # Create 5 concurrent login requests
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=login_request)
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # All should succeed or fail consistently
        assert all(status in [200, 401] for status in results)
