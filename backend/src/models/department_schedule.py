"""
Department schedule models for linking schedules to departments and managing templates.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from ..auth.models import User
    from .department import Department
    from .schedule import Schedule


class DepartmentSchedule(Base):
    """
    Links schedules to departments for better organization and access control.

    This model allows departments to have multiple schedules and tracks which
    schedule is the primary/active one for a department.
    """

    __tablename__ = "department_schedules"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Foreign keys
    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    schedule_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Schedule properties
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    # Relationships
    department: Mapped["Department"] = relationship(
        "Department",
        back_populates="department_schedules"
    )
    schedule: Mapped["Schedule"] = relationship(
        "Schedule",
        back_populates="department_schedules"
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_user_id]
    )

    # Constraints
    __table_args__ = (
        # Unique constraint to prevent duplicate department-schedule pairs
        {'schema': None},
    )

    def to_dict(self, camelCase: bool = True, include_relations: bool = False) -> dict:
        """
        Convert to dictionary for API responses.

        Args:
            camelCase: If True, convert keys to camelCase (default: True)
            include_relations: If True, include related department/schedule data (default: False)

        Returns:
            Dictionary representation of department schedule
        """
        data = {
            "id": self.id,
            "department_id": self.department_id,
            "schedule_id": self.schedule_id,
            "is_primary": self.is_primary,
            "created_by_user_id": self.created_by_user_id,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if include_relations:
            if self.department:
                data["department"] = self.department.to_dict(camelCase=False)
            if self.schedule:
                data["schedule"] = self.schedule.to_dict(camelCase=False, include_assignments=False)
            if self.created_by:
                data["created_by"] = {
                    "id": self.created_by.id,
                    "email": self.created_by.email,
                    "username": self.created_by.username
                }

        if camelCase:
            return {
                "id": data["id"],
                "departmentId": data["department_id"],
                "scheduleId": data["schedule_id"],
                "isPrimary": data["is_primary"],
                "createdByUserId": data["created_by_user_id"],
                "notes": data["notes"],
                "createdAt": data["created_at"],
                "department": data.get("department"),
                "schedule": data.get("schedule"),
                "createdBy": data.get("created_by"),
            }

        return data


class DepartmentScheduleTemplate(Base):
    """
    Store reusable schedule patterns for departments.

    Templates allow departments to quickly create schedules based on common
    patterns like weekly rotations, shift patterns, etc.
    """

    __tablename__ = "department_schedule_templates"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Foreign keys
    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Template properties
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    template_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    pattern_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    rotation_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    department: Mapped["Department"] = relationship(
        "Department",
        back_populates="schedule_templates"
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_user_id]
    )

    def to_dict(self, camelCase: bool = True, include_relations: bool = False) -> dict:
        """
        Convert to dictionary for API responses.

        Args:
            camelCase: If True, convert keys to camelCase (default: True)
            include_relations: If True, include related department data (default: False)

        Returns:
            Dictionary representation of schedule template
        """
        data = {
            "id": self.id,
            "department_id": self.department_id,
            "name": self.name,
            "description": self.description,
            "template_data": self.template_data,
            "pattern_type": self.pattern_type,
            "rotation_days": self.rotation_days,
            "is_active": self.is_active,
            "created_by_user_id": self.created_by_user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_relations:
            if self.department:
                data["department"] = self.department.to_dict(camelCase=False)
            if self.created_by:
                data["created_by"] = {
                    "id": self.created_by.id,
                    "email": self.created_by.email,
                    "username": self.created_by.username
                }

        if camelCase:
            return {
                "id": data["id"],
                "departmentId": data["department_id"],
                "name": data["name"],
                "description": data["description"],
                "templateData": data["template_data"],
                "patternType": data["pattern_type"],
                "rotationDays": data["rotation_days"],
                "isActive": data["is_active"],
                "createdByUserId": data["created_by_user_id"],
                "createdAt": data["created_at"],
                "updatedAt": data["updated_at"],
                "department": data.get("department"),
                "createdBy": data.get("created_by"),
            }

        return data
