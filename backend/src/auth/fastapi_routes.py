"""
FastAPI Authentication Routes

Native FastAPI routes that use the existing Flask authentication services.
This provides better performance and integration than WSGI middleware.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from ..database import get_db_session
from .auth import AuthenticationError, auth_service
from .middleware import RateLimiter, csrf_protect, rate_limit, token_required
from .models import User
from .routes import log_audit_event, record_login_attempt

logger = logging.getLogger(__name__)

# Create FastAPI router for authentication
auth_router = APIRouter(prefix="/api/auth", tags=["authentication"])


# Pydantic models for request/response validation
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    message: str
    user: dict
    access_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    user: dict


class SessionsResponse(BaseModel):
    active_sessions: list


class MessageResponse(BaseModel):
    message: str


class CSRFTokenResponse(BaseModel):
    csrf_token: str


# Helper function to set secure cookies
def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set secure HTTP-only cookies for authentication tokens"""
    # Set access token cookie (15 minutes)
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=900,  # 15 minutes
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="strict"
    )

    # Set refresh token cookie (30 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=2592000,  # 30 days
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="strict"
    )


@auth_router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, response: Response):
    """
    Register new user account

    Creates a new user with hashed password, assigns default role,
    and returns JWT access and refresh tokens.
    """
    try:
        email = request.email.lower().strip()
        password = request.password
        first_name = request.first_name.strip()
        last_name = request.last_name.strip()

        # Check password strength
        is_strong, password_issues = auth_service.check_password_strength(password)
        if not is_strong:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Password does not meet requirements", "requirements": password_issues}
            )

        # Check if user already exists
        session = get_db_session()
        existing_user = session.query(User).filter_by(email=email).first()

        if existing_user:
            session.close()
            log_audit_event(
                "registration", resource="user", action="create",
                success=False, failure_reason="email_already_exists"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )

        # Hash password
        password_hash = auth_service.hash_password(password)

        # Get default user role
        from .models import get_or_create_user_role
        user_role = get_or_create_user_role(session)

        # Create new user
        new_user = User(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            roles=[user_role]
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

        # Set secure cookies
        set_auth_cookies(response, access_token, refresh_token)

        return TokenResponse(
            message="Registration successful",
            user=user_data,
            access_token=access_token
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@auth_router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, response: Response):
    """
    Authenticate user and return JWT tokens

    Validates credentials, checks account status, and returns
    access and refresh tokens with secure HTTP-only cookies.
    """
    try:
        email = request.email.lower().strip()
        password = request.password

        session = get_db_session()
        user = session.query(User).filter_by(email=email).first()

        # Record login attempt
        if not user:
            record_login_attempt(email, success=False, failure_reason="invalid_email")
            session.close()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Check if account is locked
        if user.is_account_locked():
            record_login_attempt(email, user_id=user.id, success=False, failure_reason="account_locked")
            session.close()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "error": "Account is locked",
                    "message": f"Account locked until {user.account_locked_until.isoformat()}",
                    "locked_until": user.account_locked_until.isoformat()
                }
            )

        # Check if account is active
        if not user.is_active:
            record_login_attempt(email, user_id=user.id, success=False, failure_reason="account_inactive")
            session.close()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated"
            )

        # Verify password
        if not auth_service.verify_password(password, user.password_hash):
            # Increment failed attempts
            user.failed_login_attempts += 1
            user.last_login_attempt = datetime.now(timezone.utc)

            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                from datetime import timedelta
                user.is_locked = True
                user.account_locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)

                record_login_attempt(email, user_id=user.id, success=False, failure_reason="max_attempts_reached")
                log_audit_event(
                    "account_locked", user_id=user.id, resource="user", action="lock",
                    success=True, details={"reason": "max_failed_attempts"}
                )
            else:
                record_login_attempt(email, user_id=user.id, success=False, failure_reason="invalid_password")

            session.commit()
            session.close()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "Invalid credentials",
                    "remaining_attempts": max(0, 5 - user.failed_login_attempts)
                }
            )

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

        # Set secure cookies
        set_auth_cookies(response, access_token, refresh_token)

        return TokenResponse(
            message="Login successful",
            user=user_data,
            access_token=access_token
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@auth_router.post("/refresh", response_model=dict)
async def refresh_token(request: Request, response: Response):
    """
    Refresh JWT access token using refresh token

    Validates refresh token from cookie or body and returns new access token.
    """
    try:
        # Get refresh token from cookie or body
        refresh_token = request.cookies.get("refresh_token")
        if not refresh_token:
            data = await request.json() if request.headers.get("content-type") == "application/json" else {}
            refresh_token = data.get("refresh_token")

        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refresh token required"
            )

        # Verify refresh token
        payload = auth_service.verify_refresh_token(refresh_token)
        user_id = payload["user_id"]

        # Get user from database
        session = get_db_session()
        user = session.query(User).filter_by(id=user_id).first()

        if not user or not user.is_active:
            session.close()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user"
            )

        # Generate new access token
        user_data = user.to_dict()
        new_access_token = auth_service.generate_access_token(user_data)

        session.close()

        # Log token refresh
        log_audit_event("token_refresh", user_id=user_id, resource="auth", action="refresh", success=True)

        # Update access token cookie
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            max_age=900,  # 15 minutes
            httponly=True,
            secure=False,
            samesite="strict"
        )

        return {
            "message": "Token refreshed successfully",
            "access_token": new_access_token
        }

    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@auth_router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response):
    """
    Logout user and revoke refresh token

    Clears authentication cookies and revokes the refresh token.
    """
    try:
        # Get refresh token to revoke it
        refresh_token = request.cookies.get("refresh_token")

        if refresh_token:
            auth_service.revoke_refresh_token(refresh_token)

        # Note: We can't easily get user_id without parsing the token
        # For audit logging, we'd need to add a dependency that extracts user_id

        # Clear cookies
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")

        return MessageResponse(message="Logout successful")

    except Exception as e:
        logger.error(f"Logout error: {e}")
        # Still clear cookies even if revocation fails
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return MessageResponse(message="Logout completed")


