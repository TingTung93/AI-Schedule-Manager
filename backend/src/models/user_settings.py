"""
UserSettings model for storing user preferences and configuration
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base


class UserSettings(Base):
    """User settings model for storing preferences and configuration"""

    __tablename__ = "user_settings"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Foreign key to user/employee
    user_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    # Notification settings
    notifications: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default={"email": True, "push": False, "scheduleReminders": True, "overtimeAlerts": True}
    )

    # Appearance settings
    appearance: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default={"theme": "light", "language": "en", "timezone": "America/New_York"}
    )

    # Scheduling preferences
    scheduling: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default={"defaultShiftLength": 8, "maxOvertimeHours": 10, "breakDuration": 30, "autoApproveRequests": False},
    )

    # Security settings
    security: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default={"twoFactorAuth": False, "sessionTimeout": 60}
    )

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user: Mapped["Employee"] = relationship("Employee", back_populates="settings")

    # Constraints and indexes
    __table_args__ = (
        Index("ix_user_settings_user_id", "user_id"),
        Index("ix_user_settings_notifications", "notifications", postgresql_using="gin"),
        Index("ix_user_settings_appearance", "appearance", postgresql_using="gin"),
    )

    def get_notification_preference(self, key: str, default: bool = True) -> bool:
        """Get specific notification preference"""
        if not self.notifications:
            return default
        return self.notifications.get(key, default)

    def get_appearance_preference(self, key: str, default: str = "") -> str:
        """Get specific appearance preference"""
        if not self.appearance:
            return default
        return self.appearance.get(key, default)

    def get_scheduling_preference(self, key: str, default=None):
        """Get specific scheduling preference"""
        if not self.scheduling:
            return default
        return self.scheduling.get(key, default)

    def get_security_preference(self, key: str, default=None):
        """Get specific security preference"""
        if not self.security:
            return default
        return self.security.get(key, default)

    def update_notifications(self, **kwargs) -> None:
        """Update notification preferences"""
        if self.notifications is None:
            self.notifications = {}
        self.notifications.update(kwargs)

    def update_appearance(self, **kwargs) -> None:
        """Update appearance preferences"""
        if self.appearance is None:
            self.appearance = {}
        self.appearance.update(kwargs)

    def update_scheduling(self, **kwargs) -> None:
        """Update scheduling preferences"""
        if self.scheduling is None:
            self.scheduling = {}
        self.scheduling.update(kwargs)

    def update_security(self, **kwargs) -> None:
        """Update security preferences"""
        if self.security is None:
            self.security = {}
        self.security.update(kwargs)
