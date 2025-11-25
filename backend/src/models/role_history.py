"""
Role Change History Model

Tracks all role assignment changes for comprehensive audit trail.
Implements best practices for audit logging with complete change tracking.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship

from .base import Base


class RoleChangeHistory(Base):
    """
    Track role assignment changes for audit purposes.

    This model provides a complete audit trail of all role changes,
    including who made the change, when it occurred, and why.

    Attributes:
        id: Primary key
        user_id: Reference to the user whose role changed
        old_role: Previous role name (NULL if no previous role)
        new_role: New role name
        changed_by_id: User who made the change
        changed_at: Timestamp of the change
        reason: Optional explanation for the change
        metadata_json: Additional context (JSON format)
    """

    __tablename__ = "role_change_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    old_role = Column(String(50), nullable=True)
    new_role = Column(String(50), nullable=False)
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
    reason = Column(Text, nullable=True)
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
            "old_role": self.old_role,
            "new_role": self.new_role,
            "changed_by_id": self.changed_by_id,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "reason": self.reason,
            "metadata": self.metadata_json or {},
        }

        if camelCase:
            return {
                "id": data["id"],
                "userId": data["user_id"],
                "oldRole": data["old_role"],
                "newRole": data["new_role"],
                "changedById": data["changed_by_id"],
                "changedAt": data["changed_at"],
                "reason": data["reason"],
                "metadata": data["metadata"],
            }

        return data

    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<RoleChangeHistory(id={self.id}, "
            f"user_id={self.user_id}, "
            f"old_role={self.old_role}, "
            f"new_role={self.new_role}, "
            f"changed_at={self.changed_at})>"
        )
