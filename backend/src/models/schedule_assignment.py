"""
ScheduleAssignment model for linking employees to shifts within schedules
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, CheckConstraint, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ScheduleAssignment(Base):
    """Assignment of employees to shifts within schedules"""

    __tablename__ = "schedule_assignments"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Foreign keys
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    shift_id: Mapped[int] = mapped_column(
        ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Assignment status and metadata
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="assigned",
        index=True
    )

    # Assignment priority/preference
    priority: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )

    # Notes and comments
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Assignment history
    assigned_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("employees.id"),
        nullable=True
    )

    assigned_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )

    # Conflict resolution
    conflicts_resolved: Mapped[bool] = mapped_column(default=False, nullable=False)
    auto_assigned: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)

    # Relationships
    schedule: Mapped["Schedule"] = relationship(
        "Schedule",
        back_populates="assignments"
    )

    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="schedule_assignments",
        foreign_keys=[employee_id]
    )

    shift: Mapped["Shift"] = relationship(
        "Shift",
        back_populates="schedule_assignments"
    )

    assigner: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        foreign_keys=[assigned_by]
    )

    # Constraints and indexes
    __table_args__ = (
        # Unique constraint to prevent duplicate assignments
        UniqueConstraint(
            "schedule_id", "employee_id", "shift_id",
            name="uq_schedule_employee_shift"
        ),

        CheckConstraint(
            "status IN ('assigned', 'pending', 'confirmed', 'declined', 'cancelled', 'completed')",
            name="valid_assignment_status"
        ),

        CheckConstraint(
            "priority BETWEEN 1 AND 10",
            name="valid_assignment_priority"
        ),

        # Composite indexes for common queries
        Index("ix_assignments_schedule_status", "schedule_id", "status"),
        Index("ix_assignments_employee_status", "employee_id", "status"),
        Index("ix_assignments_shift_status", "shift_id", "status"),
        Index("ix_assignments_employee_schedule", "employee_id", "schedule_id"),
        Index("ix_assignments_date_employee", "assigned_at", "employee_id"),
        Index("ix_assignments_auto_assigned", "auto_assigned", "status"),
    )

    @property
    def is_active(self) -> bool:
        """Check if assignment is currently active"""
        return self.status in ["assigned", "confirmed"]

    @property
    def is_confirmed(self) -> bool:
        """Check if assignment has been confirmed by employee"""
        return self.status == "confirmed"

    @property
    def needs_confirmation(self) -> bool:
        """Check if assignment needs employee confirmation"""
        return self.status in ["assigned", "pending"]

    def can_modify(self, user: "Employee") -> tuple[bool, str]:
        """Check if user can modify this assignment"""
        # Schedule must be editable
        if not self.schedule.is_editable:
            return False, f"Schedule is {self.schedule.status} and cannot be modified"

        # Check permissions
        if user.is_admin or user.role in ["manager", "supervisor"]:
            return True, "Administrative access"

        if user.id == self.schedule.created_by:
            return True, "Schedule creator access"

        if user.id == self.employee_id and self.status == "pending":
            return True, "Employee can confirm/decline pending assignments"

        return False, "Insufficient permissions"

    def can_confirm(self, user: "Employee") -> tuple[bool, str]:
        """Check if user can confirm this assignment"""
        if user.id != self.employee_id:
            return False, "Only assigned employee can confirm"

        if self.status not in ["assigned", "pending"]:
            return False, f"Assignment status is {self.status}, cannot confirm"

        return True, "Can confirm"

    def can_decline(self, user: "Employee") -> tuple[bool, str]:
        """Check if user can decline this assignment"""
        if user.id != self.employee_id:
            return False, "Only assigned employee can decline"

        if self.status not in ["assigned", "pending"]:
            return False, f"Assignment status is {self.status}, cannot decline"

        # Check if decline period is still open
        hours_since_assignment = (datetime.utcnow() - self.assigned_at).total_seconds() / 3600
        if hours_since_assignment > 48:  # 48 hour window to decline
            return False, "Decline period has expired (48 hours)"

        return True, "Can decline"

    def confirm_assignment(self, user: "Employee") -> tuple[bool, str]:
        """Confirm the assignment"""
        can_confirm, reason = self.can_confirm(user)
        if not can_confirm:
            return False, reason

        self.status = "confirmed"
        return True, "Assignment confirmed"

    def decline_assignment(self, user: "Employee", reason: str = None) -> tuple[bool, str]:
        """Decline the assignment"""
        can_decline, decline_reason = self.can_decline(user)
        if not can_decline:
            return False, decline_reason

        self.status = "declined"
        if reason:
            self.notes = f"Declined: {reason}"

        return True, "Assignment declined"

    def check_conflicts(self) -> List[str]:
        """Check for conflicts with this assignment"""
        conflicts = []

        # Check employee availability
        day_name = self.shift.date.strftime("%A").lower()
        shift_start = self.shift.start_time.strftime("%H:%M")

        if not self.employee.is_available_at(day_name, shift_start):
            conflicts.append(f"Employee not available on {day_name} at {shift_start}")

        # Check for overlapping assignments
        for other_assignment in self.employee.schedule_assignments:
            if (other_assignment.id != self.id and
                other_assignment.status in ["assigned", "confirmed"] and
                other_assignment.shift.date == self.shift.date and
                self.shift.conflicts_with(other_assignment.shift)):
                conflicts.append(f"Conflicts with shift {other_assignment.shift.id}")

        # Check qualifications
        can_assign, reason = self.shift.can_assign_employee(self.employee)
        if not can_assign:
            conflicts.append(reason)

        return conflicts

    def resolve_conflicts(self) -> bool:
        """Attempt to automatically resolve conflicts"""
        conflicts = self.check_conflicts()
        if not conflicts:
            self.conflicts_resolved = True
            return True

        # For now, just mark as having conflicts
        # In a real implementation, this could trigger workflow processes
        self.conflicts_resolved = False
        return False

    def get_assignment_summary(self) -> dict:
        """Get summary information about this assignment"""
        return {
            "assignment_id": self.id,
            "employee_name": self.employee.name,
            "employee_email": self.employee.email,
            "shift_date": self.shift.date.isoformat(),
            "shift_time": f"{self.shift.start_time} - {self.shift.end_time}",
            "shift_type": self.shift.shift_type,
            "status": self.status,
            "priority": self.priority,
            "auto_assigned": self.auto_assigned,
            "conflicts": self.check_conflicts(),
            "needs_confirmation": self.needs_confirmation
        }