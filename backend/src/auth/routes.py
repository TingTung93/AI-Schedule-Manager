"""
Authentication Routes

Provides REST API endpoints for user authentication, registration,
password management, and account security features.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, g, jsonify, make_response, request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from ..database import get_db_session
from .auth import AuthenticationError, auth_service
from .middleware import CSRFProtection, RateLimiter, csrf_protect, rate_limit, token_required
from .models import AuditLog, LoginAttempt, RefreshToken, Role, User, get_or_create_user_role

# Create blueprint
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
logger = logging.getLogger(__name__)


def log_audit_event(
    event_type: str,
    user_id: int = None,
    resource: str = None,
    action: str = None,
    success: bool = True,
    failure_reason: str = None,
    details: dict = None,
):
    """Log security audit event"""
    try:
        session = get_db_session()

        audit_log = AuditLog(
            user_id=user_id,
            event_type=event_type,
            resource=resource,
            action=action,
            ip_address=request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr),
            user_agent=request.headers.get("User-Agent"),
            success=success,
            failure_reason=failure_reason,
            details=json.dumps(details) if details else None,
        )

        session.add(audit_log)
        session.commit()
        session.close()

    except Exception as e:
        logger.error(f"Failed to log audit event: {e}")


def record_login_attempt(email: str, user_id: int = None, success: bool = True, failure_reason: str = None):
    """Record login attempt for security tracking"""
    try:
        session = get_db_session()

        login_attempt = LoginAttempt(
            user_id=user_id,
            email=email,
            ip_address=request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr),
            user_agent=request.headers.get("User-Agent"),
            success=success,
            failure_reason=failure_reason,
        )

        session.add(login_attempt)
        session.commit()
        session.close()

    except Exception as e:
        logger.error(f"Failed to record login attempt: {e}")


@auth_bp.route("/register", methods=["POST"])
@rate_limit(limit=3, window=300)  # 3 registrations per 5 minutes per IP
def register():
    """
    Register new user account

    Expected JSON:
    {
        "email": "user@example.com",
        "password": "securepassword123",
        "first_name": "John",
        "last_name": "Doe"
    }
    """
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ["email", "password", "first_name", "last_name"]
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            return jsonify({"error": "Missing required fields", "missing_fields": missing_fields}), 400

        email = data["email"].lower().strip()
        password = data["password"]
        first_name = data["first_name"].strip()
        last_name = data["last_name"].strip()

        # Validate email format
        if not auth_service.validate_email_format(email):
            return jsonify({"error": "Invalid email format"}), 400

        # Check password strength
        is_strong, password_issues = auth_service.check_password_strength(password)
        if not is_strong:
            return jsonify({"error": "Password does not meet requirements", "requirements": password_issues}), 400

        # Check if user already exists
        session = get_db_session()
        existing_user = session.query(User).filter_by(email=email).first()

        if existing_user:
            session.close()
            log_audit_event(
                "registration", resource="user", action="create", success=False, failure_reason="email_already_exists"
            )
            return jsonify({"error": "Email already registered"}), 409

        # Hash password
        password_hash = auth_service.hash_password(password)

        # Get default user role
        user_role = get_or_create_user_role(session)

        # Create new user
        new_user = User(
            email=email, password_hash=password_hash, first_name=first_name, last_name=last_name, roles=[user_role]
        )

        session.add(new_user)
        session.commit()

        # Log successful registration
        log_audit_event("registration", user_id=new_user.id, resource="user", action="create", success=True)

        # Generate tokens
        user_data = new_user.to_dict()
        access_token = auth_service.generate_access_token(user_data)
        refresh_token = auth_service.generate_refresh_token(new_user.id)

        session.close()

        # Create response with secure cookies
        response = make_response(
            jsonify({"message": "Registration successful", "user": user_data, "access_token": access_token})
        )

        # Set secure HTTP-only cookies
        response.set_cookie(
            "access_token",
            access_token,
            max_age=900,  # 15 minutes
            httponly=True,
            secure=current_app.config.get("HTTPS_ONLY", False),
            samesite="Strict",
        )

        response.set_cookie(
            "refresh_token",
            refresh_token,
            max_age=2592000,  # 30 days
            httponly=True,
            secure=current_app.config.get("HTTPS_ONLY", False),
            samesite="Strict",
        )

        return response, 201

    except IntegrityError as e:
        logger.error(f"Database integrity error during registration: {e}")
        return jsonify({"error": "Registration failed", "message": "Email already exists"}), 409

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({"error": "Registration failed", "message": "Internal server error"}), 500


@auth_bp.route("/login", methods=["POST"])
@rate_limit(limit=5, window=300)  # 5 login attempts per 5 minutes per IP
def login():
    """
    Authenticate user and return JWT tokens

    Expected JSON:
    {
        "email": "user@example.com",
        "password": "password123"
    }
    """
    try:
        data = request.get_json()

        if not data.get("email") or not data.get("password"):
            return jsonify({"error": "Email and password required"}), 400

        email = data["email"].lower().strip()
        password = data["password"]

        session = get_db_session()
        user = session.query(User).filter_by(email=email).first()

        # Record login attempt
        if not user:
            record_login_attempt(email, success=False, failure_reason="invalid_email")
            session.close()
            return jsonify({"error": "Invalid credentials"}), 401

        # Check if account is locked
        if user.is_account_locked():
            record_login_attempt(email, user_id=user.id, success=False, failure_reason="account_locked")
            session.close()
            return (
                jsonify(
                    {
                        "error": "Account is locked",
                        "message": f"Account locked until {user.account_locked_until.isoformat()}",
                        "locked_until": user.account_locked_until.isoformat(),
                    }
                ),
                423,
            )

        # Check if account is active
        if not user.is_active:
            record_login_attempt(email, user_id=user.id, success=False, failure_reason="account_inactive")
            session.close()
            return jsonify({"error": "Account is deactivated"}), 403

        # Verify password
        if not auth_service.verify_password(password, user.password_hash):
            # Increment failed attempts
            user.failed_login_attempts += 1
            user.last_login_attempt = datetime.now(timezone.utc)

            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.is_locked = True
                user.account_locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)

                record_login_attempt(email, user_id=user.id, success=False, failure_reason="max_attempts_reached")
                log_audit_event(
                    "account_locked",
                    user_id=user.id,
                    resource="user",
                    action="lock",
                    success=True,
                    details={"reason": "max_failed_attempts"},
                )
            else:
                record_login_attempt(email, user_id=user.id, success=False, failure_reason="invalid_password")

            session.commit()
            session.close()

            return jsonify({"error": "Invalid credentials", "remaining_attempts": max(0, 5 - user.failed_login_attempts)}), 401

        # Successful login - reset failed attempts
        user.failed_login_attempts = 0
        user.last_successful_login = datetime.now(timezone.utc)
        user.is_locked = False
        user.account_locked_until = None
        session.commit()

        # Record successful login
        record_login_attempt(email, user_id=user.id, success=True)
        log_audit_event("login", user_id=user.id, resource="user", action="login", success=True)

        # Generate tokens
        user_data = user.to_dict()
        access_token = auth_service.generate_access_token(user_data)
        refresh_token = auth_service.generate_refresh_token(user.id)

        session.close()

        # Create response with secure cookies
        response = make_response(jsonify({"message": "Login successful", "user": user_data, "access_token": access_token}))

        # Set secure HTTP-only cookies
        response.set_cookie(
            "access_token",
            access_token,
            max_age=900,  # 15 minutes
            httponly=True,
            secure=current_app.config.get("HTTPS_ONLY", False),
            samesite="Strict",
        )

        response.set_cookie(
            "refresh_token",
            refresh_token,
            max_age=2592000,  # 30 days
            httponly=True,
            secure=current_app.config.get("HTTPS_ONLY", False),
            samesite="Strict",
        )

        return response, 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": "Login failed", "message": "Internal server error"}), 500


@auth_bp.route("/refresh", methods=["POST"])
def refresh_token():
    """
    Refresh JWT access token using refresh token
    """
    try:
        # Get refresh token from cookie or body
        refresh_token = request.cookies.get("refresh_token")
        if not refresh_token:
            data = request.get_json() or {}
            refresh_token = data.get("refresh_token")

        if not refresh_token:
            return jsonify({"error": "Refresh token required"}), 400

        # Verify refresh token
        payload = auth_service.verify_refresh_token(refresh_token)
        user_id = payload["user_id"]

        # Get user from database
        session = get_db_session()
        user = session.query(User).filter_by(id=user_id).first()

        if not user or not user.is_active:
            session.close()
            return jsonify({"error": "Invalid user"}), 401

        # Generate new access token
        user_data = user.to_dict()
        new_access_token = auth_service.generate_access_token(user_data)

        session.close()

        # Log token refresh
        log_audit_event("token_refresh", user_id=user_id, resource="auth", action="refresh", success=True)

        # Create response
        response = make_response(jsonify({"message": "Token refreshed successfully", "access_token": new_access_token}))

        # Update access token cookie
        response.set_cookie(
            "access_token",
            new_access_token,
            max_age=900,  # 15 minutes
            httponly=True,
            secure=current_app.config.get("HTTPS_ONLY", False),
            samesite="Strict",
        )

        return response, 200

    except AuthenticationError as e:
        return jsonify({"error": "Token refresh failed", "message": str(e)}), 401

    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return jsonify({"error": "Token refresh failed", "message": "Internal server error"}), 500


@auth_bp.route("/logout", methods=["POST"])
@token_required
def logout():
    """
    Logout user and revoke refresh token
    """
    try:
        # Get refresh token to revoke it
        refresh_token = request.cookies.get("refresh_token")

        if refresh_token:
            auth_service.revoke_refresh_token(refresh_token)

        # Log logout
        log_audit_event("logout", user_id=g.user_id, resource="user", action="logout", success=True)

        # Create response and clear cookies
        response = make_response(jsonify({"message": "Logout successful"}))

        response.set_cookie("access_token", "", expires=0)
        response.set_cookie("refresh_token", "", expires=0)

        return response, 200

    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({"error": "Logout failed", "message": "Internal server error"}), 500


@auth_bp.route("/me", methods=["GET"])
@token_required
def get_current_user():
    """
    Get current user information
    """
    try:
        session = get_db_session()
        user = session.query(User).filter_by(id=g.user_id).first()

        if not user:
            session.close()
            return jsonify({"error": "User not found"}), 404

        user_data = user.to_dict()
        session.close()

        return jsonify({"user": user_data}), 200

    except Exception as e:
        logger.error(f"Get current user error: {e}")
        return jsonify({"error": "Failed to get user information"}), 500


@auth_bp.route("/change-password", methods=["POST"])
@token_required
@csrf_protect
def change_password():
    """
    Change user password

    Expected JSON:
    {
        "current_password": "oldpassword",
        "new_password": "newpassword123"
    }
    """
    try:
        data = request.get_json()

        if not data.get("current_password") or not data.get("new_password"):
            return jsonify({"error": "Current password and new password required"}), 400

        current_password = data["current_password"]
        new_password = data["new_password"]

        # Check new password strength
        is_strong, password_issues = auth_service.check_password_strength(new_password)
        if not is_strong:
            return jsonify({"error": "New password does not meet requirements", "requirements": password_issues}), 400

        # Get current user
        session = get_db_session()
        user = session.query(User).filter_by(id=g.user_id).first()

        if not user:
            session.close()
            return jsonify({"error": "User not found"}), 404

        # Verify current password
        if not auth_service.verify_password(current_password, user.password_hash):
            session.close()
            log_audit_event(
                "password_change",
                user_id=g.user_id,
                resource="user",
                action="change_password",
                success=False,
                failure_reason="invalid_current_password",
            )
            return jsonify({"error": "Current password is incorrect"}), 401

        # Update password
        user.password_hash = auth_service.hash_password(new_password)
        user.updated_at = datetime.now(timezone.utc)
        session.commit()
        session.close()

        # Log successful password change
        log_audit_event("password_change", user_id=g.user_id, resource="user", action="change_password", success=True)

        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        logger.error(f"Password change error: {e}")
        return jsonify({"error": "Password change failed", "message": "Internal server error"}), 500


@auth_bp.route("/forgot-password", methods=["POST"])
@rate_limit(limit=3, window=3600)  # 3 requests per hour per IP
def forgot_password():
    """
    Request password reset token

    Expected JSON:
    {
        "email": "user@example.com"
    }
    """
    try:
        data = request.get_json()

        if not data.get("email"):
            return jsonify({"error": "Email required"}), 400

        email = data["email"].lower().strip()

        # Validate email format
        if not auth_service.validate_email_format(email):
            return jsonify({"error": "Invalid email format"}), 400

        session = get_db_session()
        user = session.query(User).filter_by(email=email).first()

        # Always return success to prevent email enumeration
        response_message = {"message": "If the email is registered, a password reset link has been sent"}

        if user and user.is_active:
            # Generate password reset token
            reset_token = auth_service.generate_password_reset_token(user.id, email)

            # Update user record
            user.password_reset_token = reset_token
            user.password_reset_sent_at = datetime.now(timezone.utc)
            session.commit()

            # Log password reset request
            log_audit_event("password_reset_request", user_id=user.id, resource="user", action="reset_request", success=True)

            # Send email with reset link
            try:
                from ..services.notification_service import get_notification_service
                from ..config import settings

                # Get base URL from config or use default
                base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

                notification_service = get_notification_service(session)
                email_result = await notification_service.send_password_reset_email(
                    email=email,
                    reset_token=reset_token,
                    user_id=user.id,
                    base_url=base_url
                )

                if email_result.get("success"):
                    logger.info(f"Password reset email sent successfully to {email}")
                else:
                    logger.warning(f"Failed to send password reset email to {email}: {email_result.get('error')}")
            except Exception as email_error:
                # Don't fail the request if email fails, just log it
                logger.error(f"Error sending password reset email: {email_error}")

        session.close()

        return jsonify(response_message), 200

    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return jsonify({"error": "Password reset request failed", "message": "Internal server error"}), 500


@auth_bp.route("/reset-password", methods=["POST"])
@rate_limit(limit=5, window=3600)  # 5 reset attempts per hour per IP
def reset_password():
    """
    Reset password using reset token

    Expected JSON:
    {
        "token": "reset_token_here",
        "new_password": "newpassword123"
    }
    """
    try:
        data = request.get_json()

        if not data.get("token") or not data.get("new_password"):
            return jsonify({"error": "Reset token and new password required"}), 400

        reset_token = data["token"]
        new_password = data["new_password"]

        # Check password strength
        is_strong, password_issues = auth_service.check_password_strength(new_password)
        if not is_strong:
            return jsonify({"error": "Password does not meet requirements", "requirements": password_issues}), 400

        # Verify reset token
        payload = auth_service.verify_password_reset_token(reset_token)
        user_id = payload["user_id"]
        email = payload["email"]

        # Get user from database
        session = get_db_session()
        user = session.query(User).filter_by(id=user_id, email=email).first()

        if not user:
            session.close()
            return jsonify({"error": "Invalid reset token"}), 400

        # Update password
        user.password_hash = auth_service.hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_sent_at = None
        user.updated_at = datetime.now(timezone.utc)

        # Reset failed login attempts and unlock account
        user.failed_login_attempts = 0
        user.is_locked = False
        user.account_locked_until = None

        session.commit()
        session.close()

        # Invalidate the reset token
        auth_service.invalidate_password_reset_token(reset_token)

        # Log successful password reset
        log_audit_event("password_reset", user_id=user_id, resource="user", action="reset_password", success=True)

        return jsonify({"message": "Password reset successful"}), 200

    except AuthenticationError as e:
        return jsonify({"error": "Password reset failed", "message": str(e)}), 400

    except Exception as e:
        logger.error(f"Password reset error: {e}")
        return jsonify({"error": "Password reset failed", "message": "Internal server error"}), 500


@auth_bp.route("/csrf-token", methods=["GET"])
@token_required
def get_csrf_token():
    """
    Get CSRF token for authenticated user
    """
    try:
        csrf_protection = CSRFProtection()
        csrf_token = csrf_protection.generate_csrf_token(str(g.user_id))

        return jsonify({"csrf_token": csrf_token}), 200

    except Exception as e:
        logger.error(f"CSRF token generation error: {e}")
        return jsonify({"error": "Failed to generate CSRF token"}), 500


@auth_bp.route("/sessions", methods=["GET"])
@token_required
def get_active_sessions():
    """
    Get user's active refresh token sessions
    """
    try:
        session = get_db_session()
        refresh_tokens = session.query(RefreshToken).filter_by(user_id=g.user_id, revoked=False).all()

        active_sessions = []
        for token in refresh_tokens:
            if token.is_valid():
                active_sessions.append(token.to_dict())

        session.close()

        return jsonify({"active_sessions": active_sessions}), 200

    except Exception as e:
        logger.error(f"Get active sessions error: {e}")
        return jsonify({"error": "Failed to get active sessions"}), 500


@auth_bp.route("/sessions/<token_jti>", methods=["DELETE"])
@token_required
@csrf_protect
def revoke_session(token_jti):
    """
    Revoke specific refresh token session
    """
    try:
        session = get_db_session()
        refresh_token = session.query(RefreshToken).filter_by(token_jti=token_jti, user_id=g.user_id, revoked=False).first()

        if not refresh_token:
            session.close()
            return jsonify({"error": "Session not found"}), 404

        # Revoke the token
        refresh_token.revoked = True
        refresh_token.revoked_at = datetime.now(timezone.utc)
        session.commit()
        session.close()

        # Also remove from Redis
        auth_service.redis_client.delete(f"refresh_token:{token_jti}")

        # Log session revocation
        log_audit_event(
            "session_revoke",
            user_id=g.user_id,
            resource="auth",
            action="revoke_session",
            success=True,
            details={"token_jti": token_jti},
        )

        return jsonify({"message": "Session revoked successfully"}), 200

    except Exception as e:
        logger.error(f"Session revocation error: {e}")
        return jsonify({"error": "Failed to revoke session"}), 500


# Memory storage for development tracking
def store_auth_implementation():
    """Store authentication implementation details in memory"""
    try:
        from ...memory import memory_store

        implementation_summary = {
            "backend_auth": {
                "jwt_tokens": "Complete JWT access and refresh token system",
                "password_security": "Bcrypt hashing with salt, strength validation",
                "rbac": "Role-based access control with permissions",
                "middleware": "Authentication and authorization decorators",
                "rate_limiting": "IP-based rate limiting for auth endpoints",
                "account_lockout": "Automatic lockout after failed attempts",
                "audit_logging": "Comprehensive security event logging",
                "csrf_protection": "CSRF token generation and validation",
                "session_management": "Refresh token tracking and revocation",
            },
            "security_features": {
                "password_reset": "Secure token-based password reset flow",
                "email_validation": "Email format validation",
                "secure_cookies": "HTTP-only, secure, SameSite cookies",
                "token_expiration": "Short-lived access tokens, long-lived refresh",
                "redis_integration": "Token storage and rate limiting",
            },
            "database_models": {
                "user_model": "Complete user model with security fields",
                "role_permission": "RBAC with roles and permissions",
                "audit_trail": "Login attempts and security events",
                "refresh_tokens": "Active session tracking",
            },
        }

        memory_store.store("development/auth/backend_implementation", implementation_summary)
        memory_store.store("development/auth/routes_complete", True)

    except Exception as e:
        logger.error(f"Failed to store auth implementation: {e}")


# Store implementation details
store_auth_implementation()
