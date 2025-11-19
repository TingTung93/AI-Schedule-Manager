"""
Shift Definition model for reusable shift templates (e.g., AM, PM, Night shifts)
"""

from datetime import datetime, time
from typing import Optional

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Numeric, String, Time, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ShiftDefinition(Base):
    """
    Shift Definition model for reusable shift templates.

    This represents a template for shifts (e.g., "AM Shift", "PM Shift", "Night Shift")
    that can be used to create actual shift instances in schedules.

    Unlike the Shift model which represents specific shifts on specific dates,
    ShiftDefinition is a reusable template.
    """

    __tablename__ = "shift_definitions"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Shift identification
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    abbreviation: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)

    # Shift classification
    shift_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="custom",
        index=True,
        comment="Type: morning, afternoon, evening, night, split, on-call, custom"
    )

    # Timing
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # Visual appearance
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#1976d2")

    # Staffing requirements
    required_staff: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Department relationship (optional - can be department-specific or organization-wide)
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Pay rate multiplier (e.g., 1.5 for night shifts, 2.0 for holidays)
    hourly_rate_multiplier: Mapped[float] = mapped_column(
        Numeric(4, 2),
        nullable=False,
        default=1.0,
        comment="Pay multiplier for this shift type"
    )

    # Additional requirements
    required_qualifications: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="JSON array of required qualifications/certifications"
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    # Metadata
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    created_by_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        # Foreign key exists in database, but not declared here due to User model using different Base
        nullable=True
    )

    # Relationships
    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        back_populates="shift_definitions"
    )
    # Note: User relationship removed to avoid import issues with auth.models.User
    # created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("start_time < end_time", name="valid_shift_definition_times"),
        CheckConstraint("required_staff >= 1", name="positive_required_staff_def"),
        CheckConstraint("hourly_rate_multiplier > 0", name="positive_rate_multiplier"),
        CheckConstraint("length(abbreviation) >= 1 AND length(abbreviation) <= 10", name="valid_abbreviation_length"),
        CheckConstraint(
            "shift_type IN ('morning', 'afternoon', 'evening', 'night', 'split', 'on-call', 'custom')",
            name="valid_shift_definition_type"
        ),
        Index("ix_shift_definitions_name", "name"),
        Index("ix_shift_definitions_type", "shift_type"),
        Index("ix_shift_definitions_active", "is_active"),
        Index("ix_shift_definitions_dept_active", "department_id", "is_active"),
        Index("ix_shift_definitions_time_range", "start_time", "end_time"),
    )

    @property
    def duration_hours(self) -> float:
        """Calculate shift duration in hours"""
        from datetime import datetime, timedelta

        start_datetime = datetime.combine(datetime.today(), self.start_time)
        end_datetime = datetime.combine(datetime.today(), self.end_time)

        # Handle shifts that cross midnight
        if end_datetime < start_datetime:
            end_datetime += timedelta(days=1)

        duration = end_datetime - start_datetime
        return duration.total_seconds() / 3600

    @property
    def is_overnight(self) -> bool:
        """Check if shift crosses midnight"""
        return self.end_time < self.start_time

    @property
    def formatted_time_range(self) -> str:
        """Return formatted time range string"""
        return f"{self.start_time.strftime('%I:%M %p')} - {self.end_time.strftime('%I:%M %p')}"

    def to_dict(self, camelCase: bool = True) -> dict:
        """
        Convert shift definition to dictionary for API responses.

        Args:
            camelCase: If True, convert keys to camelCase (default: True)

        Returns:
            Dictionary representation of shift definition
        """
        from ..utils.serializers import serialize_dict

        data = {
            "id": self.id,
            "name": self.name,
            "abbreviation": self.abbreviation,
            "shift_type": self.shift_type,
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
            "color": self.color,
            "required_staff": self.required_staff,
            "department_id": self.department_id,
            "hourly_rate_multiplier": float(self.hourly_rate_multiplier),
            "required_qualifications": self.required_qualifications,
            "is_active": self.is_active,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "duration_hours": self.duration_hours,
            "is_overnight": self.is_overnight,
            "formatted_time_range": self.formatted_time_range,
        }

        return serialize_dict(data) if camelCase else data

    def __repr__(self) -> str:
        return (
            f"<ShiftDefinition(id={self.id}, name='{self.name}', "
            f"type='{self.shift_type}', time={self.formatted_time_range})>"
        )
