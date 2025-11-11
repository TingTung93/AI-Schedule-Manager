"""
Authentication Module

Provides comprehensive JWT-based authentication system with:
- User registration and login
- Password hashing and validation
- Role-based access control (RBAC)
- Rate limiting and account lockout
- Password reset flow
- Session management
- CSRF protection
- Security audit logging
"""

from .auth import AuthenticationError, AuthorizationError, auth_service, init_auth
from .middleware import (
    CSRFProtection,
    RateLimiter,
    csrf_protect,
    optional_auth,
    rate_limit,
    require_permission,
    require_role,
    token_required,
)
from .models import AuditLog, LoginAttempt, Permission, RefreshToken, Role, User
from .routes import auth_bp

__all__ = [
    # Core authentication
    "auth_service",
    "init_auth",
    "AuthenticationError",
    "AuthorizationError",
    # Middleware and decorators
    "token_required",
    "require_role",
    "require_permission",
    "optional_auth",
    "rate_limit",
    "csrf_protect",
    "RateLimiter",
    "CSRFProtection",
    # Database models
    "User",
    "Role",
    "Permission",
    "LoginAttempt",
    "RefreshToken",
    "AuditLog",
    # Routes blueprint
    "auth_bp",
]

# Version info
__version__ = "1.0.0"
__author__ = "AI Schedule Manager Team"
__description__ = "JWT Authentication System with RBAC and Security Features"
