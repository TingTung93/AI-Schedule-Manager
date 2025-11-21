"""
Enhanced Pydantic schemas with comprehensive validation.
"""

from datetime import date, datetime, time
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, root_validator, validator

from .validators import (
    BusinessLogicValidator,
    validate_availability_pattern,
    validate_constraints,
    validate_employee_name,
    validate_hourly_rate,
    validate_max_hours_per_week,
    validate_password_strength,
    validate_phone_number,
    validate_qualifications,
    validate_time_format,
    validate_time_range,
)


class EmployeeRole(str, Enum):
    """Employee role enumeration."""

    MANAGER = "manager"
    SUPERVISOR = "supervisor"
    SERVER = "server"
    COOK = "cook"
    CASHIER = "cashier"
    CLEANER = "cleaner"
    SECURITY = "security"


class RuleType(str, Enum):
    """Rule type enumeration."""

    AVAILABILITY = "availability"
    PREFERENCE = "preference"
    REQUIREMENT = "requirement"
    RESTRICTION = "restriction"


class ScheduleStatus(str, Enum):
    """Schedule status enumeration."""

    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class NotificationType(str, Enum):
    """Notification type enumeration."""

    SCHEDULE = "schedule"
    REQUEST = "request"
    REMINDER = "reminder"
    ALERT = "alert"


class Priority(str, Enum):
    """Priority enumeration."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# Enhanced Employee schemas
class EmployeeBase(BaseModel):
    """Base employee schema with comprehensive validation."""

    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    role: EmployeeRole
    phone: Optional[str] = Field(None, max_length=50)
    hourly_rate: Optional[float] = Field(None, ge=0, le=200)
    max_hours_per_week: int = Field(40, ge=1, le=168)
    qualifications: List[str] = Field(default_factory=list)
    availability: Optional[Dict[str, Any]] = None
    is_active: bool = True

    @validator("first_name", "last_name")
    def validate_names(cls, v):
        return validate_employee_name(v)

    @validator("phone")
    def validate_phone(cls, v):
        if v:
            return validate_phone_number(v)
        return v

    @validator("hourly_rate")
    def validate_rate(cls, v):
        return validate_hourly_rate(v)

    @validator("max_hours_per_week")
    def validate_max_hours(cls, v):
        return validate_max_hours_per_week(v)

    @validator("qualifications")
    def validate_quals(cls, v):
        return validate_qualifications(v)

    @validator("availability")
    def validate_availability_data(cls, v):
        if v:
            return validate_availability_pattern(v)
        return v

    @root_validator
    def validate_max_hours_vs_availability(cls, values):
        """Validate max hours against availability pattern."""
        max_hours = values.get("max_hours_per_week")
        availability = values.get("availability")

        if max_hours and availability:
            total_available_hours = 0
            days_of_week = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

            for day in days_of_week:
                day_data = availability.get(day, {})
                if day_data.get("available", False):
                    start_time = day_data.get("start")
                    end_time = day_data.get("end")

                    if start_time and end_time:
                        try:
                            start = validate_time_format(start_time)
                            end = validate_time_format(end_time)
                            start_minutes = start.hour * 60 + start.minute
                            end_minutes = end.hour * 60 + end.minute
                            total_available_hours += (end_minutes - start_minutes) / 60
                        except Exception:
                            continue

            if max_hours > total_available_hours:
                raise ValueError(
                    f"Maximum hours ({max_hours}) exceeds available hours ({total_available_hours:.1f}) based on availability"
                )

        return values


class EmployeeCreate(EmployeeBase):
    """Employee creation schema."""

    pass


class EmployeeUpdate(BaseModel):
    """Employee update schema."""

    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    hourly_rate: Optional[float] = Field(None, ge=0, le=200)
    max_hours_per_week: Optional[int] = Field(None, ge=1, le=168)
    qualifications: Optional[List[str]] = None
    availability: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

    @validator("first_name", "last_name")
    def validate_names(cls, v):
        if v:
            return validate_employee_name(v)
        return v

    @validator("phone")
    def validate_phone(cls, v):
        if v:
            return validate_phone_number(v)
        return v

    @validator("hourly_rate")
    def validate_rate(cls, v):
        return validate_hourly_rate(v)

    @validator("max_hours_per_week")
    def validate_max_hours(cls, v):
        if v:
            return validate_max_hours_per_week(v)
        return v

    @validator("qualifications")
    def validate_quals(cls, v):
        if v:
            return validate_qualifications(v)
        return v

    @validator("availability")
    def validate_availability_data(cls, v):
        if v:
            return validate_availability_pattern(v)
        return v


class EmployeeResponse(EmployeeBase):
    """Employee response schema."""

    id: int
    full_name: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @classmethod
    def model_validate(cls, obj, **kwargs):
        """Custom validation to compute full_name from model attributes."""
        if hasattr(obj, 'first_name') and hasattr(obj, 'last_name'):
            # Add full_name if not already present
            if not hasattr(obj, '_full_name_computed'):
                obj._full_name_computed = True
        return super().model_validate(obj, **kwargs)


# Enhanced Shift schemas
class ShiftBase(BaseModel):
    """Base shift schema with validation."""

    name: str = Field(..., min_length=1, max_length=100)
    shift_type: str = Field(..., min_length=1, max_length=50)
    start_time: time
    end_time: time
    required_staff: int = Field(1, ge=1)
    required_qualifications: List[str] = Field(default_factory=list)
    department: Optional[str] = Field(None, max_length=100)
    hourly_rate_multiplier: float = Field(1.0, ge=0, le=10)
    is_active: bool = True

    @validator("start_time", "end_time")
    def validate_times(cls, v):
        return validate_time_format(v)

    @validator("required_qualifications")
    def validate_required_quals(cls, v):
        return validate_qualifications(v)

    @root_validator
    def validate_time_range(cls, values):
        """Validate start time is before end time."""
        start_time = values.get("start_time")
        end_time = values.get("end_time")

        if start_time and end_time:
            validate_time_range(start_time, end_time)

        return values


class ShiftCreate(ShiftBase):
    """Shift creation schema."""

    pass


class ShiftUpdate(BaseModel):
    """Shift update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    shift_type: Optional[str] = Field(None, min_length=1, max_length=50)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    required_staff: Optional[int] = Field(None, ge=1)
    required_qualifications: Optional[List[str]] = None
    department: Optional[str] = Field(None, max_length=100)
    hourly_rate_multiplier: Optional[float] = Field(None, ge=0, le=10)
    is_active: Optional[bool] = None

    @validator("start_time", "end_time")
    def validate_times(cls, v):
        if v:
            return validate_time_format(v)
        return v

    @validator("required_qualifications")
    def validate_required_quals(cls, v):
        if v:
            return validate_qualifications(v)
        return v


