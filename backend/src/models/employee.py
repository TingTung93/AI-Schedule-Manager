"""
Employee model for user management and authentication
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, Boolean, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

from .base import Base


class Employee(Base):
    """Employee model with authentication and qualification tracking"""

    __tablename__ = "employees"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Authentication fields
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Personal information
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False, default="employee")

    # Work-related fields
    qualifications: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String),
        nullable=True,
        comment="List of employee qualifications/certifications"
    )

    # Availability as JSON structure for flexible scheduling
    availability: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="JSON structure defining available time slots by day"
    )

    # Status tracking
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    schedule_assignments: Mapped[List["ScheduleAssignment"]] = relationship(
        "ScheduleAssignment",
        back_populates="employee",
        cascade="all, delete-orphan"
    )

    created_schedules: Mapped[List["Schedule"]] = relationship(
        "Schedule",
        back_populates="creator",
        foreign_keys="Schedule.created_by"
    )

    rules: Mapped[List["Rule"]] = relationship(
        "Rule",
        back_populates="employee",
        cascade="all, delete-orphan"
    )

    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'manager', 'supervisor', 'employee')",
            name="valid_role"
        ),
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name="valid_email_format"
        ),
        CheckConstraint(
            "char_length(name) >= 2",
            name="name_min_length"
        ),
        Index("ix_employees_role_active", "role", "is_active"),
        Index("ix_employees_qualifications", "qualifications", postgresql_using="gin"),
        Index("ix_employees_availability", "availability", postgresql_using="gin"),
    )

    def has_qualification(self, qualification: str) -> bool:
        """Check if employee has specific qualification"""
        return self.qualifications and qualification in self.qualifications

    def is_available_at(self, day: str, time: str) -> bool:
        """Check if employee is available at specific day/time"""
        if not self.availability or day not in self.availability:
            return False

        day_availability = self.availability[day]
        if not day_availability or not day_availability.get("available", False):
            return False

        # Check time slots if specified
        time_slots = day_availability.get("time_slots", [])
        if not time_slots:
            return True  # Available all day

        # Check if time falls within any available slot
        for slot in time_slots:
            if slot.get("start") <= time <= slot.get("end"):
                return True

        return False

    def can_work_shift_type(self, shift_type: str) -> bool:
        """Check if employee can work specific shift type based on qualifications"""
        if not self.qualifications:
            return shift_type == "general"  # Only general shifts if no qualifications

        # Map shift types to required qualifications
        shift_requirements = {
            "management": ["supervisor", "manager"],
            "specialized": ["certified", "specialist"],
            "general": []  # No specific requirements
        }

        required_quals = shift_requirements.get(shift_type, [])
        return any(qual in self.qualifications for qual in required_quals) if required_quals else True