"""
Enhanced Pydantic validators and custom business logic validators.
"""

import re
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional, Union

import phonenumbers
from phonenumbers import NumberParseException
from pydantic import BaseModel, EmailStr, Field, root_validator, validator


class ValidationError(Exception):
    """Custom validation error."""

    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(self.message)


# Custom validators for common patterns
def validate_phone_number(v: str) -> str:
    """Validate and format phone number."""
    if not v:
        return v

    try:
        # Parse phone number (assuming US by default)
        parsed = phonenumbers.parse(v, "US")
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("Invalid phone number")

        # Format as national format
        formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.NATIONAL)
        return formatted.strip()
    except NumberParseException:
        raise ValueError("Invalid phone number format")


def validate_password_strength(v: str) -> str:
    """Validate password strength."""
    if not v:
        raise ValueError("Password is required")

    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")

    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter")

    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter")

    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one number")

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>?]", v):
        raise ValueError("Password must contain at least one special character")

    return v


def validate_time_format(v: Union[str, time]) -> time:
    """Validate time format."""
    if isinstance(v, time):
        return v

    if isinstance(v, str):
        try:
            return datetime.strptime(v, "%H:%M").time()
        except ValueError:
            raise ValueError("Time must be in HH:MM format")

    raise ValueError("Invalid time format")


def validate_time_range(start_time: time, end_time: time) -> bool:
    """Validate that start time is before end time."""
    if start_time >= end_time:
        raise ValueError("Start time must be before end time")
    return True


def validate_employee_name(v: str) -> str:
    """Validate employee name."""
    if not v or not v.strip():
        raise ValueError("Name is required")

    v = v.strip()

    if len(v) < 1:
        raise ValueError("Name must be at least 1 character")

    if len(v) > 50:
        raise ValueError("Name cannot exceed 50 characters")

    # Allow letters, spaces, hyphens, and apostrophes
    if not re.match(r"^[a-zA-Z\s'-]+$", v):
        raise ValueError("Name can only contain letters, spaces, hyphens, and apostrophes")

    return v


def validate_hourly_rate(v: float) -> float:
    """Validate hourly rate."""
    if v is None:
        return v

    if v < 0:
        raise ValueError("Hourly rate cannot be negative")

    if v > 200:
        raise ValueError("Hourly rate cannot exceed $200/hour")

    return round(v, 2)


def validate_max_hours_per_week(v: int) -> int:
    """Validate maximum hours per week."""
    if v is None:
        raise ValueError("Maximum hours per week is required")

    if v <= 0:
        raise ValueError("Maximum hours must be at least 1")

    if v > 168:
        raise ValueError("Maximum hours cannot exceed 168 (24 hours × 7 days)")

    return v


def validate_availability_pattern(v: Dict[str, Any]) -> Dict[str, Any]:
    """Validate employee availability pattern."""
    if not v:
        raise ValueError("Availability pattern is required")

    days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    available_days = 0

    for day in days_of_week:
        if day not in v:
            continue

        day_data = v[day]
        if not isinstance(day_data, dict):
            raise ValueError(f"Invalid availability data for {day}")

        if day_data.get("available", False):
            available_days += 1

            # Validate start and end times
            start_time = day_data.get("start")
            end_time = day_data.get("end")

            if not start_time or not end_time:
                raise ValueError(f"Start and end times are required for {day}")

            try:
                start = validate_time_format(start_time)
                end = validate_time_format(end_time)
                validate_time_range(start, end)
            except ValueError as e:
                raise ValueError(f"Invalid time range for {day}: {e}")

    if available_days == 0:
        raise ValueError("Employee must be available for at least one day")

    return v


def validate_qualifications(v: List[str]) -> List[str]:
    """Validate employee qualifications."""
    if not v:
        return []

    # Remove duplicates and empty strings
    qualifications = list(set([q.strip() for q in v if q and q.strip()]))

    # Validate each qualification
    for qual in qualifications:
        if len(qual) > 100:
            raise ValueError(f"Qualification '{qual}' is too long (max 100 characters)")

    return qualifications


