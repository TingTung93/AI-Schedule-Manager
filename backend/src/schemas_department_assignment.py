"""
Department Assignment Schemas

Pydantic schemas for department employee assignment operations.
"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BulkAssignRequest(BaseModel):
    """Request schema for bulk assigning employees to a department."""

    employee_ids: List[int] = Field(..., min_length=1, description="List of employee IDs to assign")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for bulk assignment")
    effective_date: Optional[date] = Field(None, description="Effective date of assignment")

    model_config = ConfigDict(from_attributes=True)


class TransferRequest(BaseModel):
    """Request schema for transferring an employee to another department."""

    to_department_id: int = Field(..., gt=0, description="Target department ID")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for transfer")
    requires_approval: bool = Field(default=False, description="Whether transfer requires approval")

    model_config = ConfigDict(from_attributes=True)


class AssignmentDetail(BaseModel):
    """Individual assignment detail in bulk assignment response."""

    employee_id: int = Field(..., description="Employee ID")
    employee_name: Optional[str] = Field(None, description="Employee full name")
    previous_department_id: Optional[int] = Field(None, description="Previous department ID")
    previous_department_name: Optional[str] = Field(None, description="Previous department name")
    new_department_id: int = Field(..., description="New department ID")
    new_department_name: Optional[str] = Field(None, description="New department name")
    assigned_at: datetime = Field(..., description="Assignment timestamp")
    history_id: int = Field(..., description="Assignment history record ID")

    model_config = ConfigDict(from_attributes=True)


class AssignmentResponse(BaseModel):
    """Response schema for assignment operations."""

    success: bool = Field(..., description="Whether operation succeeded")
    assigned_count: int = Field(..., description="Number of employees assigned")
    assignments: List[AssignmentDetail] = Field(..., description="List of assignment details")
    errors: Optional[List[str]] = Field(default_factory=list, description="List of errors if any occurred")

    model_config = ConfigDict(from_attributes=True)


class TransferResponse(BaseModel):
    """Response schema for employee transfer."""

    success: bool = Field(..., description="Whether transfer succeeded")
    employee_id: int = Field(..., description="Employee ID")
    employee_name: Optional[str] = Field(None, description="Employee full name")
    from_department_id: Optional[int] = Field(None, description="Source department ID")
    from_department_name: Optional[str] = Field(None, description="Source department name")
    to_department_id: int = Field(..., description="Target department ID")
    to_department_name: Optional[str] = Field(None, description="Target department name")
    transferred_at: datetime = Field(..., description="Transfer timestamp")
    requires_approval: bool = Field(..., description="Whether approval is required")
    history_id: int = Field(..., description="Assignment history record ID")

    model_config = ConfigDict(from_attributes=True)
