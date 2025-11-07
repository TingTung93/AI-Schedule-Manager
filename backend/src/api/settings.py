"""
Settings API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from ..dependencies import get_database_session, get_current_user
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    notifications: Optional[Dict[str, Any]] = None
    appearance: Optional[Dict[str, Any]] = None
    scheduling: Optional[Dict[str, Any]] = None
    security: Optional[Dict[str, Any]] = None

@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get user settings."""
    # TODO: Fetch from database
    return {
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

@router.put("")
async def update_settings(
    settings: SettingsUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Update user settings."""
    # TODO: Save to database
    return {
        "message": "Settings updated successfully",
        "settings": settings.dict(exclude_none=True)
    }
