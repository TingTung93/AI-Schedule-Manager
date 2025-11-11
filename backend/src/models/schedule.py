"""
Schedule model for managing weekly schedules and their lifecycle
"""

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Schedule(Base):
    """Schedule model for managing weekly schedules with versioning and approval workflow"""

    __tablename__ = "schedules"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Schedule period
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    week_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Schedule lifecycle
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft", index=True)

    # Version control
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_schedule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("schedules.id"), nullable=True, index=True)

    # Metadata
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # Ownership and approval
    created_by: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)

    approved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)

    approved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Publishing
    published_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator: Mapped["Employee"] = relationship("Employee", back_populates="created_schedules", foreign_keys=[created_by])

    approver: Mapped[Optional["Employee"]] = relationship("Employee", foreign_keys=[approved_by])

    parent_schedule: Mapped[Optional["Schedule"]] = relationship(
        "Schedule", remote_side=[id], back_populates="child_schedules"
    )

    child_schedules: Mapped[List["Schedule"]] = relationship("Schedule", back_populates="parent_schedule")

    assignments: Mapped[List["ScheduleAssignment"]] = relationship(
        "ScheduleAssignment", back_populates="schedule", cascade="all, delete-orphan"
    )

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint("week_start <= week_end", name="valid_week_period"),
        CheckConstraint("week_end - week_start <= INTERVAL '7 days'", name="max_week_duration"),
        CheckConstraint(
            "status IN ('draft', 'pending_approval', 'approved', 'published', 'archived', 'rejected')", name="valid_status"
        ),
        CheckConstraint("version > 0", name="positive_version"),
        CheckConstraint(
            "(status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR status != 'approved'",
            name="approval_required_when_approved",
        ),
        CheckConstraint(
            "(status = 'published' AND published_at IS NOT NULL) OR status != 'published'",
            name="published_date_required_when_published",
        ),
        Index("ix_schedules_week_period", "week_start", "week_end"),
        Index("ix_schedules_status_created", "status", "created_at"),
        Index("ix_schedules_creator_status", "created_by", "status"),
        Index("ix_schedules_parent_version", "parent_schedule_id", "version"),
    )

    @property
    def is_editable(self) -> bool:
        """Check if schedule can be edited"""
        return self.status in ["draft", "rejected"]

    @property
    def is_current_week(self) -> bool:
        """Check if this schedule covers the current week"""
        today = date.today()
        return self.week_start <= today <= self.week_end

    @property
    def days_until_start(self) -> int:
        """Get number of days until schedule starts"""
        today = date.today()
        return (self.week_start - today).days

    def can_approve(self, user: "Employee") -> tuple[bool, str]:
        """Check if user can approve this schedule"""
        if self.status != "pending_approval":
            return False, f"Schedule must be pending approval, current status: {self.status}"

        if user.id == self.created_by:
            return False, "Cannot approve own schedule"

        if not user.is_admin and user.role not in ["manager", "supervisor"]:
            return False, "Insufficient permissions to approve schedules"

        return True, "Can approve"

    def can_publish(self, user: "Employee") -> tuple[bool, str]:
        """Check if user can publish this schedule"""
        if self.status != "approved":
            return False, f"Schedule must be approved before publishing, current status: {self.status}"

        if not user.is_admin and user.role != "manager":
            return False, "Insufficient permissions to publish schedules"

        return True, "Can publish"

    def get_total_assignments(self) -> int:
        """Get total number of assignments in this schedule"""
        return len(self.assignments)

    def get_assigned_employees(self) -> List["Employee"]:
        """Get list of employees assigned to this schedule"""
        return list(set(assignment.employee for assignment in self.assignments if assignment.status == "assigned"))

    def get_unassigned_shifts(self) -> List["Shift"]:
        """Get shifts that still need staff assignments"""
        assigned_shifts = {assignment.shift_id for assignment in self.assignments if assignment.status == "assigned"}

        # This would need to be implemented based on how shifts are related to schedules
        # For now, return empty list
        return []

    def create_revision(self, created_by: int, title: str = None) -> "Schedule":
        """Create a new revision of this schedule"""
        revision = Schedule(
            week_start=self.week_start,
            week_end=self.week_end,
            title=title or f"{self.title} (Revision {self.version + 1})",
            description=self.description,
            created_by=created_by,
            parent_schedule_id=self.id,
            version=self.version + 1,
            status="draft",
        )
        return revision

    def get_coverage_summary(self) -> dict:
        """Get summary of shift coverage for this schedule"""
        total_shifts = len(set(assignment.shift_id for assignment in self.assignments))
        assigned_shifts = len(set(assignment.shift_id for assignment in self.assignments if assignment.status == "assigned"))

        return {
            "total_shifts": total_shifts,
            "assigned_shifts": assigned_shifts,
            "coverage_percentage": (assigned_shifts / total_shifts * 100) if total_shifts > 0 else 0,
            "total_assignments": self.get_total_assignments(),
            "unique_employees": len(self.get_assigned_employees()),
        }
