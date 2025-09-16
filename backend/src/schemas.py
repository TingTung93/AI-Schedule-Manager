"""
Pydantic schemas for request/response models with enhanced validation.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date, time
from pydantic import BaseModel, EmailStr, Field, ConfigDict, validator, root_validator
from enum import Enum
from .validators import (
    validate_phone_number,
    validate_employee_name,
    validate_hourly_rate,
    validate_max_hours_per_week,
    validate_availability_pattern,
    validate_qualifications,
    validate_constraints,
    validate_time_format,
    validate_time_range,
    validate_password_strength
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


# Base schemas
class PaginatedResponse(BaseModel):
    """Base paginated response."""
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


# Employee schemas
class EmployeeBase(BaseModel):
    """Base employee schema."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: EmployeeRole
    phone: Optional[str] = Field(None, max_length=50)
    hourly_rate: Optional[float] = Field(None, ge=0)
    max_hours_per_week: Optional[int] = Field(40, ge=1, le=168)
    qualifications: Optional[List[str]] = Field(default_factory=list)
    availability_pattern: Optional[Dict[str, Any]] = None
    active: bool = True


class EmployeeCreate(EmployeeBase):
    """Employee creation schema."""
    pass


class EmployeeUpdate(BaseModel):
    """Employee update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    hourly_rate: Optional[float] = Field(None, ge=0)
    max_hours_per_week: Optional[int] = Field(None, ge=1, le=168)
    qualifications: Optional[List[str]] = None
    availability_pattern: Optional[Dict[str, Any]] = None
    active: Optional[bool] = None


class EmployeeResponse(EmployeeBase):
    """Employee response schema."""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Rule schemas
class RuleBase(BaseModel):
    """Base rule schema."""
    rule_type: RuleType
    original_text: str = Field(..., min_length=1)
    constraints: Dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(1, ge=1, le=5)
    employee_id: Optional[int] = None
    active: bool = True


class RuleCreate(RuleBase):
    """Rule creation schema."""
    pass


class RuleUpdate(BaseModel):
    """Rule update schema."""
    rule_type: Optional[RuleType] = None
    original_text: Optional[str] = Field(None, min_length=1)
    constraints: Optional[Dict[str, Any]] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    employee_id: Optional[int] = None
    active: Optional[bool] = None


class RuleResponse(RuleBase):
    """Rule response schema."""
    id: int
    created_at: datetime
    updated_at: datetime
    employee: Optional[EmployeeResponse] = None

    model_config = ConfigDict(from_attributes=True)


class RuleParseRequest(BaseModel):
    """Rule parsing request schema."""
    rule_text: str = Field(..., min_length=1)


# Shift schemas
class ShiftBase(BaseModel):
    """Base shift schema."""
    name: str = Field(..., min_length=1, max_length=100)
    shift_type: str = Field(..., min_length=1, max_length=50)
    start_time: time
    end_time: time
    required_staff: int = Field(1, ge=1)
    required_qualifications: Optional[List[str]] = Field(default_factory=list)
    department: Optional[str] = Field(None, max_length=100)
    hourly_rate_multiplier: float = Field(1.0, ge=0)
    active: bool = True


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
    hourly_rate_multiplier: Optional[float] = Field(None, ge=0)
    active: Optional[bool] = None


class ShiftResponse(ShiftBase):
    """Shift response schema."""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Schedule schemas
class ScheduleBase(BaseModel):
    """Base schedule schema."""
    employee_id: int
    shift_id: int
    date: date
    status: ScheduleStatus = ScheduleStatus.SCHEDULED
    notes: Optional[str] = None
    overtime_approved: bool = False


class ScheduleCreate(ScheduleBase):
    """Schedule creation schema."""
    pass


class ScheduleUpdate(BaseModel):
    """Schedule update schema."""
    employee_id: Optional[int] = None
    shift_id: Optional[int] = None
    date: Optional[date] = None
    status: Optional[ScheduleStatus] = None
    notes: Optional[str] = None
    overtime_approved: Optional[bool] = None


class ScheduleResponse(ScheduleBase):
    """Schedule response schema."""
    id: int
    created_at: datetime
    updated_at: datetime
    employee: EmployeeResponse
    shift: ShiftResponse

    model_config = ConfigDict(from_attributes=True)


# Notification schemas
class NotificationBase(BaseModel):
    """Base notification schema."""
    employee_id: Optional[int] = None
    notification_type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    read: bool = False
    priority: Priority = Priority.NORMAL
    metadata: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    """Notification creation schema."""
    pass


class NotificationUpdate(BaseModel):
    """Notification update schema."""
    read: Optional[bool] = None
    priority: Optional[Priority] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationResponse(NotificationBase):
    """Notification response schema."""
    id: int
    created_at: datetime
    updated_at: datetime
    employee: Optional[EmployeeResponse] = None

    model_config = ConfigDict(from_attributes=True)


# Schedule generation schemas
class ScheduleGenerateRequest(BaseModel):
    """Schedule generation request schema."""
    start_date: date
    end_date: date
    template_id: Optional[int] = None
    constraints: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ScheduleOptimizeRequest(BaseModel):
    """Schedule optimization request schema."""
    schedule_ids: List[int]
    optimization_goals: Optional[List[str]] = Field(default_factory=lambda: ["cost", "coverage", "satisfaction"])


# Authentication schemas
class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Token response schema."""
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# Analytics schemas
class AnalyticsOverview(BaseModel):
    """Analytics overview schema."""
    total_employees: int
    total_rules: int
    total_schedules: int
    avg_hours_per_week: float
    labor_cost_trend: str
    optimization_score: int


# Query parameter schemas
class EmployeeFilters(BaseModel):
    """Employee query filters."""
    role: Optional[EmployeeRole] = None
    active: Optional[bool] = None
    search: Optional[str] = None
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = "name"
    sort_order: Optional[str] = Field("asc", regex="^(asc|desc)$")


class RuleFilters(BaseModel):
    """Rule query filters."""
    rule_type: Optional[RuleType] = None
    employee_id: Optional[int] = None
    active: Optional[bool] = None
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = Field("desc", regex="^(asc|desc)$")


class ScheduleFilters(BaseModel):
    """Schedule query filters."""
    employee_id: Optional[int] = None
    shift_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    status: Optional[ScheduleStatus] = None
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = "date"
    sort_order: Optional[str] = Field("desc", regex="^(asc|desc)$")


class NotificationFilters(BaseModel):
    """Notification query filters."""
    employee_id: Optional[int] = None
    notification_type: Optional[NotificationType] = None
    read: Optional[bool] = None
    priority: Optional[Priority] = None
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = Field("desc", regex="^(asc|desc)$")