def validate_constraints(v: Dict[str, Any]) -> Dict[str, Any]:
    """Validate rule constraints."""
    if not v:
        return {}

    # Basic validation for common constraint patterns
    if "days" in v:
        days = v["days"]
        if not isinstance(days, list):
            raise ValueError("Days constraint must be a list")

        valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in days:
            if day not in valid_days:
                raise ValueError(f"Invalid day: {day}")

    if "startTime" in v:
        try:
            validate_time_format(v["startTime"])
        except ValueError:
            raise ValueError("Invalid start time in constraints")

    if "endTime" in v:
        try:
            validate_time_format(v["endTime"])
        except ValueError:
            raise ValueError("Invalid end time in constraints")

    if "startTime" in v and "endTime" in v:
        try:
            start = validate_time_format(v["startTime"])
            end = validate_time_format(v["endTime"])
            validate_time_range(start, end)
        except ValueError:
            raise ValueError("Invalid time range in constraints")

    return v


def validate_shift_requirements(v: Dict[str, Any]) -> Dict[str, Any]:
    """Validate shift requirements."""
    if not v:
        return {}

    if "requiredStaff" in v:
        staff_count = v["requiredStaff"]
        if not isinstance(staff_count, int) or staff_count < 1:
            raise ValueError("Required staff must be at least 1")

    if "requiredQualifications" in v:
        qualifications = v["requiredQualifications"]
        if not isinstance(qualifications, list):
            raise ValueError("Required qualifications must be a list")

    return v


