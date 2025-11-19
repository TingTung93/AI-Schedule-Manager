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
