"""
Rule model for defining scheduling constraints and business rules
"""

from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Rule(Base):
    """Scheduling rules and constraints for employees and shifts"""

    __tablename__ = "rules"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Rule identification
    rule_text: Mapped[str] = mapped_column(Text, nullable=False, comment="Human-readable description of the rule")

    rule_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Rule scope - can be global or employee-specific
    employee_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Rule constraints as JSON for flexibility
    constraints: Mapped[dict] = mapped_column(
        JSONB, nullable=False, comment="JSON structure defining rule parameters and limits"
    )

    # Rule metadata
    priority: Mapped[int] = mapped_column(
        Integer, default=5, nullable=False, comment="Rule priority (1-10, higher number = higher priority)"
    )

    # Rule status
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Validation and enforcement
    strict: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Whether rule violations should block scheduling"
    )

    violation_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Count of times this rule has been violated"
    )

    # Effective period
    effective_from: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    effective_until: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Rule metadata
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    tags: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, nullable=True, comment="Tags for rule categorization and filtering"
    )

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee: Mapped[Optional["Employee"]] = relationship("Employee", back_populates="rules")

    # Constraints and indexes
    __table_args__ = (
        CheckConstraint(
            "rule_type IN ('availability', 'workload', 'qualification', 'preference', 'restriction', 'overtime', 'consecutive_days', 'rest_period')",
            name="valid_rule_type",
        ),
        CheckConstraint("priority BETWEEN 1 AND 10", name="valid_priority_range"),
        CheckConstraint("violation_count >= 0", name="non_negative_violations"),
        CheckConstraint(
            "(effective_from IS NULL) OR (effective_until IS NULL) OR (effective_from <= effective_until)",
            name="valid_effective_period",
        ),
        Index("ix_rules_type_active", "rule_type", "active"),
        Index("ix_rules_employee_type", "employee_id", "rule_type"),
        Index("ix_rules_priority_active", "priority", "active"),
        Index("ix_rules_constraints", "constraints", postgresql_using="gin"),
        Index("ix_rules_tags", "tags", postgresql_using="gin"),
        Index("ix_rules_effective_period", "effective_from", "effective_until"),
    )

    @property
    def is_global(self) -> bool:
        """Check if rule applies globally (not employee-specific)"""
        return self.employee_id is None

    @property
    def is_effective(self) -> bool:
        """Check if rule is currently effective"""
        if not self.active:
            return False

        now = datetime.utcnow()

        if self.effective_from and now < self.effective_from:
            return False

        if self.effective_until and now > self.effective_until:
            return False

        return True

    def applies_to_employee(self, employee_id: int) -> bool:
        """Check if rule applies to specific employee"""
        return self.is_global or self.employee_id == employee_id

    def validate_assignment(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """
        Validate assignment against this rule
        Returns (is_valid, violation_message)
        """
        if not self.is_effective or not self.applies_to_employee(assignment.employee_id):
            return True, "Rule not applicable"

        # Dispatch to specific validation based on rule type
        validation_methods = {
            "availability": self._validate_availability,
            "workload": self._validate_workload,
            "qualification": self._validate_qualification,
            "preference": self._validate_preference,
            "restriction": self._validate_restriction,
            "overtime": self._validate_overtime,
            "consecutive_days": self._validate_consecutive_days,
            "rest_period": self._validate_rest_period,
        }

        validation_method = validation_methods.get(self.rule_type)
        if not validation_method:
            return True, f"Unknown rule type: {self.rule_type}"

        return validation_method(assignment)

    def _validate_availability(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate availability rule"""
        constraints = self.constraints
        day_name = assignment.shift.date.strftime("%A").lower()

        # Check if day is restricted
        restricted_days = constraints.get("restricted_days", [])
        if day_name in restricted_days:
            return False, f"Employee not available on {day_name}"

        # Check time restrictions
        time_restrictions = constraints.get("time_restrictions", {})
        if day_name in time_restrictions:
            shift_start = assignment.shift.start_time
            restrictions = time_restrictions[day_name]

            for restriction in restrictions:
                start_time = datetime.strptime(restriction["start"], "%H:%M").time()
                end_time = datetime.strptime(restriction["end"], "%H:%M").time()

                if start_time <= shift_start <= end_time:
                    return False, f"Time restriction violated: {restriction.get('reason', 'Not available')}"

        return True, "Availability rule satisfied"

    def _validate_workload(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate workload limits"""
        constraints = self.constraints

        # Check daily hour limits
        max_daily_hours = constraints.get("max_daily_hours")
        if max_daily_hours:
            # Calculate total hours for this employee on this date
            same_day_assignments = [
                a
                for a in assignment.employee.schedule_assignments
                if (a.shift.date == assignment.shift.date and a.status in ["assigned", "confirmed"] and a.id != assignment.id)
            ]

            total_hours = sum(a.shift.duration_hours for a in same_day_assignments)
            total_hours += assignment.shift.duration_hours

            if total_hours > max_daily_hours:
                return False, f"Daily hour limit exceeded: {total_hours} > {max_daily_hours}"

        # Check weekly hour limits
        max_weekly_hours = constraints.get("max_weekly_hours")
        if max_weekly_hours:
            # Calculate total hours for this employee in this week
            week_start = assignment.shift.date - timedelta(days=assignment.shift.date.weekday())
            week_end = week_start + timedelta(days=6)

            week_assignments = [
                a
                for a in assignment.employee.schedule_assignments
                if (week_start <= a.shift.date <= week_end and a.status in ["assigned", "confirmed"] and a.id != assignment.id)
            ]

            total_weekly_hours = sum(a.shift.duration_hours for a in week_assignments)
            total_weekly_hours += assignment.shift.duration_hours

            if total_weekly_hours > max_weekly_hours:
                return False, f"Weekly hour limit exceeded: {total_weekly_hours} > {max_weekly_hours}"

        return True, "Workload rule satisfied"

    def _validate_qualification(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate qualification requirements"""
        constraints = self.constraints
        required_qualifications = constraints.get("required_qualifications", [])

        if not required_qualifications:
            return True, "No specific qualifications required"

        employee_quals = assignment.employee.qualifications or []

        missing_quals = [qual for qual in required_qualifications if qual not in employee_quals]

        if missing_quals:
            return False, f"Missing required qualifications: {missing_quals}"

        return True, "Qualification rule satisfied"

    def _validate_preference(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate employee preferences (non-strict)"""
        if self.strict:
            return self._validate_hard_preference(assignment)

        # For non-strict preferences, always allow but may affect scoring
        return True, "Preference noted (non-strict)"

    def _validate_hard_preference(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate strict preference rules"""
        constraints = self.constraints
        preferred_shifts = constraints.get("preferred_shift_types", [])

        if preferred_shifts and assignment.shift.shift_type not in preferred_shifts:
            return False, f"Shift type {assignment.shift.shift_type} not in preferred types: {preferred_shifts}"

        return True, "Hard preference rule satisfied"

    def _validate_restriction(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate restriction rules"""
        constraints = self.constraints

        # Check forbidden shift types
        forbidden_shift_types = constraints.get("forbidden_shift_types", [])
        if assignment.shift.shift_type in forbidden_shift_types:
            return False, f"Forbidden shift type: {assignment.shift.shift_type}"

        # Check forbidden dates
        forbidden_dates = constraints.get("forbidden_dates", [])
        shift_date_str = assignment.shift.date.isoformat()
        if shift_date_str in forbidden_dates:
            return False, f"Forbidden date: {shift_date_str}"

        return True, "Restriction rule satisfied"

    def _validate_overtime(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate overtime rules"""
        constraints = self.constraints
        max_overtime_hours = constraints.get("max_weekly_overtime", 0)

        # Calculate current overtime for this week
        week_start = assignment.shift.date - timedelta(days=assignment.shift.date.weekday())
        week_end = week_start + timedelta(days=6)

        week_assignments = [
            a
            for a in assignment.employee.schedule_assignments
            if (week_start <= a.shift.date <= week_end and a.status in ["assigned", "confirmed"] and a.id != assignment.id)
        ]

        total_hours = sum(a.shift.duration_hours for a in week_assignments)
        total_hours += assignment.shift.duration_hours

        standard_hours = constraints.get("standard_weekly_hours", 40)
        overtime_hours = max(0, total_hours - standard_hours)

        if overtime_hours > max_overtime_hours:
            return False, f"Overtime limit exceeded: {overtime_hours} > {max_overtime_hours}"

        return True, "Overtime rule satisfied"

    def _validate_consecutive_days(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate consecutive days rules"""
        constraints = self.constraints
        max_consecutive = constraints.get("max_consecutive_days", 7)

        # Find consecutive working days around this assignment
        current_date = assignment.shift.date
        consecutive_count = 1  # Current assignment

        # Count backwards
        check_date = current_date - timedelta(days=1)
        while True:
            day_assignments = [
                a
                for a in assignment.employee.schedule_assignments
                if (a.shift.date == check_date and a.status in ["assigned", "confirmed"])
            ]
            if not day_assignments:
                break
            consecutive_count += 1
            check_date -= timedelta(days=1)

        # Count forwards
        check_date = current_date + timedelta(days=1)
        while True:
            day_assignments = [
                a
                for a in assignment.employee.schedule_assignments
                if (a.shift.date == check_date and a.status in ["assigned", "confirmed"])
            ]
            if not day_assignments:
                break
            consecutive_count += 1
            check_date += timedelta(days=1)

        if consecutive_count > max_consecutive:
            return False, f"Consecutive days limit exceeded: {consecutive_count} > {max_consecutive}"

        return True, "Consecutive days rule satisfied"

    def _validate_rest_period(self, assignment: "ScheduleAssignment") -> tuple[bool, str]:
        """Validate rest period between shifts"""
        constraints = self.constraints
        min_rest_hours = constraints.get("min_rest_hours", 8)

        # Check previous day's shifts
        previous_date = assignment.shift.date - timedelta(days=1)
        previous_assignments = [
            a
            for a in assignment.employee.schedule_assignments
            if (a.shift.date == previous_date and a.status in ["assigned", "confirmed"])
        ]

        if previous_assignments:
            # Find the latest end time from previous day
            latest_end = max(a.shift.end_time for a in previous_assignments)
            current_start = assignment.shift.start_time

            # Calculate rest period
            previous_end_datetime = datetime.combine(previous_date, latest_end)
            current_start_datetime = datetime.combine(assignment.shift.date, current_start)

            rest_period = current_start_datetime - previous_end_datetime
            rest_hours = rest_period.total_seconds() / 3600

            if rest_hours < min_rest_hours:
                return False, f"Insufficient rest period: {rest_hours:.1f}h < {min_rest_hours}h"

        return True, "Rest period rule satisfied"

    def record_violation(self, assignment: "ScheduleAssignment", violation_message: str):
        """Record a rule violation"""
        self.violation_count += 1
        # In a real implementation, you might want to log this or create a violation record

    def get_constraint_summary(self) -> dict:
        """Get human-readable summary of constraints"""
        summaries = {
            "availability": "Defines when employee is available to work",
            "workload": "Limits daily/weekly working hours",
            "qualification": "Requires specific qualifications for assignments",
            "preference": "Defines employee preferences for shifts",
            "restriction": "Prohibits certain assignments",
            "overtime": "Limits overtime hours",
            "consecutive_days": "Limits consecutive working days",
            "rest_period": "Ensures minimum rest between shifts",
        }

        return {
            "rule_id": self.id,
            "type": self.rule_type,
            "description": summaries.get(self.rule_type, "Unknown rule type"),
            "priority": self.priority,
            "strict": self.strict,
            "global": self.is_global,
            "active": self.active,
            "effective": self.is_effective,
            "violations": self.violation_count,
            "constraints": self.constraints,
        }