class BusinessLogicValidator:
    """Business logic validators for complex rules."""

    @staticmethod
    def validate_schedule_conflicts(
        employee_id: int,
        shift_date: date,
        shift_start: time,
        shift_end: time,
        existing_schedules: List[Dict[str, Any]],
        exclude_schedule_id: Optional[int] = None,
    ) -> bool:
        """Check for schedule conflicts."""
        from datetime import datetime, timedelta

        shift_start_datetime = datetime.combine(shift_date, shift_start)
        shift_end_datetime = datetime.combine(shift_date, shift_end)

        for schedule in existing_schedules:
            # Skip the schedule being updated
            if exclude_schedule_id and schedule.get("id") == exclude_schedule_id:
                continue

            # Skip cancelled schedules
            if schedule.get("status") == "cancelled":
                continue

            # Only check schedules for the same employee and date
            if schedule.get("employee_id") != employee_id or schedule.get("date") != shift_date:
                continue

            existing_start = datetime.combine(shift_date, schedule.get("start_time"))
            existing_end = datetime.combine(shift_date, schedule.get("end_time"))

            # Check for overlap
            if shift_start_datetime < existing_end and shift_end_datetime > existing_start:
                raise ValidationError(
                    f"Schedule conflicts with existing shift from {schedule.get('start_time')} to {schedule.get('end_time')}",
                    field="schedule_conflict",
                )

        return True

    @staticmethod
    def validate_employee_qualifications(employee_qualifications: List[str], required_qualifications: List[str]) -> bool:
        """Check if employee meets required qualifications."""
        if not required_qualifications:
            return True

        missing_qualifications = [qual for qual in required_qualifications if qual not in employee_qualifications]

        if missing_qualifications:
            raise ValidationError(
                f"Employee is missing required qualifications: {', '.join(missing_qualifications)}", field="qualifications"
            )

        return True

    @staticmethod
    def validate_employee_availability(
        employee_availability: Dict[str, Any], shift_date: date, shift_start: time, shift_end: time
    ) -> bool:
        """Check if shift is within employee's availability."""
        if not employee_availability:
            return True

        day_of_week = shift_date.strftime("%A").lower()
        day_availability = employee_availability.get(day_of_week)

        if not day_availability:
            return True

        if not day_availability.get("available", False):
            raise ValidationError(f"Employee is not available on {day_of_week}s", field="availability")

        available_start = validate_time_format(day_availability.get("start", "00:00"))
        available_end = validate_time_format(day_availability.get("end", "23:59"))

        if shift_start < available_start or shift_end > available_end:
            raise ValidationError(
                f"Shift time ({shift_start}-{shift_end}) is outside employee availability ({available_start}-{available_end})",
                field="availability",
            )

        return True

    @staticmethod
    def validate_max_hours_constraint(
        employee_id: int,
        week_start: date,
        week_end: date,
        new_shift_hours: float,
        max_hours_per_week: int,
        existing_schedules: List[Dict[str, Any]],
        exclude_schedule_id: Optional[int] = None,
    ) -> bool:
        """Check if adding shift would exceed max hours per week."""
        total_hours = new_shift_hours

        for schedule in existing_schedules:
            # Skip the schedule being updated
            if exclude_schedule_id and schedule.get("id") == exclude_schedule_id:
                continue

            # Skip cancelled schedules
            if schedule.get("status") == "cancelled":
                continue

            # Only count schedules for this employee in this week
            schedule_date = schedule.get("date")
            if schedule.get("employee_id") != employee_id or schedule_date < week_start or schedule_date > week_end:
                continue

            # Calculate shift duration
            start_time = schedule.get("start_time")
            end_time = schedule.get("end_time")
            if start_time and end_time:
                start_minutes = start_time.hour * 60 + start_time.minute
                end_minutes = end_time.hour * 60 + end_time.minute
                shift_hours = (end_minutes - start_minutes) / 60
                total_hours += shift_hours

        if total_hours > max_hours_per_week:
            raise ValidationError(
                f"Adding this shift would exceed maximum hours per week ({total_hours:.1f} > {max_hours_per_week})",
                field="max_hours",
            )

        return True

    @staticmethod
    def validate_minimum_rest_period(
        employee_id: int,
        shift_date: date,
        shift_start: time,
        shift_end: time,
        existing_schedules: List[Dict[str, Any]],
        minimum_rest_hours: int = 8,
        exclude_schedule_id: Optional[int] = None,
    ) -> bool:
        """Check minimum rest period between shifts."""
        from datetime import datetime, timedelta

        shift_start_datetime = datetime.combine(shift_date, shift_start)
        shift_end_datetime = datetime.combine(shift_date, shift_end)

        for schedule in existing_schedules:
            # Skip the schedule being updated
            if exclude_schedule_id and schedule.get("id") == exclude_schedule_id:
                continue

            # Skip cancelled schedules
            if schedule.get("status") == "cancelled":
                continue

            # Only check schedules for the same employee
            if schedule.get("employee_id") != employee_id:
                continue

            schedule_date = schedule.get("date")
            existing_start = datetime.combine(schedule_date, schedule.get("start_time"))
            existing_end = datetime.combine(schedule_date, schedule.get("end_time"))

            # Check rest period before new shift
            time_between = shift_start_datetime - existing_end
            if timedelta(0) <= time_between < timedelta(hours=minimum_rest_hours):
                raise ValidationError(
                    f"Insufficient rest period ({time_between.total_seconds()/3600:.1f} hours) between shifts. Minimum {minimum_rest_hours} hours required.",
                    field="rest_period",
                )

            # Check rest period after new shift
            time_between = existing_start - shift_end_datetime
            if timedelta(0) <= time_between < timedelta(hours=minimum_rest_hours):
                raise ValidationError(
                    f"Insufficient rest period ({time_between.total_seconds()/3600:.1f} hours) between shifts. Minimum {minimum_rest_hours} hours required.",
                    field="rest_period",
                )

        return True


# Export validators for use in schemas
__all__ = [
    "validate_phone_number",
    "validate_password_strength",
    "validate_time_format",
    "validate_time_range",
    "validate_employee_name",
    "validate_hourly_rate",
    "validate_max_hours_per_week",
    "validate_availability_pattern",
    "validate_qualifications",
    "validate_constraints",
    "validate_shift_requirements",
    "BusinessLogicValidator",
    "ValidationError",
]
