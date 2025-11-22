"""
Pydantic schemas for schedule conflict detection and reporting.
"""

from datetime import date, time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ConflictDetail(BaseModel):
    """Individual conflict detail schema."""

    model_config = ConfigDict(from_attributes=True)

    conflict_type: str = Field(..., description="Type of conflict detected")
    severity: str = Field(..., description="Severity level: critical, high, medium, low, info")
    message: str = Field(..., description="Human-readable conflict description")
    suggested_resolution: str = Field(..., description="Actionable resolution suggestion")

    # Optional context fields
    employee_id: Optional[int] = Field(None, description="Employee involved in conflict")
    employee_name: Optional[str] = Field(None, description="Employee name")
    shift_id: Optional[int] = Field(None, description="Shift involved in conflict")
    shift_date: Optional[str] = Field(None, description="Shift date (ISO format)")

    # Conflict-specific fields
    assignment_id: Optional[int] = None
    previous_shift_id: Optional[int] = None
    next_shift_id: Optional[int] = None

    # Time-related fields
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    previous_shift_end: Optional[str] = None
    next_shift_start: Optional[str] = None

    # Duration and hour tracking
    current_hours: Optional[float] = None
    total_hours: Optional[float] = None
    limit: Optional[float] = None
    excess_hours: Optional[float] = None
    shortage_hours: Optional[float] = None
    rest_hours: Optional[float] = None
    required_rest_hours: Optional[float] = None

    # Staffing fields
    required_staff: Optional[int] = None
    assigned_staff: Optional[int] = None
    shortage: Optional[int] = None
    excess: Optional[int] = None

    # Period information
    period: Optional[str] = None  # daily, weekly
    week_start: Optional[str] = None
    week_end: Optional[str] = None

    # Qualification fields
    required_qualifications: Optional[List[str]] = None
    missing_qualifications: Optional[List[str]] = None

    # Availability fields
    day: Optional[str] = None
    time_slot: Optional[str] = Field(None, alias="time")


class ConflictSummary(BaseModel):
    """Summary of detected conflicts."""

    model_config = ConfigDict(from_attributes=True)

    total_shifts: int = Field(..., description="Total shifts analyzed")
    total_conflicts: int = Field(..., description="Total conflicts detected")
    critical_conflicts: int = Field(..., description="Critical severity conflicts")
    high_conflicts: int = Field(..., description="High severity conflicts")
    medium_conflicts: int = Field(..., description="Medium severity conflicts")
    low_conflicts: int = Field(..., description="Low severity conflicts")
    coverage_issues: int = Field(..., description="Coverage-related issues")


class ConflictsBySeverity(BaseModel):
    """Conflicts categorized by severity level."""

    model_config = ConfigDict(from_attributes=True)

    critical: List[ConflictDetail] = Field(default_factory=list)
    high: List[ConflictDetail] = Field(default_factory=list)
    medium: List[ConflictDetail] = Field(default_factory=list)
    low: List[ConflictDetail] = Field(default_factory=list)


class ConflictReportPeriod(BaseModel):
    """Date period for conflict report."""

    model_config = ConfigDict(from_attributes=True)

    start_date: str = Field(..., description="Start date (ISO format)")
    end_date: str = Field(..., description="End date (ISO format)")


class ConflictReport(BaseModel):
    """Comprehensive conflict detection report."""

    model_config = ConfigDict(from_attributes=True)

    department_id: int = Field(..., description="Department analyzed")
    period: ConflictReportPeriod = Field(..., description="Date range analyzed")
    summary: ConflictSummary = Field(..., description="Conflict summary statistics")
    conflicts_by_severity: ConflictsBySeverity = Field(..., description="Conflicts grouped by severity")
    coverage_issues: List[ConflictDetail] = Field(default_factory=list, description="Coverage-specific issues")
    recommendations: List[str] = Field(default_factory=list, description="Actionable recommendations")


