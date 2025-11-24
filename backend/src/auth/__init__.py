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
# Flask middleware - not used in FastAPI
# from .middleware import (
#     CSRFProtection,
#     RateLimiter,
#     csrf_protect,
#     optional_auth,
#     rate_limit,
#     require_permission,
#     require_role,
#     token_required,
# )
# Models should be imported directly from auth.models, not re-exported to avoid circular imports
# from .models import AuditLog, LoginAttempt, Permission, RefreshToken, Role, User
# Flask routes - not used, using fastapi_routes instead
# from .routes import auth_bp

__all__ = [
    # Core authentication
    "auth_service",
    "init_auth",
    "AuthenticationError",
    "AuthorizationError",
    # Database models - import from auth.models directly
    # "User",
    # "Role",
    # "Permission",
    # "LoginAttempt",
    # "RefreshToken",
    # "AuditLog",
]

# Version info
__version__ = "1.0.0"
__author__ = "AI Schedule Manager Team"
__description__ = "JWT Authentication System with RBAC and Security Features"
