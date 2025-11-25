"""
Password History Model

Tracks password changes for users to enforce password history policies
and prevent password reuse.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from .base import Base


class PasswordHistory(Base):
    """
    Model to track password change history for security compliance

    Prevents users from reusing recent passwords and maintains
    an audit trail of password changes for security monitoring.
    """

    __tablename__ = "password_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # Timestamp for when this password was set
    changed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    # Optional metadata about the change
    change_method = Column(String(50))  # 'reset', 'self_change', 'admin_change'
    changed_by_user_id = Column(Integer, ForeignKey("users.id"))  # Who initiated the change
    ip_address = Column(String(45))  # IPv6 compatible

    def __repr__(self):
        return f"<PasswordHistory user_id={self.user_id} changed_at={self.changed_at}>"

    def to_dict(self):
        """Convert to dictionary (excluding password hash for security)"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "change_method": self.change_method,
            "changed_by_user_id": self.changed_by_user_id,
            "ip_address": self.ip_address
        }


# Create composite index for efficient queries
Index(
    "idx_password_history_user_time",
    PasswordHistory.user_id,
    PasswordHistory.changed_at.desc()
)