class ValidateAssignmentRequest(BaseModel):
    """Request to validate employee assignment to shift."""

    model_config = ConfigDict(from_attributes=True)

    employee_id: int = Field(..., description="Employee to assign", gt=0)
    shift_id: int = Field(..., description="Shift to assign to", gt=0)
    exclude_assignment_id: Optional[int] = Field(None, description="Assignment ID to exclude (for updates)")


class ValidateAssignmentResponse(BaseModel):
    """Response from assignment validation."""

    model_config = ConfigDict(from_attributes=True)

    valid: bool = Field(..., description="Whether assignment is valid")
    conflicts: List[ConflictDetail] = Field(default_factory=list, description="Detected conflicts")
    can_proceed: bool = Field(..., description="Whether assignment can proceed despite conflicts")
    warnings: List[str] = Field(default_factory=list, description="Warning messages")


class CheckCoverageRequest(BaseModel):
    """Request to check department coverage."""

    model_config = ConfigDict(from_attributes=True)

    department_id: int = Field(..., description="Department to check", gt=0)
    shift_date: date = Field(..., description="Date to check coverage")
    start_time: time = Field(..., description="Period start time")
    end_time: time = Field(..., description="Period end time")
    required_staff: int = Field(1, description="Required staff count", ge=1)


class CheckCoverageResponse(BaseModel):
    """Response from coverage check."""

    model_config = ConfigDict(from_attributes=True)

    adequate_coverage: bool = Field(..., description="Whether coverage is adequate")
    issues: List[ConflictDetail] = Field(default_factory=list, description="Coverage issues detected")


class ConflictDetectionSettings(BaseModel):
    """Configurable settings for conflict detection."""

    model_config = ConfigDict(from_attributes=True)

    max_hours_per_day: float = Field(12.0, description="Maximum hours per day", ge=1, le=24)
    max_hours_per_week: float = Field(40.0, description="Maximum hours per week", ge=1, le=168)
    minimum_rest_hours: float = Field(8.0, description="Minimum rest hours between shifts", ge=0, le=24)
    enforce_qualifications: bool = Field(True, description="Enforce qualification requirements")
    enforce_availability: bool = Field(True, description="Enforce employee availability")
    allow_overtime: bool = Field(False, description="Allow overtime shifts")


class BulkValidationRequest(BaseModel):
    """Request to validate multiple assignments at once."""

    model_config = ConfigDict(from_attributes=True)

    assignments: List[ValidateAssignmentRequest] = Field(..., description="Assignments to validate")
    settings: Optional[ConflictDetectionSettings] = Field(None, description="Custom validation settings")
    stop_on_critical: bool = Field(True, description="Stop validation on critical conflicts")


class BulkValidationResponse(BaseModel):
    """Response from bulk validation."""

    model_config = ConfigDict(from_attributes=True)

    total_validated: int = Field(..., description="Total assignments validated")
    valid_assignments: int = Field(..., description="Valid assignments count")
    invalid_assignments: int = Field(..., description="Invalid assignments count")
    results: List[ValidateAssignmentResponse] = Field(default_factory=list, description="Individual validation results")
    overall_conflicts: List[ConflictDetail] = Field(default_factory=list, description="All conflicts detected")


class ConflictResolutionSuggestion(BaseModel):
    """Suggested resolution for a conflict."""

    model_config = ConfigDict(from_attributes=True)

    conflict_id: str = Field(..., description="Conflict identifier")
    suggestion_type: str = Field(..., description="Type of suggestion: reassign, adjust_time, add_staff, etc.")
    description: str = Field(..., description="Human-readable suggestion")
    automated: bool = Field(False, description="Whether this can be automated")
    priority: int = Field(1, description="Priority order for resolution", ge=1, le=10)

    # Resolution-specific fields
    target_employee_id: Optional[int] = None
    alternative_shift_id: Optional[int] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None
    additional_staff_needed: Optional[int] = None