class ShiftResponse(ShiftBase):
    """Shift response schema."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Enhanced Schedule schemas
class ScheduleBase(BaseModel):
    """Base schedule schema with business logic validation."""

    employee_id: int = Field(..., ge=1)
    shift_id: int = Field(..., ge=1)
    date: date
    status: ScheduleStatus = ScheduleStatus.SCHEDULED
    notes: Optional[str] = Field(None, max_length=500)
    overtime_approved: bool = False

    @validator("date")
    def validate_schedule_date(cls, v):
        """Validate schedule date is not in the past."""
        if v < date.today():
            raise ValueError("Schedule date cannot be in the past")
        return v


class ScheduleCreate(ScheduleBase):
    """Schedule creation schema with conflict validation."""

    def validate_business_rules(
        self, employee_data: Dict[str, Any], shift_data: Dict[str, Any], existing_schedules: List[Dict[str, Any]]
    ):
        """Validate business rules for schedule creation."""

        # Check shift conflicts
        BusinessLogicValidator.validate_schedule_conflicts(
            employee_id=self.employee_id,
            shift_date=self.date,
            shift_start=shift_data["start_time"],
            shift_end=shift_data["end_time"],
            existing_schedules=existing_schedules,
        )

        # Check employee qualifications
        BusinessLogicValidator.validate_employee_qualifications(
            employee_qualifications=employee_data.get("qualifications", []),
            required_qualifications=shift_data.get("required_qualifications", []),
        )

        # Check employee availability
        BusinessLogicValidator.validate_employee_availability(
            employee_availability=employee_data.get("availability", {}),
            shift_date=self.date,
            shift_start=shift_data["start_time"],
            shift_end=shift_data["end_time"],
        )

        # Check minimum rest period
        BusinessLogicValidator.validate_minimum_rest_period(
            employee_id=self.employee_id,
            shift_date=self.date,
            shift_start=shift_data["start_time"],
            shift_end=shift_data["end_time"],
            existing_schedules=existing_schedules,
        )


class ScheduleUpdate(BaseModel):
    """Schedule update schema."""

    employee_id: Optional[int] = Field(None, ge=1)
    shift_id: Optional[int] = Field(None, ge=1)
    date: Optional[date] = None
    status: Optional[ScheduleStatus] = None
    notes: Optional[str] = Field(None, max_length=500)
    overtime_approved: Optional[bool] = None

    @validator("date")
    def validate_schedule_date(cls, v):
        if v and v < date.today():
            raise ValueError("Schedule date cannot be in the past")
        return v


class ScheduleResponse(ScheduleBase):
    """Schedule response schema."""

    id: int
    created_at: datetime
    updated_at: datetime
    employee: EmployeeResponse
    shift: ShiftResponse

    model_config = ConfigDict(from_attributes=True)


# Enhanced Rule schemas
class RuleBase(BaseModel):
    """Base rule schema with constraint validation."""

    rule_type: RuleType
    original_text: str = Field(..., min_length=5, max_length=500)
    constraints: Dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(3, ge=1, le=5)
    employee_id: Optional[int] = Field(None, ge=1)
    is_active: bool = True

    @validator("constraints")
    def validate_rule_constraints(cls, v):
        return validate_constraints(v)

    @validator("original_text")
    def validate_rule_text(cls, v):
        if not v.strip():
            raise ValueError("Rule description cannot be empty")
        return v.strip()


class RuleCreate(RuleBase):
    """Rule creation schema."""

    pass


class RuleUpdate(BaseModel):
    """Rule update schema."""

    rule_type: Optional[RuleType] = None
    original_text: Optional[str] = Field(None, min_length=5, max_length=500)
    constraints: Optional[Dict[str, Any]] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    employee_id: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None

    @validator("constraints")
    def validate_rule_constraints(cls, v):
        if v:
            return validate_constraints(v)
        return v

    @validator("original_text")
    def validate_rule_text(cls, v):
        if v and not v.strip():
            raise ValueError("Rule description cannot be empty")
        return v.strip() if v else v


class RuleResponse(RuleBase):
    """Rule response schema."""

    id: int
    created_at: datetime
    updated_at: datetime
    employee: Optional[EmployeeResponse] = None

    model_config = ConfigDict(from_attributes=True)


# Authentication schemas
class LoginRequest(BaseModel):
    """Login request schema."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    """Registration request schema."""

    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @validator("first_name", "last_name")
    def validate_names(cls, v):
        return validate_employee_name(v)

    @validator("password")
    def validate_password(cls, v):
        return validate_password_strength(v)


class PasswordChangeRequest(BaseModel):
    """Password change request schema."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)

    @validator("new_password")
    def validate_new_password(cls, v):
        return validate_password_strength(v)

    @root_validator
    def validate_passwords_different(cls, values):
        current = values.get("current_password")
        new = values.get("new_password")

        if current and new and current == new:
            raise ValueError("New password must be different from current password")

        return values


