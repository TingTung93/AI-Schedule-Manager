"""
Pydantic schemas for Department Assignment History

Defines request/response schemas for audit logging endpoints.
Following REST API best practices with proper validation.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class DepartmentHistoryBase(BaseModel):
    """Base schema for department history records."""

    employee_id: int = Field(..., description="ID of the employee")
    from_department_id: Optional[int] = Field(None, description="Previous department ID (NULL if unassigned)")
    to_department_id: Optional[int] = Field(None, description="New department ID (NULL if being unassigned)")
    changed_by_user_id: int = Field(..., description="ID of user who made the change")
    change_reason: Optional[str] = Field(None, description="Reason for the department change")
    metadata: Optional[dict] = Field(default_factory=dict, description="Additional context as JSON")


class DepartmentHistoryCreate(DepartmentHistoryBase):
    """Schema for creating a new department history record."""
    pass


class DepartmentHistoryResponse(DepartmentHistoryBase):
    """
    Schema for department history response.

    Includes all fields from the database plus computed fields
    for employee and department names.
    """

    id: int = Field(..., description="Unique identifier for the history record")
    changed_at: datetime = Field(..., description="Timestamp when the change occurred")

    # Optional enriched data (loaded from joins)
    employee_name: Optional[str] = Field(None, description="Full name of the employee")
    from_department_name: Optional[str] = Field(None, description="Name of previous department")
    to_department_name: Optional[str] = Field(None, description="Name of new department")
    changed_by_name: Optional[str] = Field(None, description="Full name of user who made change")

    model_config = ConfigDict(from_attributes=True)


class DepartmentHistoryListResponse(BaseModel):
    """Schema for paginated list of department history records."""

    total: int = Field(..., description="Total number of history records")
    items: list[DepartmentHistoryResponse] = Field(..., description="List of history records")
    skip: int = Field(..., description="Number of records skipped")
    limit: int = Field(..., description="Maximum records returned")

    model_config = ConfigDict(from_attributes=True)


class DepartmentChangeSummary(BaseModel):
    """Summary of department assignment changes for an employee."""

    employee_id: int
    employee_name: str
    total_changes: int
    first_change: Optional[datetime] = None
    last_change: Optional[datetime] = None
    current_department_id: Optional[int] = None
    current_department_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
