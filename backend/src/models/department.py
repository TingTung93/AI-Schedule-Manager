"""
Department model with hierarchical support.
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Department(Base):
    """Department model with hierarchical support."""

    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default={})
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Self-referential relationship for hierarchy
    parent: Mapped[Optional["Department"]] = relationship(
        "Department", remote_side=[id], back_populates="children", foreign_keys=[parent_id]
    )
    children: Mapped[List["Department"]] = relationship(
        "Department", back_populates="parent", foreign_keys=[parent_id], cascade="all, delete-orphan"
    )

    # Relationships to other models
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="department")
    shifts: Mapped[List["Shift"]] = relationship("Shift", back_populates="department")
    shift_definitions: Mapped[List["ShiftDefinition"]] = relationship("ShiftDefinition", back_populates="department")
    department_schedules: Mapped[List["DepartmentSchedule"]] = relationship("DepartmentSchedule", back_populates="department")
    schedule_templates: Mapped[List["DepartmentScheduleTemplate"]] = relationship("DepartmentScheduleTemplate", back_populates="department")

    def to_dict(self, camelCase: bool = True) -> dict:
        """Convert to dictionary with optional camelCase."""
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "parent_id": self.parent_id,
            "settings": self.settings,
            "active": self.active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if camelCase:
            return {
                "id": data["id"],
                "name": data["name"],
                "description": data["description"],
                "parentId": data["parent_id"],
                "settings": data["settings"],
                "active": data["active"],
                "createdAt": data["created_at"],
                "updatedAt": data["updated_at"],
            }

        return data