class TokenResponse(BaseModel):
    """Token response schema."""

    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# Validation response schemas
class ValidationResult(BaseModel):
    """Validation result schema."""

    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class EmailValidationResponse(BaseModel):
    """Email validation response schema."""

    email: str
    is_available: bool
    is_valid_format: bool
    suggestion: Optional[str] = None


class ScheduleConflictCheck(BaseModel):
    """Schedule conflict check schema."""

    employee_id: int
    shift_date: date
    shift_start: time
    shift_end: time
    has_conflicts: bool
    conflicts: List[Dict[str, Any]] = Field(default_factory=list)


class BusinessRuleValidation(BaseModel):
    """Business rule validation schema."""

    rule_type: str
    validation_results: Dict[str, ValidationResult]
    overall_valid: bool
    can_proceed_with_warnings: bool


# Query parameter schemas
class PaginationParams(BaseModel):
    """Pagination parameters."""

    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)


class EmployeeFilters(PaginationParams):
    """Employee query filters."""

    role: Optional[EmployeeRole] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None
    sort_by: str = Field("first_name", regex="^(first_name|last_name|email|role|created_at)$")
    sort_order: str = Field("asc", regex="^(asc|desc)$")


class ScheduleFilters(PaginationParams):
    """Schedule query filters."""

    employee_id: Optional[int] = Field(None, ge=1)
    shift_id: Optional[int] = Field(None, ge=1)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    status: Optional[ScheduleStatus] = None
    sort_by: str = Field("date", regex="^(date|employee_id|shift_id|status|created_at)$")
    sort_order: str = Field("desc", regex="^(asc|desc)$")

    @root_validator
    def validate_date_range(cls, values):
        date_from = values.get("date_from")
        date_to = values.get("date_to")

        if date_from and date_to and date_from > date_to:
            raise ValueError("Start date must be before end date")

        return values


class RuleFilters(PaginationParams):
    """Rule query filters."""

    rule_type: Optional[RuleType] = None
    employee_id: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    sort_by: str = Field("created_at", regex="^(rule_type|priority|employee_id|created_at)$")
    sort_order: str = Field("desc", regex="^(asc|desc)$")


# Export all schemas
__all__ = [
    "EmployeeRole",
    "RuleType",
    "ScheduleStatus",
    "NotificationType",
    "Priority",
    "EmployeeBase",
    "EmployeeCreate",
    "EmployeeUpdate",
    "EmployeeResponse",
    "ShiftBase",
    "ShiftCreate",
    "ShiftUpdate",
    "ShiftResponse",
    "ScheduleBase",
    "ScheduleCreate",
    "ScheduleUpdate",
    "ScheduleResponse",
    "RuleBase",
    "RuleCreate",
    "RuleUpdate",
    "RuleResponse",
    "LoginRequest",
    "RegisterRequest",
    "PasswordChangeRequest",
    "TokenResponse",
    "ValidationResult",
    "EmailValidationResponse",
    "ScheduleConflictCheck",
    "BusinessRuleValidation",
    "PaginationParams",
    "EmployeeFilters",
    "ScheduleFilters",
    "RuleFilters",
]
