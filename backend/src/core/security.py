"""
Security utilities for AI Schedule Manager.
Handles authentication, authorization, and security middleware.
"""

import hashlib
import re
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from src.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token handling
security = HTTPBearer()


class SecurityManager:
    """Manages security operations for the application."""

    def __init__(self):
        self.secret_key = settings.SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.JWT_EXPIRATION_HOURS * 60

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a plain password against a hashed password."""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Hash a password for storing."""
        return pwd_context.hash(password)

    def validate_password_strength(self, password: str) -> Dict[str, Any]:
        """
        Validate password strength.
        Returns dict with validation result and any issues.
        """
        issues = []

        if len(password) < 8:
            issues.append("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", password):
            issues.append("Password must contain at least one uppercase letter")

        if not re.search(r"[a-z]", password):
            issues.append("Password must contain at least one lowercase letter")

        if not re.search(r"\d", password):
            issues.append("Password must contain at least one digit")

        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
            issues.append("Password must contain at least one special character")

        return {"valid": len(issues) == 0, "issues": issues, "strength": self._calculate_password_strength(password)}

    def _calculate_password_strength(self, password: str) -> str:
        """Calculate password strength score."""
        score = 0

        if len(password) >= 8:
            score += 1
        if len(password) >= 12:
            score += 1
        if re.search(r"[A-Z]", password) and re.search(r"[a-z]", password):
            score += 1
        if re.search(r"\d", password):
            score += 1
        if re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
            score += 1

        if score <= 2:
            return "weak"
        elif score <= 3:
            return "medium"
        else:
            return "strong"

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)

        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def create_refresh_token(self, data: dict) -> str:
        """Create a JWT refresh token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRATION_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_token(self, credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
        """Verify and decode a JWT token."""
        token = credentials.credentials

        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def generate_api_key(self) -> str:
        """Generate a secure API key."""
        return secrets.token_urlsafe(32)

    def hash_api_key(self, api_key: str) -> str:
        """Hash an API key for storage."""
        return hashlib.sha256(api_key.encode()).hexdigest()

    def verify_api_key(self, api_key: str, hashed_key: str) -> bool:
        """Verify an API key against its hash."""
        return self.hash_api_key(api_key) == hashed_key


# Singleton instance
security_manager = SecurityManager()


# Dependency for protected routes
async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Get the current authenticated user from JWT token."""
    return security_manager.verify_token(credentials)


async def require_role(required_role: str):
    """Dependency to require a specific user role."""

    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role", "")

        # Role hierarchy: admin > manager > employee
        role_hierarchy = {"admin": 3, "manager": 2, "employee": 1}

        if role_hierarchy.get(user_role, 0) < role_hierarchy.get(required_role, 0):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        return current_user

    return role_checker


# Input validation utilities
def sanitize_input(input_string: str, max_length: int = 1000) -> str:
    """Sanitize user input to prevent injection attacks."""
    if not input_string:
        return ""

    # Truncate to max length
    input_string = input_string[:max_length]

    # Remove null bytes
    input_string = input_string.replace("\x00", "")

    # Strip leading/trailing whitespace
    input_string = input_string.strip()

    return input_string


def validate_email(email: str) -> bool:
    """Validate email format."""
    email_pattern = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    return bool(email_pattern.match(email))


def validate_phone(phone: str) -> bool:
    """Validate phone number format."""
    # Remove common separators
    phone = re.sub(r"[\s\-\(\)]", "", phone)

    # Check if it's a valid phone number (10-15 digits, optional + prefix)
    phone_pattern = re.compile(r"^\+?\d{10,15}$")
    return bool(phone_pattern.match(phone))
