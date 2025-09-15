"""
Shift model for defining work periods and requirements
"""
from datetime import datetime, date, time, timedelta
from typing import List, Optional
from sqlalchemy import String, Date, Time, Integer, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base


class Shift(Base):
    """Shift model defining work periods with staffing requirements"""

    __tablename__ = "shifts"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Shift timing
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # Shift classification
    shift_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="general",
        index=True
    )

    # Staffing requirements
    required_staff: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1
    )

    # Additional requirements as JSON for flexibility
    requirements: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="JSON structure for qualifications, skills, or other requirements"
    )

    # Shift metadata
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)

    # Relationships
    schedule_assignments: Mapped[List["ScheduleAssignment"]] = relationship(
        "ScheduleAssignment",
        back_populates="shift",
        cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            "start_time < end_time",
            name="valid_shift_times"
        ),
        CheckConstraint(
            "required_staff > 0",
            name="positive_required_staff"
        ),
        CheckConstraint(
            "priority BETWEEN 1 AND 10",
            name="valid_priority_range"
        ),
        CheckConstraint(
            "shift_type IN ('general', 'management', 'specialized', 'emergency', 'training')",
            name="valid_shift_type"
        ),
        Index("ix_shifts_date_time", "date", "start_time", "end_time"),
        Index("ix_shifts_type_priority", "shift_type", "priority"),
        Index("ix_shifts_requirements", "requirements", postgresql_using="gin"),
        Index("ix_shifts_date_type", "date", "shift_type"),
    )

    @property
    def duration_hours(self) -> float:
        """Calculate shift duration in hours"""
        start_datetime = datetime.combine(date.today(), self.start_time)
        end_datetime = datetime.combine(date.today(), self.end_time)

        # Handle shifts that cross midnight
        if end_datetime < start_datetime:
            end_datetime = datetime.combine(date.today(), self.end_time) + timedelta(days=1)

        duration = end_datetime - start_datetime
        return duration.total_seconds() / 3600

    @property
    def is_overtime(self) -> bool:
        """Check if shift qualifies as overtime (>8 hours)"""
        return self.duration_hours > 8.0

    def requires_qualification(self, qualification: str) -> bool:
        """Check if shift requires specific qualification"""
        if not self.requirements:
            return False

        required_quals = self.requirements.get("qualifications", [])
        return qualification in required_quals

    def get_assigned_count(self) -> int:
        """Get count of currently assigned employees"""
        return len([assignment for assignment in self.schedule_assignments
                   if assignment.status == "assigned"])

    def is_fully_staffed(self) -> bool:
        """Check if shift has enough assigned staff"""
        return self.get_assigned_count() >= self.required_staff

    def needs_more_staff(self) -> int:
        """Return number of additional staff needed"""
        return max(0, self.required_staff - self.get_assigned_count())

    def conflicts_with(self, other_shift: "Shift") -> bool:
        """Check if this shift conflicts with another shift on the same date"""
        if self.date != other_shift.date:
            return False

        # Check time overlap
        return (self.start_time < other_shift.end_time and
                self.end_time > other_shift.start_time)

    def can_assign_employee(self, employee: "Employee") -> tuple[bool, str]:
        """
        Check if employee can be assigned to this shift
        Returns (can_assign, reason)
        """
        # Check if employee can work this shift type
        if not employee.can_work_shift_type(self.shift_type):
            return False, f"Employee lacks qualifications for {self.shift_type} shifts"

        # Check availability
        day_name = self.date.strftime("%A").lower()
        shift_start = self.start_time.strftime("%H:%M")

        if not employee.is_available_at(day_name, shift_start):
            return False, f"Employee not available on {day_name} at {shift_start}"

        # Check specific requirements
        if self.requirements:
            required_quals = self.requirements.get("qualifications", [])
            if required_quals and not any(
                employee.has_qualification(qual) for qual in required_quals
            ):
                return False, f"Employee missing required qualifications: {required_quals}"

        # Check if already assigned to conflicting shift
        for assignment in employee.schedule_assignments:
            if (assignment.shift.date == self.date and
                assignment.status == "assigned" and
                self.conflicts_with(assignment.shift)):
                return False, f"Employee already assigned to conflicting shift"

        return True, "Can assign"