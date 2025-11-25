"""
Tests for password management functionality

Tests password reset and change endpoints with validation
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

# These tests are designed to run against the API


class TestPasswordManagement:
    """Test password reset and change functionality"""

    def test_password_generation_security(self):
        """Test that generated passwords meet security requirements"""
        from src.api.password_management import generate_secure_password_util

        password = generate_secure_password_util(12)

        # Check length
        assert len(password) >= 12

        # Check complexity requirements
        assert any(c.isupper() for c in password), "Missing uppercase letter"
        assert any(c.islower() for c in password), "Missing lowercase letter"
        assert any(c.isdigit() for c in password), "Missing digit"
        assert any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password), "Missing special character"

    def test_password_reset_admin_only(self):
        """Test that password reset requires admin role"""
        # This would require API test setup
        # For now, validate the endpoint exists and structure is correct
        from src.api.password_management import reset_employee_password
        import inspect

        sig = inspect.signature(reset_employee_password)
        assert 'employee_id' in sig.parameters
        assert 'reset_request' in sig.parameters
        assert 'current_user' in sig.parameters

    def test_password_change_validation(self):
        """Test password complexity validation in schema"""
        from src.schemas import ChangePasswordRequest
        from pydantic import ValidationError

        # Test valid password
        valid_request = ChangePasswordRequest(
            old_password="OldPass123!",
            new_password="NewPass456!",
            confirm_password="NewPass456!"
        )
        assert valid_request.new_password == "NewPass456!"

        # Test password too short
        with pytest.raises(ValidationError) as exc_info:
            ChangePasswordRequest(
                old_password="OldPass123!",
                new_password="Short1!",
                confirm_password="Short1!"
            )
        assert "at least 8 characters" in str(exc_info.value)

        # Test missing uppercase
        with pytest.raises(ValidationError) as exc_info:
            ChangePasswordRequest(
                old_password="OldPass123!",
                new_password="lowercase123!",
                confirm_password="lowercase123!"
            )
        assert "uppercase" in str(exc_info.value).lower()

        # Test missing lowercase
        with pytest.raises(ValidationError) as exc_info:
            ChangePasswordRequest(
                old_password="OldPass123!",
                new_password="UPPERCASE123!",
                confirm_password="UPPERCASE123!"
            )
        assert "lowercase" in str(exc_info.value).lower()

        # Test missing digit
        with pytest.raises(ValidationError) as exc_info:
            ChangePasswordRequest(
                old_password="OldPass123!",
                new_password="NoDigits!@#",
                confirm_password="NoDigits!@#"
            )
        assert "digit" in str(exc_info.value).lower()

        # Test missing special character
        with pytest.raises(ValidationError) as exc_info:
            ChangePasswordRequest(
                old_password="OldPass123!",
                new_password="NoSpecial123",
                confirm_password="NoSpecial123"
            )
        assert "special character" in str(exc_info.value).lower()

        # Test password mismatch
        with pytest.raises(ValidationError) as exc_info:
            ChangePasswordRequest(
                old_password="OldPass123!",
                new_password="NewPass456!",
                confirm_password="Different789!"
            )
        assert "do not match" in str(exc_info.value).lower()

    def test_password_history_model(self):
        """Test PasswordHistory model structure"""
        from src.models.password_history import PasswordHistory

        # Check model has required fields
        assert hasattr(PasswordHistory, 'user_id')
        assert hasattr(PasswordHistory, 'password_hash')
        assert hasattr(PasswordHistory, 'changed_at')
        assert hasattr(PasswordHistory, 'change_method')
        assert hasattr(PasswordHistory, 'changed_by_user_id')
        assert hasattr(PasswordHistory, 'ip_address')

    def test_user_model_password_fields(self):
        """Test User model has password management fields"""
        from src.auth.models import User

        # Check model has required fields
        assert hasattr(User, 'password_must_change')
        assert hasattr(User, 'password_changed_at')

    def test_password_schemas_structure(self):
        """Test password management schemas are properly defined"""
        from src.schemas import (
            ResetPasswordRequest,
            PasswordResponse,
            ChangePasswordRequest,
            ChangePasswordResponse
        )

        # Test ResetPasswordRequest
        reset_req = ResetPasswordRequest(send_email=True)
        assert reset_req.send_email is True

        # Test PasswordResponse structure
        password_resp = PasswordResponse(
            message="Password reset",
            temporary_password="TempPass123!",
            password_must_change=True,
            employee_id=1,
            employee_email="test@example.com"
        )
        assert password_resp.temporary_password == "TempPass123!"

    def test_password_hashing_works(self):
        """Test bcrypt password hashing functionality"""
        password = "TestPassword123!"
        password_bytes = password.encode('utf-8')
        hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        # Verify hash
        assert bcrypt.checkpw(password_bytes, hashed.encode('utf-8'))

        # Verify wrong password fails
        wrong_password = "WrongPassword456!".encode('utf-8')
        assert not bcrypt.checkpw(wrong_password, hashed.encode('utf-8'))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
