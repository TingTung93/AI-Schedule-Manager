"""
Notification model for user messaging and alerts
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Notification(Base):
    """Notification system for user alerts and messaging"""

    __tablename__ = "notifications"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Recipient
    user_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)

    # Notification content
    type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)

    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Notification metadata
    data: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, comment="Additional structured data for the notification"
    )

    # Notification status
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Priority and categorization
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False, index=True)

    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Action and linking
    action_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action_text: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Reference to related entities
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    related_entity_id: Mapped[Optional[int]] = mapped_column(nullable=True)

    # Delivery tracking
    delivery_method: Mapped[str] = mapped_column(String(50), default="in_app", nullable=False)

    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    push_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    push_sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Expiration
    expires_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    user: Mapped["Employee"] = relationship("Employee", back_populates="notifications")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            "type IN ('schedule_update', 'shift_assignment', 'shift_change', 'approval_required', 'approval_response', 'rule_violation', 'system_alert', 'reminder', 'announcement')",
            name="valid_notification_type",
        ),
        CheckConstraint("priority IN ('low', 'normal', 'high', 'urgent')", name="valid_priority"),
        CheckConstraint("delivery_method IN ('in_app', 'email', 'push', 'sms', 'all')", name="valid_delivery_method"),
        CheckConstraint("(read = false) OR (read = true AND read_at IS NOT NULL)", name="read_at_required_when_read"),
        CheckConstraint("(expires_at IS NULL) OR (expires_at > created_at)", name="valid_expiration"),
        CheckConstraint(
            "(email_sent = false) OR (email_sent = true AND email_sent_at IS NOT NULL)", name="email_sent_at_required"
        ),
        CheckConstraint(
            "(push_sent = false) OR (push_sent = true AND push_sent_at IS NOT NULL)", name="push_sent_at_required"
        ),
        Index("ix_notifications_user_read", "user_id", "read"),
        Index("ix_notifications_user_type", "user_id", "type"),
        Index("ix_notifications_priority_created", "priority", "created_at"),
        Index("ix_notifications_unread_urgent", "read", "priority", "created_at"),
        Index("ix_notifications_category_created", "category", "created_at"),
        Index("ix_notifications_related_entity", "related_entity_type", "related_entity_id"),
        Index("ix_notifications_expires", "expires_at"),
        Index("ix_notifications_data", "data", postgresql_using="gin"),
    )

    @property
    def is_expired(self) -> bool:
        """Check if notification has expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_urgent(self) -> bool:
        """Check if notification is urgent"""
        return self.priority == "urgent"

    @property
    def age_hours(self) -> float:
        """Get notification age in hours"""
        return (datetime.utcnow() - self.created_at).total_seconds() / 3600

    def mark_as_read(self, read_at: datetime = None) -> None:
        """Mark notification as read"""
        if not self.read:
            self.read = True
            self.read_at = read_at or datetime.utcnow()

    def mark_as_unread(self) -> None:
        """Mark notification as unread"""
        self.read = False
        self.read_at = None

    def should_send_email(self) -> bool:
        """Check if email should be sent for this notification"""
        if self.email_sent:
            return False

        # Send email for urgent notifications or if delivery method includes email
        return self.priority in ["high", "urgent"] or self.delivery_method in ["email", "all"]

    def should_send_push(self) -> bool:
        """Check if push notification should be sent"""
        if self.push_sent:
            return False

        # Send push for urgent notifications or if delivery method includes push
        return self.priority in ["high", "urgent"] or self.delivery_method in ["push", "all"]

    def mark_email_sent(self) -> None:
        """Mark email as sent"""
        self.email_sent = True
        self.email_sent_at = datetime.utcnow()

    def mark_push_sent(self) -> None:
        """Mark push notification as sent"""
        self.push_sent = True
        self.push_sent_at = datetime.utcnow()

    def get_action_data(self) -> dict:
        """Get action data for notification"""
        return {"action_url": self.action_url, "action_text": self.action_text, "has_action": bool(self.action_url)}

    def get_related_entity_info(self) -> Optional[dict]:
        """Get information about related entity"""
        if not self.related_entity_type or not self.related_entity_id:
            return None

        return {"type": self.related_entity_type, "id": self.related_entity_id}

    @classmethod
    def create_schedule_notification(
        cls, user_id: int, schedule_id: int, notification_type: str, title: str, message: str, priority: str = "normal"
    ) -> "Notification":
        """Create a schedule-related notification"""
        return cls(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            priority=priority,
            category="schedule",
            related_entity_type="schedule",
            related_entity_id=schedule_id,
            action_url=f"/schedules/{schedule_id}",
            action_text="View Schedule",
        )

    @classmethod
    def create_shift_assignment_notification(
        cls, user_id: int, assignment_id: int, shift_date: str, shift_time: str, priority: str = "normal"
    ) -> "Notification":
        """Create a shift assignment notification"""
        return cls(
            user_id=user_id,
            type="shift_assignment",
            title="New Shift Assignment",
            message=f"You have been assigned to work on {shift_date} from {shift_time}",
            priority=priority,
            category="assignment",
            related_entity_type="schedule_assignment",
            related_entity_id=assignment_id,
            action_url=f"/assignments/{assignment_id}",
            action_text="View Assignment",
            data={"shift_date": shift_date, "shift_time": shift_time},
        )

    @classmethod
    def create_rule_violation_notification(
        cls, user_id: int, rule_id: int, violation_message: str, assignment_id: int = None
    ) -> "Notification":
        """Create a rule violation notification"""
        return cls(
            user_id=user_id,
            type="rule_violation",
            title="Scheduling Rule Violation",
            message=violation_message,
            priority="high",
            category="compliance",
            related_entity_type="rule",
            related_entity_id=rule_id,
            data={"rule_id": rule_id, "assignment_id": assignment_id, "violation_details": violation_message},
        )

    @classmethod
    def create_approval_notification(cls, user_id: int, schedule_id: int, action_required: str = "approval") -> "Notification":
        """Create an approval required notification"""
        return cls(
            user_id=user_id,
            type="approval_required",
            title="Schedule Approval Required",
            message=f"A schedule requires your {action_required}",
            priority="high",
            category="approval",
            related_entity_type="schedule",
            related_entity_id=schedule_id,
            action_url=f"/schedules/{schedule_id}/approve",
            action_text="Review Schedule",
        )

    @classmethod
    def create_system_alert(
        cls, user_id: int, alert_message: str, priority: str = "normal", category: str = "system"
    ) -> "Notification":
        """Create a system alert notification"""
        return cls(
            user_id=user_id,
            type="system_alert",
            title="System Alert",
            message=alert_message,
            priority=priority,
            category=category,
        )

    def to_dict(self) -> dict:
        """Convert notification to dictionary for API responses"""
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "priority": self.priority,
            "category": self.category,
            "read": self.read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "action": self.get_action_data(),
            "related_entity": self.get_related_entity_info(),
            "data": self.data,
            "age_hours": round(self.age_hours, 1),
            "is_expired": self.is_expired,
            "is_urgent": self.is_urgent,
        }
