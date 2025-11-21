"""
Pydantic schemas for request/response models with enhanced validation.
"""

from datetime import date, datetime, time
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, root_validator, validator

from .validators import (
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
    EMPLOYEE = "employee"
    SERVER = "server"
    COOK = "cook"
    CASHIER = "cashier"
    CLEANER = "cleaner"
    SECURITY = "security"


# Department schemas
class DepartmentBase(BaseModel):
    """Base department schema."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    active: bool = True


class DepartmentCreate(DepartmentBase):
    """Department creation schema."""

    @field_validator('parent_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None for optional parent_id field."""
        if v == '' or v is None:
            return None
        return v


class DepartmentUpdate(BaseModel):
    """Department update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    settings: Optional[Dict[str, Any]] = None
    active: Optional[bool] = None


class DepartmentResponse(DepartmentBase):
    """Department response schema."""

    id: int
    created_at: datetime
    updated_at: datetime
    parent_id: Optional[int] = None  # Only include parent ID, not full object to avoid recursion
    children: List["DepartmentResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


# Employee schemas
class EmployeeBase(BaseModel):
    """Base employee schema."""

    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    hourly_rate: Optional[float] = Field(None, ge=0)
    max_hours_per_week: Optional[int] = Field(40, ge=1, le=168)
    qualifications: Optional[List[str]] = Field(default_factory=list)
    availability_pattern: Optional[Dict[str, Any]] = None
    department_id: Optional[int] = None
    active: bool = True


class EmployeeCreate(BaseModel):
    """Employee creation schema - only first_name and last_name required."""

    first_name: str = Field(..., min_length=1, max_length=50, alias='firstName')
    last_name: str = Field(..., min_length=1, max_length=50, alias='lastName')
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    department_id: Optional[int] = Field(None, alias='department', gt=0, description="Department ID for employee assignment")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator('email', 'department_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None for optional fields."""
        if v == '' or v is None:
            return None
        return v


class EmployeeUpdate(BaseModel):
    """Employee update schema."""

    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    hourly_rate: Optional[float] = Field(None, ge=0)
    max_hours_per_week: Optional[int] = Field(None, ge=1, le=168)
    qualifications: Optional[List[str]] = None
    availability_pattern: Optional[Dict[str, Any]] = None
    department_id: Optional[int] = Field(None, gt=0, description="Department ID for employee assignment")
    active: Optional[bool] = None

    @field_validator('department_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None for department_id."""
        if v == '' or v is None:
            return None
        return v


class EmployeeResponse(BaseModel):
    """Employee response schema - maps to User model."""

    id: int
    first_name: str
    last_name: str
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    department_id: Optional[int] = Field(None, description="Department ID if employee is assigned to a department")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @property
    def full_name(self) -> str:
        """Compute full name from first and last name."""
        return f"{self.first_name} {self.last_name}"

    # Optional fields that may not exist in User model
    role: Optional[str] = None
    phone: Optional[str] = None

    # Nested department object (will be populated when relationship is loaded via joinedload)
    department: Optional[DepartmentResponse] = Field(None, description="Department details if assigned and loaded")


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
    department_id: Optional[int] = None
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
    department_id: Optional[int] = None
    hourly_rate_multiplier: Optional[float] = Field(None, ge=0)
    active: Optional[bool] = None


class ShiftResponse(ShiftBase):
    """Shift response schema."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Shift Definition schemas (reusable shift templates)
class ShiftDefinitionBase(BaseModel):
    """Base schema for shift definitions (reusable templates)."""

    name: str = Field(..., min_length=1, max_length=100, description="Shift name")
    abbreviation: str = Field(..., min_length=1, max_length=10, description="Short abbreviation")
    shift_type: str = Field(
        default="custom",
        description="Type: morning, afternoon, evening, night, split, on-call, custom"
    )
    start_time: time = Field(..., description="Shift start time")
    end_time: time = Field(..., description="Shift end time")
    color: str = Field(default="#1976d2", min_length=7, max_length=7, description="Hex color code")
    required_staff: int = Field(default=1, ge=1, description="Minimum required staff")
    department_id: Optional[int] = Field(None, description="Department ID (None for organization-wide)")
    hourly_rate_multiplier: float = Field(
        default=1.0,
        gt=0,
        le=5.0,
        description="Pay rate multiplier"
    )
    required_qualifications: Optional[dict] = Field(None, description="Required qualifications")
    is_active: bool = Field(default=True, description="Whether shift is active")
    description: Optional[str] = Field(None, max_length=500, description="Shift description")

    @validator("shift_type")
    def validate_shift_type(cls, v):
        """Validate shift type."""
        valid_types = ["morning", "afternoon", "evening", "night", "split", "on-call", "custom"]
        if v not in valid_types:
            raise ValueError(f"shift_type must be one of: {', '.join(valid_types)}")
        return v

    @validator("color")
    def validate_color(cls, v):
        """Validate hex color code."""
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("color must be a valid hex code (e.g., #1976d2)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("color must be a valid hex code")
        return v

    @validator("abbreviation")
    def validate_abbreviation(cls, v):
        """Convert abbreviation to uppercase."""
        return v.upper()


class ShiftDefinitionCreate(ShiftDefinitionBase):
    """Schema for creating a shift definition."""
    pass


class ShiftDefinitionUpdate(BaseModel):
    """Schema for updating a shift definition (all fields optional)."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    abbreviation: Optional[str] = Field(None, min_length=1, max_length=10)
    shift_type: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    color: Optional[str] = Field(None, min_length=7, max_length=7)
    required_staff: Optional[int] = Field(None, ge=1)
    department_id: Optional[int] = None
    hourly_rate_multiplier: Optional[float] = Field(None, gt=0, le=5.0)
    required_qualifications: Optional[dict] = None
    is_active: Optional[bool] = None
    description: Optional[str] = Field(None, max_length=500)

    @validator("shift_type")
    def validate_shift_type(cls, v):
        """Validate shift type if provided."""
        if v is not None:
            valid_types = ["morning", "afternoon", "evening", "night", "split", "on-call", "custom"]
            if v not in valid_types:
                raise ValueError(f"shift_type must be one of: {', '.join(valid_types)}")
        return v

    @validator("color")
    def validate_color(cls, v):
        """Validate hex color code if provided."""
        if v is not None:
            if not v.startswith("#") or len(v) != 7:
                raise ValueError("color must be a valid hex code (e.g., #1976d2)")
            try:
                int(v[1:], 16)
            except ValueError:
                raise ValueError("color must be a valid hex code")
        return v

    @validator("abbreviation")
    def validate_abbreviation(cls, v):
        """Convert abbreviation to uppercase if provided."""
        return v.upper() if v else None


class ShiftDefinitionResponse(ShiftDefinitionBase):
    """Schema for shift definition responses."""

    id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# Schedule schemas (updated to match new model)
class ScheduleBase(BaseModel):
    """Base schedule schema for weekly schedules."""

    week_start: date
    week_end: date
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class ScheduleCreate(ScheduleBase):
    """Schedule creation schema."""

    pass


class ScheduleUpdate(BaseModel):
    """Schedule update schema."""

    week_start: Optional[date] = None
    week_end: Optional[date] = None
    title: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ScheduleAssignmentBase(BaseModel):
    """Base schedule assignment schema."""

    employee_id: int
    shift_id: int
    status: str = "assigned"
    priority: int = Field(3, ge=1, le=10)
    notes: Optional[str] = None


class ScheduleAssignmentCreate(ScheduleAssignmentBase):
    """Schedule assignment creation schema."""

    pass


class ScheduleAssignmentUpdate(BaseModel):
    """Schedule assignment update schema."""

    status: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None


class ScheduleAssignmentResponse(ScheduleAssignmentBase):
    """Schedule assignment response schema."""

    id: int
    schedule_id: int
    assigned_by: Optional[int] = None
    assigned_at: datetime
    conflicts_resolved: bool
    auto_assigned: bool
    created_at: datetime
    employee: Optional[EmployeeResponse] = None
    shift: Optional[ShiftResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ScheduleResponse(ScheduleBase):
    """Schedule response schema."""

    id: int
    status: str
    version: int
    parent_schedule_id: Optional[int] = None
    created_by: int
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    creator: Optional[EmployeeResponse] = None
    approver: Optional[EmployeeResponse] = None
    assignments: List[ScheduleAssignmentResponse] = Field(default_factory=list)

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
    sort_order: Optional[str] = Field("asc", pattern="^(asc|desc)$")


class RuleFilters(BaseModel):
    """Rule query filters."""

    rule_type: Optional[RuleType] = None
    employee_id: Optional[int] = None
    active: Optional[bool] = None
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$")


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
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$")


class NotificationFilters(BaseModel):
    """Notification query filters."""

    employee_id: Optional[int] = None
    notification_type: Optional[NotificationType] = None
    read: Optional[bool] = None
    priority: Optional[Priority] = None
    page: int = Field(1, ge=1)
    size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = "created_at"
    sort_order: Optional[str] = Field("desc", pattern="^(asc|desc)$")


# Analytics response models
class AnalyticsOverviewResponse(BaseModel):
    """Analytics overview response."""

    totalEmployees: int = Field(..., description="Total number of active employees")
    totalSchedules: int = Field(..., description="Total number of published/approved schedules")
    totalHours: float = Field(..., description="Total hours worked across all shifts")
    efficiency: float = Field(..., description="Efficiency percentage (confirmed/total assignments)")
    overtimeHours: float = Field(..., description="Total overtime hours (shifts > 8 hours)")

    model_config = ConfigDict(from_attributes=True)


class LaborCostData(BaseModel):
    """Labor cost data point."""

    date: str = Field(..., description="Date in ISO format")
    cost: float = Field(..., description="Labor cost for the date")
    hours: float = Field(..., description="Total hours for the date")

    model_config = ConfigDict(from_attributes=True)


class LaborCostsResponse(BaseModel):
    """Labor costs response."""

    data: List[LaborCostData] = Field(..., description="Daily labor cost data")
    total: float = Field(..., description="Total labor cost for the period")
    average: float = Field(..., description="Average daily labor cost")

    model_config = ConfigDict(from_attributes=True)


class PerformanceMetricsResponse(BaseModel):
    """Employee performance metrics response."""

    averageRating: float = Field(..., description="Average employee rating (1-5 scale)")
    completionRate: float = Field(..., description="Percentage of completed shifts")
    punctuality: float = Field(..., description="Percentage of non-declined shifts")

    model_config = ConfigDict(from_attributes=True)


class EfficiencyMetricsResponse(BaseModel):
    """Schedule efficiency metrics response."""

    utilizationRate: float = Field(..., description="Percentage of shifts with assignments")
    schedulingAccuracy: float = Field(..., description="Percentage of confirmed/completed assignments")
    costEfficiency: float = Field(..., description="Percentage of fully staffed shifts")

    model_config = ConfigDict(from_attributes=True)


# Settings response models
class NotificationSettings(BaseModel):
    """Notification settings."""

    email: bool = True
    push: bool = False
    scheduleReminders: bool = True
    overtimeAlerts: bool = True

    model_config = ConfigDict(from_attributes=True)


class AppearanceSettings(BaseModel):
    """Appearance settings."""

    theme: str = "light"
    language: str = "en"
    timezone: str = "America/New_York"

    model_config = ConfigDict(from_attributes=True)


class SchedulingSettings(BaseModel):
    """Scheduling preferences."""

    defaultShiftLength: int = 8
    maxOvertimeHours: int = 10
    breakDuration: int = 30
    autoApproveRequests: bool = False

    model_config = ConfigDict(from_attributes=True)


class SecuritySettings(BaseModel):
    """Security settings."""

    twoFactorAuth: bool = False
    sessionTimeout: int = 60

    model_config = ConfigDict(from_attributes=True)


class UserSettingsResponse(BaseModel):
    """User settings response."""

    notifications: NotificationSettings
    appearance: AppearanceSettings
    scheduling: SchedulingSettings
    security: SecuritySettings

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str = Field(..., description="Response message")
    success: bool = Field(True, description="Whether the operation was successful")

    model_config = ConfigDict(from_attributes=True)


class SettingsUpdateResponse(BaseModel):
    """Response for settings update operation."""

    message: str = Field(..., description="Success message")
    settings: UserSettingsResponse = Field(..., description="Updated settings")

    model_config = ConfigDict(from_attributes=True)


# AI Schedule Generation Schemas
class GenerationRequirements(BaseModel):
    """Requirements for AI schedule generation."""

    start_date: date = Field(..., description="Schedule start date")
    end_date: date = Field(..., description="Schedule end date")
    employee_ids: Optional[List[int]] = Field(None, description="Specific employees to include (optional)")
    shift_template_ids: Optional[List[int]] = Field(None, description="Shift templates to use (optional)")
    constraints: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional constraints")

    model_config = ConfigDict(from_attributes=True)


class ConflictDetail(BaseModel):
    """Details about a scheduling conflict."""

    type: str = Field(..., description="Conflict type (double_booking, qualification_mismatch, etc.)")
    employee_id: Optional[int] = Field(None, description="Employee involved in conflict")
    employee_name: Optional[str] = Field(None, description="Employee name")
    assignment_ids: Optional[List[int]] = Field(None, description="Assignment IDs involved")
    shift_id: Optional[int] = Field(None, description="Shift ID involved")
    shift_date: Optional[str] = Field(None, description="Shift date (ISO format)")
    description: str = Field(..., description="Human-readable conflict description")
    severity: str = Field("medium", description="Conflict severity (low, medium, high)")

    model_config = ConfigDict(from_attributes=True)


class CoverageStats(BaseModel):
    """Schedule coverage statistics."""

    total_shifts: int = Field(..., description="Total number of shifts")
    assigned_shifts: int = Field(..., description="Number of shifts with assignments")
    coverage_percentage: float = Field(..., description="Percentage of shifts covered")
    total_assignments: int = Field(..., description="Total number of assignments")
    unique_employees: int = Field(..., description="Number of unique employees assigned")

    model_config = ConfigDict(from_attributes=True)


class GenerationResponse(BaseModel):
    """Response from AI schedule generation."""

    status: str = Field(..., description="Generation status (optimal, feasible, infeasible, error)")
    message: str = Field(..., description="Status message")
    saved_assignments: Optional[int] = Field(None, description="Number of assignments saved to database")
    schedule: List[Dict[str, Any]] = Field(default_factory=list, description="Generated schedule data")
    conflicts: Optional[List[ConflictDetail]] = Field(default_factory=list, description="Detected conflicts")
    coverage: Optional[CoverageStats] = Field(None, description="Coverage statistics")
    optimization_score: Optional[float] = Field(None, description="Overall schedule quality score (0-100)")

    model_config = ConfigDict(from_attributes=True)


class ValidationResponse(BaseModel):
    """Response from schedule validation."""

    schedule_id: int = Field(..., description="Schedule ID validated")
    is_valid: bool = Field(..., description="Whether schedule is valid")
    conflicts: List[ConflictDetail] = Field(default_factory=list, description="List of conflicts found")
    conflict_count: int = Field(..., description="Total number of conflicts")
    warnings: List[str] = Field(default_factory=list, description="Non-critical warnings")
    validation_timestamp: datetime = Field(default_factory=datetime.utcnow, description="When validation occurred")

    model_config = ConfigDict(from_attributes=True)


class OptimizationGoals(BaseModel):
    """Goals for schedule optimization."""

    minimize_overtime: bool = Field(False, description="Minimize overtime hours")
    maximize_coverage: bool = Field(True, description="Ensure all shifts are covered")
    balance_workload: bool = Field(True, description="Distribute shifts evenly among employees")
    prefer_qualifications: bool = Field(True, description="Match employee skills to shift requirements")
    minimize_cost: bool = Field(False, description="Minimize total labor cost")

    model_config = ConfigDict(from_attributes=True)


class OptimizationSuggestion(BaseModel):
    """Individual optimization suggestion."""

    type: str = Field(..., description="Suggestion type (swap, reassign, remove, add)")
    current_assignment_id: Optional[int] = Field(None, description="Current assignment ID to modify")
    suggested_employee_id: Optional[int] = Field(None, description="Suggested employee for reassignment")
    shift_id: int = Field(..., description="Shift ID involved")
    rationale: str = Field(..., description="Explanation of why this optimization helps")
    impact_score: float = Field(..., description="Expected improvement score (0-100)")

    model_config = ConfigDict(from_attributes=True)


class OptimizationResponse(BaseModel):
    """Response from schedule optimization."""

    schedule_id: int = Field(..., description="Schedule ID optimized")
    status: str = Field(..., description="Optimization status (optimal, feasible, no_improvement)")
    suggestions: List[OptimizationSuggestion] = Field(default_factory=list, description="Optimization suggestions")
    improvement_score: float = Field(..., description="Overall improvement score (0-100)")
    estimated_savings: Optional[Dict[str, Any]] = Field(None, description="Estimated cost/time savings")
    current_coverage: Optional[CoverageStats] = Field(None, description="Current coverage before optimization")
    optimized_coverage: Optional[CoverageStats] = Field(None, description="Projected coverage after optimization")

    model_config = ConfigDict(from_attributes=True)


class PublishSettings(BaseModel):
    """Settings for publishing a schedule."""

    send_notifications: bool = Field(True, description="Send notifications to assigned employees")
    notification_method: str = Field("email", description="Notification method (email, push, both)")
    include_calendar_invite: bool = Field(True, description="Include calendar invitations")
    lock_assignments: bool = Field(True, description="Lock assignments to prevent further edits")

    model_config = ConfigDict(from_attributes=True)


class PublishResponse(BaseModel):
    """Response from schedule publishing."""

    schedule_id: int = Field(..., description="Published schedule ID")
    status: str = Field(..., description="Schedule status after publishing")
    published_at: datetime = Field(..., description="Publication timestamp")
    notifications_sent: int = Field(..., description="Number of notifications sent")
    employees_notified: List[int] = Field(default_factory=list, description="Employee IDs notified")

    model_config = ConfigDict(from_attributes=True)


# Assignment schemas
class AssignmentStatus(str, Enum):
    """Assignment status enumeration."""

    ASSIGNED = "assigned"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class AssignmentBase(BaseModel):
    """Base assignment schema."""

    employee_id: int = Field(..., gt=0, description="Employee ID")
    shift_id: int = Field(..., gt=0, description="Shift ID")
    status: Optional[AssignmentStatus] = Field(default=AssignmentStatus.ASSIGNED, description="Assignment status")
    priority: Optional[int] = Field(default=1, ge=1, le=10, description="Assignment priority")
    notes: Optional[str] = Field(None, max_length=1000, description="Assignment notes")


class AssignmentCreate(AssignmentBase):
    """Assignment creation schema."""

    pass


class AssignmentUpdate(BaseModel):
    """Assignment update schema."""

    employee_id: Optional[int] = Field(None, gt=0)
    shift_id: Optional[int] = Field(None, gt=0)
    status: Optional[AssignmentStatus] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = Field(None, max_length=1000)


class AssignmentResponse(AssignmentBase):
    """Assignment response schema."""

    id: int
    schedule_id: int
    assigned_by: Optional[int] = None
    assigned_at: datetime
    conflicts_resolved: bool
    auto_assigned: bool
    created_at: datetime
    is_active: bool
    is_confirmed: bool
    needs_confirmation: bool
    employee: EmployeeResponse
    shift: ShiftResponse

    model_config = ConfigDict(from_attributes=True)


class AssignmentBulkCreateRequest(BaseModel):
    """Bulk assignment creation request schema."""

    schedule_id: int = Field(..., gt=0, description="Schedule ID")
    assignments: List[AssignmentCreate] = Field(..., min_length=1, description="List of assignments to create")
    validate_conflicts: bool = Field(default=True, description="Whether to validate conflicts")


class AssignmentBulkCreateResponse(BaseModel):
    """Bulk assignment creation response schema."""

    created: List[AssignmentResponse] = Field(..., description="Successfully created assignments")
    errors: List[Dict[str, Any]] = Field(..., description="Validation errors")
    total_processed: int = Field(..., description="Total assignments processed")
    total_created: int = Field(..., description="Total assignments created")
    total_errors: int = Field(..., description="Total errors encountered")

    model_config = ConfigDict(from_attributes=True)


class AssignmentConfirmRequest(BaseModel):
    """Assignment confirmation request schema."""

    notes: Optional[str] = Field(None, max_length=500, description="Optional confirmation notes")


class AssignmentDeclineRequest(BaseModel):
    """Assignment decline request schema."""

    reason: Optional[str] = Field(None, max_length=500, description="Reason for declining")
"""
Pydantic schemas for Shift Definitions
"""

from datetime import time
from typing import Optional

from pydantic import BaseModel, Field, validator


class ShiftDefinitionBase(BaseModel):
    """Base schema for shift definitions"""

    name: str = Field(..., min_length=1, max_length=100, description="Shift name")
    abbreviation: str = Field(..., min_length=1, max_length=10, description="Short abbreviation")
    shift_type: str = Field(
        default="custom",
        description="Type: morning, afternoon, evening, night, split, on-call, custom"
    )
    start_time: time = Field(..., description="Shift start time (HH:MM)")
    end_time: time = Field(..., description="Shift end time (HH:MM)")
    color: str = Field(default="#1976d2", min_length=7, max_length=7, description="Hex color code")
    required_staff: int = Field(default=1, ge=1, description="Minimum required staff")
    department_id: Optional[int] = Field(None, description="Department ID (None for organization-wide)")
    hourly_rate_multiplier: float = Field(
        default=1.0,
        gt=0,
        le=5.0,
        description="Pay rate multiplier (e.g., 1.5 for overtime)"
    )
    required_qualifications: Optional[dict] = Field(None, description="Required qualifications")
    is_active: bool = Field(default=True, description="Whether shift is active")
    description: Optional[str] = Field(None, max_length=500, description="Shift description")

    @validator("shift_type")
    def validate_shift_type(cls, v):
        """Validate shift type"""
        valid_types = ["morning", "afternoon", "evening", "night", "split", "on-call", "custom"]
        if v not in valid_types:
            raise ValueError(f"shift_type must be one of: {', '.join(valid_types)}")
        return v

    @validator("color")
    def validate_color(cls, v):
        """Validate hex color code"""
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("color must be a valid hex code (e.g., #1976d2)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("color must be a valid hex code")
        return v

    @validator("abbreviation")
    def validate_abbreviation(cls, v):
        """Convert abbreviation to uppercase"""
        return v.upper()

    @validator("end_time")
    def validate_times(cls, end_time, values):
        """Validate that end_time is after start_time (for same-day shifts)"""
        start_time = values.get("start_time")
        if start_time and end_time <= start_time:
            # Allow overnight shifts where end_time < start_time
            # but not equal times
            if end_time == start_time:
                raise ValueError("end_time must be different from start_time")
        return end_time


class ShiftDefinitionCreate(ShiftDefinitionBase):
    """Schema for creating a shift definition"""
    pass


class ShiftDefinitionUpdate(BaseModel):
    """Schema for updating a shift definition (all fields optional)"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    abbreviation: Optional[str] = Field(None, min_length=1, max_length=10)
    shift_type: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    color: Optional[str] = Field(None, min_length=7, max_length=7)
    required_staff: Optional[int] = Field(None, ge=1)
    department_id: Optional[int] = None
    hourly_rate_multiplier: Optional[float] = Field(None, gt=0, le=5.0)
    required_qualifications: Optional[dict] = None
    is_active: Optional[bool] = None
    description: Optional[str] = Field(None, max_length=500)

    @validator("shift_type")
    def validate_shift_type(cls, v):
        """Validate shift type if provided"""
        if v is not None:
            valid_types = ["morning", "afternoon", "evening", "night", "split", "on-call", "custom"]
            if v not in valid_types:
                raise ValueError(f"shift_type must be one of: {', '.join(valid_types)}")
        return v

    @validator("color")
    def validate_color(cls, v):
        """Validate hex color code if provided"""
        if v is not None:
            if not v.startswith("#") or len(v) != 7:
                raise ValueError("color must be a valid hex code (e.g., #1976d2)")
            try:
                int(v[1:], 16)
            except ValueError:
                raise ValueError("color must be a valid hex code")
        return v

    @validator("abbreviation")
    def validate_abbreviation(cls, v):
        """Convert abbreviation to uppercase if provided"""
        return v.upper() if v else None


class ShiftDefinitionResponse(ShiftDefinitionBase):
    """Schema for shift definition responses"""

    id: int
    created_at: str
    updated_at: str
    duration_hours: float
    is_overnight: bool
    formatted_time_range: str
    created_by_id: Optional[int] = None

    @validator("created_at", "updated_at", pre=True)
    def convert_datetime_to_str(cls, v):
        """Convert datetime objects to ISO format strings"""
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    class Config:
        orm_mode = True
        from_attributes = True


class ShiftDefinitionList(BaseModel):
    """Schema for paginated shift definition list"""

    items: list[ShiftDefinitionResponse]
    total: int
    page: int
    size: int
    pages: int
