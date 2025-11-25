"""
Password Management Endpoints

Separate module for password reset and change functionality to keep employees.py cleaner.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
import bcrypt
import secrets
import string

from ..dependencies import get_current_user, get_database_session, require_roles
from ..auth.models import User
from ..models.password_history import PasswordHistory
from ..schemas import (
    ResetPasswordRequest,
    PasswordResponse,
    ChangePasswordRequest,
    ChangePasswordResponse
)

router = APIRouter(prefix="/api/employees", tags=["employees", "password-management"])
limiter = Limiter(key_func=get_remote_address)


def generate_secure_password_util(length: int = 12) -> str:
    """
    Generate a cryptographically secure random password.

    Creates a password that meets complexity requirements:
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character

    Args:
        length: Password length (minimum 12)

    Returns:
        Secure random password string
    """
    if length < 12:
        length = 12

    # Define character sets
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()_+-=[]{}|;:,.<>?"

    # Ensure at least one character from each set
    password_chars = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special)
    ]

    # Fill remaining length with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    password_chars.extend(secrets.choice(all_chars) for _ in range(length - 4))

    # Shuffle to avoid predictable patterns
    shuffled = password_chars.copy()
    for i in range(len(shuffled) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]

    return ''.join(shuffled)


async def check_password_history_util(
    db: AsyncSession,
    user_id: int,
    new_password: str,
    history_limit: int = 5
) -> bool:
    """
    Check if password was used in recent history.

    Args:
        db: Database session
        user_id: User ID to check
        new_password: New password to validate
        history_limit: Number of previous passwords to check

    Returns:
        True if password is reused, False if password is unique
    """
    # Get recent password history
    history_query = (
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user_id)
        .order_by(desc(PasswordHistory.changed_at))
        .limit(history_limit)
    )

    result = await db.execute(history_query)
    history_records = result.scalars().all()

    # Check if new password matches any in history
    new_password_bytes = new_password.encode('utf-8')
    for record in history_records:
        if bcrypt.checkpw(new_password_bytes, record.password_hash.encode('utf-8')):
            return True  # Password is reused

    return False  # Password is unique


async def save_password_to_history_util(
    db: AsyncSession,
    user_id: int,
    password_hash: str,
    change_method: str = 'self_change',
    changed_by_user_id: Optional[int] = None,
    ip_address: Optional[str] = None
) -> PasswordHistory:
    """
    Save password to history for tracking.

    Args:
        db: Database session
        user_id: User ID
        password_hash: Hashed password
        change_method: How password was changed ('reset', 'self_change', 'admin_change')
        changed_by_user_id: ID of user who initiated change
        ip_address: IP address of change request

    Returns:
        Created password history record
    """
    history_record = PasswordHistory(
        user_id=user_id,
        password_hash=password_hash,
        changed_at=datetime.now(timezone.utc),
        change_method=change_method,
        changed_by_user_id=changed_by_user_id,
        ip_address=ip_address
    )

    db.add(history_record)
    await db.flush()

    return history_record


@router.post(
    "/{employee_id}/reset-password",
    response_model=PasswordResponse,
    dependencies=[Depends(require_roles("admin"))]
)
@limiter.limit("5/minute")
async def reset_employee_password(
    request: Request,
    employee_id: int,
    reset_request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Reset employee password (admin only).

    Generates a secure random password, resets the employee's password,
    and marks the account to require password change on next login.

    Authorization:
    - Required role: admin only

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Request Body:
    - **send_email**: Whether to send password via email (default: False)

    Returns:
        Password reset response with temporary password (one-time display)

    Raises:
        404: Employee not found
        500: Server error

    Security Notes:
    - Password is only shown once in response
    - Account is flagged to require password change
    - Password history is tracked
    """
    try:
        # Find user
        result = await db.execute(select(User).where(User.id == employee_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        # Generate secure random password
        temp_password = generate_secure_password_util(length=12)

        # Hash password
        password_bytes = temp_password.encode('utf-8')
        password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        # Save current password to history before changing
        if user.password_hash:
            await save_password_to_history_util(
                db=db,
                user_id=employee_id,
                password_hash=user.password_hash,
                change_method='admin_reset',
                changed_by_user_id=current_user.id,
                ip_address=request.client.host if request.client else None
            )

        # Update user password
        user.password_hash = password_hash
        user.password_must_change = True
        user.password_changed_at = datetime.now(timezone.utc)

        await db.commit()

        # TODO: If send_email is True, send email notification
        # This would require email service integration

        import logging
        logger = logging.getLogger(__name__)
        logger.info(
            f"Password reset for employee {employee_id} by admin {current_user.id}",
            extra={"employee_id": employee_id, "admin_id": current_user.id}
        )

        return PasswordResponse(
            message="Password successfully reset. Employee must change password on next login.",
            temporary_password=temp_password,
            password_must_change=True,
            employee_id=employee_id,
            employee_email=user.email
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error resetting password for employee {employee_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )


@router.patch(
    "/{employee_id}/change-password",
    response_model=ChangePasswordResponse
)
@limiter.limit("5/minute")
async def change_employee_password(
    request: Request,
    employee_id: int,
    password_change: ChangePasswordRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Change employee password.

    Allows employees to change their own password (with old password verification)
    or admins to change any employee's password.

    Authorization:
    - Employees: Can only change their own password (requires old_password)
    - Admins: Can change any employee's password (old_password optional)

    Path Parameters:
    - **employee_id**: Unique employee identifier

    Request Body:
    - **old_password**: Current password (required for self-service)
    - **new_password**: New password (8+ chars, uppercase, lowercase, digit, special)
    - **confirm_password**: Password confirmation (must match new_password)

    Returns:
        Success response with password change timestamp

    Raises:
        401: Invalid old password
        400: Password validation failed or password reuse detected
        403: Access denied
        404: Employee not found
        500: Server error

    Security Notes:
    - Enforces password complexity requirements
    - Prevents reuse of last 5 passwords
    - Tracks password change history
    """
    try:
        # Find user
        result = await db.execute(select(User).where(User.id == employee_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID {employee_id} not found"
            )

        # Check authorization
        user_roles_list = [role.name for role in current_user.roles]
        is_admin = "admin" in user_roles_list
        is_self = employee_id == current_user.id

        # Non-admins can only change their own password
        if not is_admin and not is_self:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only change your own password."
            )

        # Verify old password for self-service changes
        if is_self and not is_admin:
            if not password_change.old_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Old password is required to change your password."
                )

            # Verify old password
            old_password_bytes = password_change.old_password.encode('utf-8')
            if not bcrypt.checkpw(old_password_bytes, user.password_hash.encode('utf-8')):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid old password."
                )

        # Check password history (prevent reuse of last 5 passwords)
        is_reused = await check_password_history_util(
            db=db,
            user_id=employee_id,
            new_password=password_change.new_password,
            history_limit=5
        )

        if is_reused:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password was recently used. Please choose a different password."
            )

        # Save current password to history
        if user.password_hash:
            await save_password_to_history_util(
                db=db,
                user_id=employee_id,
                password_hash=user.password_hash,
                change_method='self_change' if is_self else 'admin_change',
                changed_by_user_id=current_user.id,
                ip_address=request.client.host if request.client else None
            )

        # Hash new password
        new_password_bytes = password_change.new_password.encode('utf-8')
        new_password_hash = bcrypt.hashpw(new_password_bytes, bcrypt.gensalt()).decode('utf-8')

        # Update user password
        user.password_hash = new_password_hash
        user.password_must_change = False  # Clear force change flag
        user.password_changed_at = datetime.now(timezone.utc)

        await db.commit()

        import logging
        logger = logging.getLogger(__name__)
        logger.info(
            f"Password changed for employee {employee_id} by user {current_user.id}",
            extra={"employee_id": employee_id, "changed_by": current_user.id, "is_self": is_self}
        )

        return ChangePasswordResponse(
            message="Password successfully changed.",
            password_changed_at=user.password_changed_at,
            employee_id=employee_id
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error changing password for employee {employee_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to change password: {str(e)}"
        )
