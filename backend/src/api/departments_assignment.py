"""
Department Employee Assignment API Endpoints

Handles bulk assignment and employee transfers between departments.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_manager, get_database_session
from ..schemas_department_assignment import (
    AssignmentResponse,
    BulkAssignRequest,
    TransferRequest,
    TransferResponse,
)
from ..services.crud import crud_department
from ..services.crud_department_assignment import bulk_assign_employees, transfer_employee

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/departments", tags=["departments", "assignments"])


@router.post(
    "/{department_id}/employees/bulk-assign", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED
)
async def bulk_assign_employees_endpoint(
    department_id: int,
    request: BulkAssignRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Bulk assign multiple employees to a department.

    - **employee_ids**: List of employee IDs to assign (required, min 1)
    - **reason**: Optional reason for bulk assignment
    - **effective_date**: Optional effective date (currently informational only)

    Creates DepartmentAssignmentHistory records for each assignment.
    All assignments are processed in a transaction - if any fail, all are rolled back.

    Requires manager or admin role.

    Returns:
    - success: Whether all assignments succeeded
    - assigned_count: Number of successful assignments
    - assignments: Details of each assignment
    - errors: List of errors for any failed assignments
    """
    logger.info(
        f"User {current_user.get('email')} bulk assigning "
        f"{len(request.employee_ids)} employees to department {department_id}"
    )

    # Verify department exists
    department = await crud_department.get(db, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    # Perform bulk assignment
    result = await bulk_assign_employees(
        db=db,
        department_id=department_id,
        employee_ids=request.employee_ids,
        changed_by_user_id=current_user.get("id"),
        reason=request.reason,
        crud_department=crud_department,
    )

    # Log partial success
    if not result["success"] and result["assigned_count"] > 0:
        logger.warning(f"Partial success: {result['assigned_count']} assigned, {len(result['errors'])} errors")

    return result


@router.post(
    "/{department_id}/employees/{employee_id}/transfer",
    response_model=TransferResponse,
    status_code=status.HTTP_201_CREATED,
)
async def transfer_employee_endpoint(
    department_id: int,
    employee_id: int,
    request: TransferRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """
    Transfer employee from current department to another department.

    - **to_department_id**: Target department ID (required)
    - **reason**: Optional reason for transfer
    - **requires_approval**: Whether transfer requires approval (default: false)

    Creates DepartmentAssignmentHistory record for audit trail.
    Transaction is rolled back if any error occurs.

    Requires manager or admin role.

    Returns:
    - success: Whether transfer succeeded
    - employee_id: Employee ID
    - employee_name: Employee full name
    - from_department_id/name: Source department
    - to_department_id/name: Target department
    - transferred_at: Transfer timestamp
    - requires_approval: Approval requirement flag
    - history_id: Assignment history record ID
    """
    logger.info(
        f"User {current_user.get('email')} transferring employee {employee_id} "
        f"from department {department_id} to {request.to_department_id}"
    )

    # Verify source department exists
    from_department = await crud_department.get(db, department_id)
    if not from_department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source department not found")

    # Perform transfer
    result = await transfer_employee(
        db=db,
        from_department_id=department_id,
        to_department_id=request.to_department_id,
        employee_id=employee_id,
        changed_by_user_id=current_user.get("id"),
        reason=request.reason,
        requires_approval=request.requires_approval,
        crud_department=crud_department,
    )

    if not result.get("success"):
        error_msg = result.get("error", "Transfer failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    return result
