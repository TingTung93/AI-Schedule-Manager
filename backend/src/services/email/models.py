"""
Email service database models.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class EmailStatus(Enum):
    """Email status enumeration."""

    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    BOUNCED = "bounced"
    FAILED = "failed"
    UNSUBSCRIBED = "unsubscribed"


class NotificationType(Enum):
    """Notification type enumeration."""

    WELCOME = "welcome"
    PASSWORD_RESET = "password_reset"
    SCHEDULE_NOTIFICATION = "schedule_notification"
    SHIFT_REMINDER = "shift_reminder"
    SCHEDULE_CHANGE = "schedule_change"
    WEEKLY_SUMMARY = "weekly_summary"
    SYSTEM_ALERT = "system_alert"
    CUSTOM = "custom"


class EmailFrequency(Enum):
    """Email frequency options."""

    IMMEDIATE = "immediate"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    NEVER = "never"


class EmailTemplate(Base):
    """Email template model."""

    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    subject = Column(String(255), nullable=False)
    html_content = Column(Text, nullable=False)
    text_content = Column(Text)
    template_type = Column(String(50), nullable=False)
    language = Column(String(10), default="en")
    is_active = Column(Boolean, default=True)
    variables = Column(JSON)  # Template variable definitions

    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(Integer, ForeignKey("users.id"))
    version = Column(Integer, default=1)

    # Relationships
    email_logs = relationship("EmailLog", back_populates="template")

    __table_args__ = (
        Index("idx_template_type_language", "template_type", "language"),
        Index("idx_template_active", "is_active"),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "subject": self.subject,
            "template_type": self.template_type,
            "language": self.language,
            "is_active": self.is_active,
            "variables": self.variables,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "version": self.version,
        }


class EmailLog(Base):
    """Email sending log model."""

    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True)
    message_id = Column(String(255), unique=True, nullable=False)

    # Recipients
    to_email = Column(String(255), nullable=False)
    to_name = Column(String(255))
    cc = Column(JSON)  # List of CC emails
    bcc = Column(JSON)  # List of BCC emails

    # Content
    subject = Column(String(500), nullable=False)
    html_content = Column(Text)
    text_content = Column(Text)

    # Template info
    template_id = Column(Integer, ForeignKey("email_templates.id"))
    template_variables = Column(JSON)

    # Status tracking
    status = Column(String(20), default=EmailStatus.PENDING.value)
    provider_response = Column(JSON)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)

    # Tracking
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    opened_at = Column(DateTime)
    clicked_at = Column(DateTime)
    bounced_at = Column(DateTime)
    unsubscribed_at = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    user_id = Column(Integer, ForeignKey("users.id"))
    priority = Column(Integer, default=0)
    scheduled_at = Column(DateTime)

    # Relationships
    template = relationship("EmailTemplate", back_populates="email_logs")

    __table_args__ = (
        Index("idx_email_log_status", "status"),
        Index("idx_email_log_to_email", "to_email"),
        Index("idx_email_log_created_at", "created_at"),
        Index("idx_email_log_scheduled_at", "scheduled_at"),
        Index("idx_email_log_user_id", "user_id"),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "message_id": self.message_id,
            "to_email": self.to_email,
            "to_name": self.to_name,
            "subject": self.subject,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "clicked_at": self.clicked_at.isoformat() if self.clicked_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "retry_count": self.retry_count,
            "priority": self.priority,
        }


class NotificationPreference(Base):
    """User notification preferences model."""

    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # General preferences
    email_enabled = Column(Boolean, default=True)
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")

    # Notification types
    welcome_emails = Column(Boolean, default=True)
    password_reset_emails = Column(Boolean, default=True)
    schedule_notifications = Column(Boolean, default=True)
    shift_reminders = Column(Boolean, default=True)
    schedule_changes = Column(Boolean, default=True)
    weekly_summaries = Column(Boolean, default=True)
    system_alerts = Column(Boolean, default=True)
    marketing_emails = Column(Boolean, default=False)

    # Frequency settings
    schedule_notification_frequency = Column(String(20), default=EmailFrequency.IMMEDIATE.value)
    summary_frequency = Column(String(20), default=EmailFrequency.WEEKLY.value)
    reminder_frequency = Column(String(20), default=EmailFrequency.DAILY.value)

    # Timing preferences
    quiet_hours_start = Column(String(5))  # HH:MM format
    quiet_hours_end = Column(String(5))  # HH:MM format
    preferred_send_time = Column(String(5))  # HH:MM format

    # Unsubscribe tracking
    unsubscribe_token = Column(String(255), unique=True)
    unsubscribed_at = Column(DateTime)
    unsubscribe_reason = Column(Text)

    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_notification_preferences_user"),
        Index("idx_notification_preferences_user_id", "user_id"),
        Index("idx_notification_preferences_unsubscribe_token", "unsubscribe_token"),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "email_enabled": self.email_enabled,
            "timezone": self.timezone,
            "language": self.language,
            "welcome_emails": self.welcome_emails,
            "password_reset_emails": self.password_reset_emails,
            "schedule_notifications": self.schedule_notifications,
            "shift_reminders": self.shift_reminders,
            "schedule_changes": self.schedule_changes,
            "weekly_summaries": self.weekly_summaries,
            "system_alerts": self.system_alerts,
            "marketing_emails": self.marketing_emails,
            "schedule_notification_frequency": self.schedule_notification_frequency,
            "summary_frequency": self.summary_frequency,
            "reminder_frequency": self.reminder_frequency,
            "quiet_hours_start": self.quiet_hours_start,
            "quiet_hours_end": self.quiet_hours_end,
            "preferred_send_time": self.preferred_send_time,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class EmailBounce(Base):
    """Email bounce tracking model."""

    __tablename__ = "email_bounces"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False)
    bounce_type = Column(String(50))  # hard, soft, complaint
    bounce_reason = Column(Text)
    bounce_count = Column(Integer, default=1)
    last_bounce_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_suppressed = Column(Boolean, default=False)
    suppressed_at = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_email_bounce_email", "email"),
        Index("idx_email_bounce_suppressed", "is_suppressed"),
    )


class EmailCampaign(Base):
    """Email campaign model for batch sending."""

    __tablename__ = "email_campaigns"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=False)

    # Targeting
    target_criteria = Column(JSON)  # User filtering criteria
    recipient_count = Column(Integer, default=0)

    # Scheduling
    scheduled_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Status
    status = Column(String(20), default="draft")  # draft, scheduled, sending, completed, failed

    # Stats
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    clicked_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    unsubscribed_count = Column(Integer, default=0)

    # A/B Testing
    is_ab_test = Column(Boolean, default=False)
    ab_test_percentage = Column(Integer)  # Percentage for A variant
    ab_winner_template_id = Column(Integer, ForeignKey("email_templates.id"))

    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(Integer, ForeignKey("users.id"))

    __table_args__ = (
        Index("idx_email_campaign_status", "status"),
        Index("idx_email_campaign_scheduled_at", "scheduled_at"),
    )
