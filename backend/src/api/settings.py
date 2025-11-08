"""
Settings API endpoints with database persistence
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..dependencies import get_database_session, get_current_user
from ..models import UserSettings
from ..schemas import UserSettingsResponse, MessageResponse, SettingsUpdateResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    notifications: Optional[Dict[str, Any]] = None
    appearance: Optional[Dict[str, Any]] = None
    scheduling: Optional[Dict[str, Any]] = None
    security: Optional[Dict[str, Any]] = None

# Default settings to use when no user settings exist
DEFAULT_SETTINGS = {
    "notifications": {
        "email": True,
        "push": False,
        "scheduleReminders": True,
        "overtimeAlerts": True
    },
    "appearance": {
        "theme": "light",
        "language": "en",
        "timezone": "America/New_York"
    },
    "scheduling": {
        "defaultShiftLength": 8,
        "maxOvertimeHours": 10,
        "breakDuration": 30,
        "autoApproveRequests": False
    },
    "security": {
        "twoFactorAuth": False,
        "sessionTimeout": 60
    }
}

@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get user settings from database."""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token"
        )

    # Query user settings from database
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Return defaults if no settings exist yet
        return DEFAULT_SETTINGS

    # Return actual settings from database
    return {
        "notifications": settings.notifications or DEFAULT_SETTINGS["notifications"],
        "appearance": settings.appearance or DEFAULT_SETTINGS["appearance"],
        "scheduling": settings.scheduling or DEFAULT_SETTINGS["scheduling"],
        "security": settings.security or DEFAULT_SETTINGS["security"]
    }

@router.put("", response_model=SettingsUpdateResponse)
async def update_settings(
    settings_update: SettingsUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Update user settings in database with proper persistence."""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token"
        )

    # Check if user settings already exist
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        # Create new settings record with defaults
        settings = UserSettings(
            user_id=user_id,
            notifications=settings_update.notifications or DEFAULT_SETTINGS["notifications"],
            appearance=settings_update.appearance or DEFAULT_SETTINGS["appearance"],
            scheduling=settings_update.scheduling or DEFAULT_SETTINGS["scheduling"],
            security=settings_update.security or DEFAULT_SETTINGS["security"]
        )
        db.add(settings)
    else:
        # Update existing settings - merge with existing values
        if settings_update.notifications is not None:
            current_notifications = settings.notifications or {}
            current_notifications.update(settings_update.notifications)
            settings.notifications = current_notifications

        if settings_update.appearance is not None:
            current_appearance = settings.appearance or {}
            current_appearance.update(settings_update.appearance)
            settings.appearance = current_appearance

        if settings_update.scheduling is not None:
            current_scheduling = settings.scheduling or {}
            current_scheduling.update(settings_update.scheduling)
            settings.scheduling = current_scheduling

        if settings_update.security is not None:
            current_security = settings.security or {}
            current_security.update(settings_update.security)
            settings.security = current_security

    # Commit changes to database
    await db.commit()
    await db.refresh(settings)

    return {
        "message": "Settings updated successfully",
        "settings": {
            "notifications": settings.notifications,
            "appearance": settings.appearance,
            "scheduling": settings.scheduling,
            "security": settings.security
        }
    }
