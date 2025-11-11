"""
JWT Authentication Module

Provides JWT token generation, validation, and authentication utilities.
Includes secure password hashing, refresh tokens, and RBAC support.
"""

import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from functools import wraps
from flask import request, jsonify, current_app
import redis
from email_validator import validate_email, EmailNotValidError
import logging

logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Custom exception for authentication errors"""

    pass


class AuthorizationError(Exception):
    """Custom exception for authorization errors"""

    pass


class AuthService:
    """
    Comprehensive authentication service with JWT tokens, refresh tokens,
    password hashing, and role-based access control.
    """

    def __init__(self, app=None, redis_client=None):
        self.app = app
        self.redis_client = redis_client or redis.Redis(host="localhost", port=6379, db=0)
        self.secret_key = None
        self.refresh_secret_key = None
        self.access_token_expires = timedelta(minutes=15)
        self.refresh_token_expires = timedelta(days=30)
        self.password_reset_expires = timedelta(hours=1)

        if app:
            self.init_app(app)

    def init_app(self, app):
        """Initialize the authentication service with Flask app"""
        self.app = app
        self.secret_key = app.config.get("JWT_SECRET_KEY", secrets.token_urlsafe(32))
        self.refresh_secret_key = app.config.get("JWT_REFRESH_SECRET_KEY", secrets.token_urlsafe(32))

        # Store secrets in app config for consistency
        app.config["JWT_SECRET_KEY"] = self.secret_key
        app.config["JWT_REFRESH_SECRET_KEY"] = self.refresh_secret_key

    def hash_password(self, password: str) -> str:
        """
        Hash password using bcrypt with salt

        Args:
            password: Plain text password

        Returns:
            Hashed password string
        """
        try:
            # Generate salt and hash password
            salt = bcrypt.gensalt(rounds=12)
            hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
            return hashed.decode("utf-8")
        except Exception as e:
            logger.error(f"Password hashing failed: {e}")
            raise AuthenticationError("Password hashing failed")

    def verify_password(self, password: str, hashed: str) -> bool:
        """
        Verify password against hash

        Args:
            password: Plain text password
            hashed: Hashed password from database

        Returns:
            True if password matches, False otherwise
        """
        try:
            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        except Exception as e:
            logger.error(f"Password verification failed: {e}")
            return False

    def generate_access_token(self, user_data: Dict[str, Any]) -> str:
        """
        Generate JWT access token

        Args:
            user_data: User information to include in token

        Returns:
            JWT access token string
        """
        try:
            payload = {
                "user_id": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
                "permissions": user_data.get("permissions", []),
                "exp": datetime.now(timezone.utc) + self.access_token_expires,
                "iat": datetime.now(timezone.utc),
                "type": "access",
            }

            return jwt.encode(payload, self.secret_key, algorithm="HS256")
        except Exception as e:
            logger.error(f"Access token generation failed: {e}")
            raise AuthenticationError("Token generation failed")

    def generate_refresh_token(self, user_id: int) -> str:
        """
        Generate JWT refresh token

        Args:
            user_id: User ID

        Returns:
            JWT refresh token string
        """
        try:
            payload = {
                "user_id": user_id,
                "exp": datetime.now(timezone.utc) + self.refresh_token_expires,
                "iat": datetime.now(timezone.utc),
                "type": "refresh",
                "jti": secrets.token_urlsafe(32),  # Unique token ID
            }

            token = jwt.encode(payload, self.refresh_secret_key, algorithm="HS256")

            # Store refresh token in Redis for revocation capability
            self.redis_client.setex(f"refresh_token:{payload['jti']}", self.refresh_token_expires, user_id)

            return token
        except Exception as e:
            logger.error(f"Refresh token generation failed: {e}")
            raise AuthenticationError("Refresh token generation failed")

    def verify_access_token(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode JWT access token

        Args:
            token: JWT access token

        Returns:
            Decoded token payload

        Raises:
            AuthenticationError: If token is invalid
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])

            if payload.get("type") != "access":
                raise AuthenticationError("Invalid token type")

            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationError(f"Invalid token: {e}")

    def verify_refresh_token(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode JWT refresh token

        Args:
            token: JWT refresh token

        Returns:
            Decoded token payload

        Raises:
            AuthenticationError: If token is invalid
        """
        try:
            payload = jwt.decode(token, self.refresh_secret_key, algorithms=["HS256"])

            if payload.get("type") != "refresh":
                raise AuthenticationError("Invalid token type")

            # Check if token is revoked
            jti = payload.get("jti")
            if not self.redis_client.exists(f"refresh_token:{jti}"):
                raise AuthenticationError("Token has been revoked")

            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Refresh token has expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationError(f"Invalid refresh token: {e}")

    def revoke_refresh_token(self, token: str) -> bool:
        """
        Revoke a refresh token

        Args:
            token: JWT refresh token to revoke

        Returns:
            True if successfully revoked
        """
        try:
            payload = jwt.decode(token, self.refresh_secret_key, algorithms=["HS256"])
            jti = payload.get("jti")

            if jti:
                self.redis_client.delete(f"refresh_token:{jti}")
                return True
            return False
        except Exception as e:
            logger.error(f"Token revocation failed: {e}")
            return False

    def generate_password_reset_token(self, user_id: int, email: str) -> str:
        """
        Generate password reset token

        Args:
            user_id: User ID
            email: User email

        Returns:
            Password reset token
        """
        try:
            payload = {
                "user_id": user_id,
                "email": email,
                "exp": datetime.now(timezone.utc) + self.password_reset_expires,
                "iat": datetime.now(timezone.utc),
                "type": "password_reset",
                "jti": secrets.token_urlsafe(32),
            }

            token = jwt.encode(payload, self.secret_key, algorithm="HS256")

            # Store reset token in Redis
            self.redis_client.setex(f"reset_token:{payload['jti']}", self.password_reset_expires, user_id)

            return token
        except Exception as e:
            logger.error(f"Password reset token generation failed: {e}")
            raise AuthenticationError("Password reset token generation failed")

    def verify_password_reset_token(self, token: str) -> Dict[str, Any]:
        """
        Verify password reset token

        Args:
            token: Password reset token

        Returns:
            Decoded token payload
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])

            if payload.get("type") != "password_reset":
                raise AuthenticationError("Invalid token type")

            # Check if token is still valid in Redis
            jti = payload.get("jti")
            if not self.redis_client.exists(f"reset_token:{jti}"):
                raise AuthenticationError("Reset token has been used or expired")

            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Reset token has expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationError(f"Invalid reset token: {e}")

    def invalidate_password_reset_token(self, token: str) -> bool:
        """
        Invalidate password reset token after use

        Args:
            token: Password reset token

        Returns:
            True if successfully invalidated
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            jti = payload.get("jti")

            if jti:
                self.redis_client.delete(f"reset_token:{jti}")
                return True
            return False
        except Exception as e:
            logger.error(f"Reset token invalidation failed: {e}")
            return False

    def validate_email_format(self, email: str) -> bool:
        """
        Validate email format

        Args:
            email: Email address to validate

        Returns:
            True if valid, False otherwise
        """
        try:
            validate_email(email)
            return True
        except EmailNotValidError:
            return False

    def check_password_strength(self, password: str) -> Tuple[bool, list]:
        """
        Check password strength

        Args:
            password: Password to check

        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []

        if len(password) < 8:
            issues.append("Password must be at least 8 characters long")

        if not any(c.isupper() for c in password):
            issues.append("Password must contain at least one uppercase letter")

        if not any(c.islower() for c in password):
            issues.append("Password must contain at least one lowercase letter")

        if not any(c.isdigit() for c in password):
            issues.append("Password must contain at least one number")

        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            issues.append("Password must contain at least one special character")

        return len(issues) == 0, issues


# Global auth service instance
auth_service = AuthService()


def init_auth(app, redis_client=None):
    """Initialize authentication service"""
    auth_service.init_app(app)
    if redis_client:
        auth_service.redis_client = redis_client
    return auth_service