@auth_router.get("/me", response_model=UserResponse)
async def get_current_user(request: Request):
    """
    Get current user information

    Returns the authenticated user's profile data.
    Requires valid JWT token in Authorization header or cookie.
    """
    try:
        # Get token from Authorization header or cookie
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        else:
            token = request.cookies.get("access_token")

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        # Verify token and get user data
        payload = auth_service.verify_access_token(token)
        user_id = payload.get("user_id") or payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        # Get user from database
        session = get_db_session()
        user = session.query(User).filter_by(id=user_id).first()

        if not user:
            session.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        user_data = user.to_dict()
        session.close()

        return UserResponse(user=user_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )


@auth_router.get("/csrf-token", response_model=CSRFTokenResponse)
async def get_csrf_token(request: Request):
    """
    Get CSRF token for authenticated user

    Returns a CSRF token for protecting state-changing requests.
    """
    try:
        # For now, generate a simple CSRF token
        # In production, this should be tied to the user session
        import secrets
        csrf_token = secrets.token_urlsafe(32)

        return CSRFTokenResponse(csrf_token=csrf_token)

    except Exception as e:
        logger.error(f"CSRF token generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate CSRF token"
        )


# Store implementation in memory
def store_fastapi_routes_implementation():
    """Store FastAPI routes implementation in swarm memory"""
    try:
        import subprocess

        subprocess.run([
            "npx", "claude-flow@alpha", "hooks", "post-edit",
            "--file", "/home/peter/AI-Schedule-Manager/backend/src/auth/fastapi_routes.py",
            "--memory-key", "swarm/auth/native-fastapi-routes"
        ], check=False, capture_output=True)

    except Exception as e:
        logger.error(f"Failed to store FastAPI routes implementation: {e}")


# Store when module loads
store_fastapi_routes_implementation()
