"""
Department Assignment History Model

Tracks all department assignment changes for comprehensive audit trail.
Implements best practices for audit logging with complete change tracking.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class DepartmentAssignmentHistory(Base):
    """
    Track department assignment changes for audit purposes.

    This model provides a complete audit trail of all department assignments,
    including who made the change, when it occurred, and why.

    Attributes:
        id: Primary key
        employee_id: Reference to the employee (User)
        from_department_id: Previous department (NULL if unassigned)
        to_department_id: New department (NULL if being unassigned)
        changed_by_user_id: User who made the change
        changed_at: Timestamp of the change
        change_reason: Optional explanation for the change
        change_metadata: Additional context (JSON format)
    """

    __tablename__ = "department_assignment_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    from_department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True
    )
    to_department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True
    )
    changed_by_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        index=True
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        index=True
    )
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    change_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default={})

    # Relationships with explicit foreign_keys to avoid ambiguity
    # Using selectinload for optimal performance
    from_department: Mapped[Optional["Department"]] = relationship(
        "Department",
        foreign_keys=[from_department_id],
        lazy="selectin"
    )
    to_department: Mapped[Optional["Department"]] = relationship(
        "Department",
        foreign_keys=[to_department_id],
        lazy="selectin"
    )
    employee: Mapped["User"] = relationship(
        "User",
        foreign_keys=[employee_id],
        lazy="selectin"
    )
    changed_by_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[changed_by_user_id],
        lazy="selectin"
    )

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
            "employee_id": self.employee_id,
            "from_department_id": self.from_department_id,
            "to_department_id": self.to_department_id,
            "changed_by_user_id": self.changed_by_user_id,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "change_reason": self.change_reason,
            "change_metadata": self.change_metadata or {},
        }

        if camelCase:
            return {
                "id": data["id"],
                "employeeId": data["employee_id"],
                "fromDepartmentId": data["from_department_id"],
                "toDepartmentId": data["to_department_id"],
                "changedByUserId": data["changed_by_user_id"],
                "changedAt": data["changed_at"],
                "changeReason": data["change_reason"],
                "changeMetadata": data["change_metadata"],
            }

        return data

    def __repr__(self) -> str:
        """String representation for debugging."""
        return (
            f"<DepartmentAssignmentHistory(id={self.id}, "
            f"employee_id={self.employee_id}, "
            f"from_dept={self.from_department_id}, "
            f"to_dept={self.to_department_id}, "
            f"changed_at={self.changed_at})>"
        )
