"""
CRUD operations for department employee assignment.

Handles bulk assignment and transfer operations with transaction support.
"""

import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.cache import invalidate_department_cache, invalidate_employee_cache

logger = logging.getLogger(__name__)


async def bulk_assign_employees(
    db: AsyncSession,
    department_id: int,
    employee_ids: List[int],
    changed_by_user_id: int,
    reason: str = None,
    crud_department=None,
) -> dict:
    """
    Bulk assign employees to a department with transaction support.

    Creates DepartmentAssignmentHistory records for audit trail.
    Rolls back all changes if any assignment fails.

    Args:
        db: Database session
        department_id: Target department ID
        employee_ids: List of employee IDs to assign
        changed_by_user_id: User ID performing the assignment
        reason: Optional reason for assignment
        crud_department: Department CRUD instance for get operations

    Returns:
        dict with success status, assigned_count, assignments list, and errors list
    """
    from ..auth.models import User
    from ..models.department_history import DepartmentAssignmentHistory

    assignments = []
    errors = []

    try:
        # Verify department exists
        if crud_department:
            department = await crud_department.get(db, department_id)
            if not department:
                return {
                    "success": False,
                    "assigned_count": 0,
                    "assignments": [],
                    "errors": [f"Department {department_id} not found"],
                }
        else:
            from ..models import Department

            dept_result = await db.execute(select(Department).where(Department.id == department_id))
            department = dept_result.scalar_one_or_none()
            if not department:
                return {
                    "success": False,
                    "assigned_count": 0,
                    "assignments": [],
                    "errors": [f"Department {department_id} not found"],
                }

        # Process each employee
        for employee_id in employee_ids:
            try:
                # Get employee (User model)
                user_result = await db.execute(select(User).where(User.id == employee_id))
                user = user_result.scalar_one_or_none()

                if not user:
                    errors.append(f"Employee {employee_id} not found")
                    continue

                # Store previous department
                previous_dept_id = user.department_id
                previous_dept_name = None
                if previous_dept_id and crud_department:
                    prev_dept = await crud_department.get(db, previous_dept_id)
                    previous_dept_name = prev_dept.name if prev_dept else None

                # Update employee department
                user.department_id = department_id

                # Create assignment history record
                history = DepartmentAssignmentHistory(
                    employee_id=employee_id,
                    from_department_id=previous_dept_id,
                    to_department_id=department_id,
                    changed_by_user_id=changed_by_user_id,
                    change_reason=reason,
                    change_metadata={"bulk_assignment": True, "employee_count": len(employee_ids)},
                )
                db.add(history)
                await db.flush()

                # Track assignment
                assignments.append(
                    {
                        "employee_id": employee_id,
                        "employee_name": f"{user.first_name} {user.last_name}",
                        "previous_department_id": previous_dept_id,
                        "previous_department_name": previous_dept_name,
                        "new_department_id": department_id,
                        "new_department_name": department.name,
                        "assigned_at": history.changed_at,
                        "history_id": history.id,
                    }
                )

            except Exception as e:
                logger.error(f"Error assigning employee {employee_id}: {str(e)}")
                errors.append(f"Employee {employee_id}: {str(e)}")

        # Commit if all successful or partial success
        await db.commit()

        # Invalidate department cache
        invalidate_department_cache(department_id=department_id)

        return {
            "success": len(errors) == 0,
            "assigned_count": len(assignments),
            "assignments": assignments,
            "errors": errors,
        }

    except Exception as e:
        # Rollback on any error
        await db.rollback()
        logger.error(f"Error in bulk_assign_employees: {str(e)}")
        raise


async def transfer_employee(
    db: AsyncSession,
    from_department_id: int,
    to_department_id: int,
    employee_id: int,
    changed_by_user_id: int,
    reason: str = None,
    requires_approval: bool = False,
    crud_department=None,
) -> dict:
    """
    Transfer employee from one department to another with transaction support.

    Creates DepartmentAssignmentHistory record for audit trail.
    Rolls back on error.

    Args:
        db: Database session
        from_department_id: Source department ID
        to_department_id: Target department ID
        employee_id: Employee ID to transfer
        changed_by_user_id: User ID performing the transfer
        reason: Optional reason for transfer
        requires_approval: Whether transfer requires approval
        crud_department: Department CRUD instance for get operations

    Returns:
        dict with success status and transfer details
    """
    from ..auth.models import User
    from ..models.department_history import DepartmentAssignmentHistory

    try:
        # Get employee (User model)
        user_result = await db.execute(select(User).where(User.id == employee_id))
        user = user_result.scalar_one_or_none()

        if not user:
            return {
                "success": False,
                "error": f"Employee {employee_id} not found",
            }

        # Verify current department matches
        if user.department_id != from_department_id:
            return {
                "success": False,
                "error": f"Employee {employee_id} is not in department {from_department_id}",
            }

        # Get department names
        from_dept = None
        to_dept = None

        if crud_department:
            from_dept = await crud_department.get(db, from_department_id) if from_department_id else None
            to_dept = await crud_department.get(db, to_department_id)
        else:
            from ..models import Department

            if from_department_id:
                from_dept_result = await db.execute(select(Department).where(Department.id == from_department_id))
                from_dept = from_dept_result.scalar_one_or_none()

            to_dept_result = await db.execute(select(Department).where(Department.id == to_department_id))
            to_dept = to_dept_result.scalar_one_or_none()

        if not to_dept:
            return {
                "success": False,
                "error": f"Target department {to_department_id} not found",
            }

        # Update employee department
        user.department_id = to_department_id

        # Create transfer history record
        history = DepartmentAssignmentHistory(
            employee_id=employee_id,
            from_department_id=from_department_id,
            to_department_id=to_department_id,
            changed_by_user_id=changed_by_user_id,
            change_reason=reason,
            change_metadata={"transfer": True, "requires_approval": requires_approval},
        )
        db.add(history)
        await db.flush()

        # Commit transaction
        await db.commit()

        # Invalidate caches for both departments
        invalidate_department_cache(department_id=from_department_id)
        invalidate_department_cache(department_id=to_department_id)
        invalidate_employee_cache(employee_id=employee_id, email=user.email)

        return {
            "success": True,
            "employee_id": employee_id,
            "employee_name": f"{user.first_name} {user.last_name}",
            "from_department_id": from_department_id,
            "from_department_name": from_dept.name if from_dept else None,
            "to_department_id": to_department_id,
            "to_department_name": to_dept.name,
            "transferred_at": history.changed_at,
            "requires_approval": requires_approval,
            "history_id": history.id,
        }

    except Exception as e:
        # Rollback on error
        await db.rollback()
        logger.error(f"Error in transfer_employee: {str(e)}")
        raise
