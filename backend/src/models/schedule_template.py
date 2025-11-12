"""
Schedule template model for recurring schedules.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ScheduleTemplate(Base):
    """Schedule template for recurring schedules."""

    __tablename__ = "schedule_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    template_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, camelCase: bool = True) -> dict:
        """Convert to dictionary with optional camelCase."""
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "template_data": self.template_data,
            "active": self.active,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if camelCase:
            return {
                "id": data["id"],
                "name": data["name"],
                "description": data["description"],
                "templateData": data["template_data"],
                "active": data["active"],
                "createdBy": data["created_by"],
                "createdAt": data["created_at"],
                "updatedAt": data["updated_at"],
            }

        return data
