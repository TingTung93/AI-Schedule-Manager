"""
Account Status History Model

Tracks all account status changes for comprehensive audit trail.
Records changes to is_active, is_locked, and is_verified flags.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from .base import Base


class AccountStatusHistory(Base):
    """
    Track account status changes for security audit purposes.

    This model provides a complete audit trail of all account status changes,
    including who made the change, when it occurred, and why. Supports tracking
    of is_active, is_locked, and is_verified status changes.

    Attributes:
        id: Primary key
        user_id: Reference to the user whose status changed
        old_status: Previous status value (JSON: {is_active, is_locked, is_verified})
        new_status: New status value
        changed_by_id: User who made the change
        changed_at: Timestamp of the change
        reason: Required explanation for status changes
        metadata_json: Additional context (JSON format)
    """

    __tablename__ = "account_status_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    old_status = Column(String(50), nullable=True)  # Status type: active, locked, verified
    new_status = Column(String(50), nullable=False)  # New status value
    changed_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        index=True
    )
    changed_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        index=True
    )
    reason = Column(Text, nullable=True)  # Optional explanation
    metadata_json = Column(JSON, nullable=True, default={})

    def to_dict(self, camelCase: bool = True) -> dict:
        """
        Convert history record to dictionary.

        Args:
            camelCase: Whether to use camelCase keys (default: True)

        Returns:
            Dictionary representation of the history record
        """
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "changed_by_id": self.changed_by_id,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "reason": self.reason,
            "metadata": self.metadata_json or {},
        }

        if camelCase:
            return {
                "id": data["id"],
                "userId": data["user_id"],
                "oldStatus": data["old_status"],
                "newStatus": data["new_status"],
                "changedById": data["changed_by_id"],
                "changedAt": data["changed_at"],
                "reason": data["reason"],
                "metadata": data["metadata"],
            }

        return data

    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<AccountStatusHistory(id={self.id}, "
            f"user_id={self.user_id}, "
            f"old_status={self.old_status}, "
            f"new_status={self.new_status}, "
            f"changed_at={self.changed_at})>"
        )
