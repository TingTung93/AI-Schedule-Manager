"""
Rules API routes for managing scheduling constraints and requirements.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_current_user, get_database_session
from ..schemas import RuleCreate, RuleResponse, RuleUpdate
from ..services.crud import crud_rule, crud_employee

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("/", response_model=List[RuleResponse])
async def get_rules(
    employee_id: Optional[int] = None,
    rule_type: Optional[str] = None,
    active: Optional[bool] = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """
    Get all scheduling rules with filtering.

    Rule types:
    - availability: Employee availability patterns
    - preference: Employee scheduling preferences
    - requirement: Required qualifications or certifications
    - restriction: Scheduling restrictions (max hours, rest periods, etc.)

    Parameters:
    - **employee_id**: Filter by specific employee (None = global rules)
    - **rule_type**: Filter by rule type
    - **active**: Filter by active status
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    """
    try:
        result = await crud_rule.get_multi_with_filters(
            db=db,
            employee_id=employee_id,
            rule_type=rule_type,
            active=active,
            skip=skip,
            limit=limit,
        )

        return result["items"]

    except Exception as e:
        logger.error(f"Error fetching rules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch rules: {str(e)}",
        )


@router.post("/", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule: RuleCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """
    Create a new scheduling rule.

    Examples of rules:
    - Max 40 hours per week
    - No more than 5 consecutive days
    - 12 hour rest between shifts
    - Employee prefers morning shifts
    - Required certification for specific shifts
    - Unavailable on specific dates

    The constraints field should contain rule-specific parameters as JSON.
    """
    try:
        # Validate employee exists if employee-specific rule
        if rule.employee_id:
            employee = await crud_employee.get(db, rule.employee_id)
            if not employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee {rule.employee_id} not found",
                )

        # Create rule
        new_rule = await crud_rule.create(db, rule)
        logger.info(f"Created rule {new_rule.id} for employee {rule.employee_id}")

        return new_rule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rule: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create rule: {str(e)}",
        )


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """Get specific rule by ID with employee details."""
    try:
        rule = await crud_rule.get(db, rule_id)
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rule {rule_id} not found",
            )

        return rule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rule {rule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch rule: {str(e)}",
        )


@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    rule: RuleUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """Update existing rule."""
    try:
        existing = await crud_rule.get(db, rule_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rule {rule_id} not found",
            )

        # Validate employee if being changed
        if rule.employee_id and rule.employee_id != existing.employee_id:
            employee = await crud_employee.get(db, rule.employee_id)
            if not employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee {rule.employee_id} not found",
                )

        updated = await crud_rule.update(db, existing, rule)
        logger.info(f"Updated rule {rule_id}")

        return updated

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rule {rule_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update rule: {str(e)}",
        )


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """Delete rule."""
    try:
        existing = await crud_rule.get(db, rule_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rule {rule_id} not found",
            )

        await crud_rule.remove(db, rule_id)
        logger.info(f"Deleted rule {rule_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rule {rule_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete rule: {str(e)}",
        )


@router.post("/bulk", response_model=List[RuleResponse], status_code=status.HTTP_201_CREATED)
async def create_rules_bulk(
    rules: List[RuleCreate],
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """
    Create multiple rules at once.

    Useful for the wizard's Requirements step to create all constraints in one request.
    If any rule fails validation, the entire operation is rolled back.
    """
    try:
        created_rules = []

        # Validate all employees first
        employee_ids = set(r.employee_id for r in rules if r.employee_id)
        for emp_id in employee_ids:
            employee = await crud_employee.get(db, emp_id)
            if not employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee {emp_id} not found",
                )

        # Create all rules
        for rule_data in rules:
            new_rule = await crud_rule.create(db, rule_data)
            created_rules.append(new_rule)

        logger.info(f"Created {len(created_rules)} rules in bulk")
        return created_rules

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rules in bulk: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create rules: {str(e)}",
        )


@router.get("/employee/{employee_id}", response_model=List[RuleResponse])
async def get_employee_rules(
    employee_id: int,
    active: Optional[bool] = True,
    db: AsyncSession = Depends(get_database_session),
    current_user=Depends(get_current_user),
):
    """
    Get all rules for a specific employee.

    Includes both employee-specific rules and global rules (employee_id = NULL).
    """
    try:
        # Validate employee exists
        employee = await crud_employee.get(db, employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee {employee_id} not found",
            )

        # Get employee-specific rules
        result = await crud_rule.get_multi_with_filters(
            db=db,
            employee_id=employee_id,
            active=active,
            limit=1000,
        )

        return result["items"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rules for employee {employee_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch employee rules: {str(e)}",
        )
