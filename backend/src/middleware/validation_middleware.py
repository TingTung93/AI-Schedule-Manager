"""
Validation middleware for FastAPI endpoints with business logic validation.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError

from ..schemas_enhanced import EmployeeCreate, EmployeeUpdate, ScheduleCreate, ScheduleUpdate
from ..services.crud import get_employee, get_employee_schedules, get_shift
from ..validators import BusinessLogicValidator, ValidationError

logger = logging.getLogger(__name__)


class ValidationMiddleware:
    """Middleware for comprehensive validation."""

    @staticmethod
    async def validate_employee_data(
        employee_data: Dict[str, Any], employee_id: Optional[int] = None, db_session=None
    ) -> Dict[str, Any]:
        """Validate employee data with business rules."""
        try:
            # Basic Pydantic validation
            if employee_id:
                # Update validation
                validated_data = EmployeeUpdate(**employee_data)
            else:
                # Create validation
                validated_data = EmployeeCreate(**employee_data)

            # Additional business validations
            if db_session:
                # Check email uniqueness
                await ValidationMiddleware._validate_email_uniqueness(
                    email=validated_data.email, exclude_employee_id=employee_id, db_session=db_session
                )

            return validated_data.dict(exclude_unset=True)

        except PydanticValidationError as e:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Validation failed",
                    "errors": [
                        {"field": ".".join(str(loc) for loc in error["loc"]), "message": error["msg"], "type": error["type"]}
                        for error in e.errors()
                    ],
                },
            )
        except ValidationError as e:
            raise HTTPException(
                status_code=422, detail={"message": "Business validation failed", "field": e.field, "error": e.message}
            )

    @staticmethod
    async def validate_schedule_data(
        schedule_data: Dict[str, Any], schedule_id: Optional[int] = None, db_session=None
    ) -> Dict[str, Any]:
        """Validate schedule data with comprehensive business rules."""
        try:
            # Basic Pydantic validation
            if schedule_id:
                validated_data = ScheduleUpdate(**schedule_data)
            else:
                validated_data = ScheduleCreate(**schedule_data)

            # Business logic validation for create operations
            if not schedule_id and db_session:
                await ValidationMiddleware._validate_schedule_business_rules(validated_data, db_session)

            return validated_data.dict(exclude_unset=True)

        except PydanticValidationError as e:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Validation failed",
                    "errors": [
                        {"field": ".".join(str(loc) for loc in error["loc"]), "message": error["msg"], "type": error["type"]}
                        for error in e.errors()
                    ],
                },
            )
        except ValidationError as e:
            raise HTTPException(
                status_code=422, detail={"message": "Business validation failed", "field": e.field, "error": e.message}
            )

    @staticmethod
    async def _validate_email_uniqueness(email: str, exclude_employee_id: Optional[int], db_session):
        """Check if email is unique."""
        if not email:
            return

        # Query existing employees with this email
        existing_employee = await get_employee_by_email(db_session, email)

        if existing_employee:
            # If updating, exclude current employee
            if exclude_employee_id and existing_employee.id == exclude_employee_id:
                return

            raise ValidationError("Email address is already in use", field="email")

    @staticmethod
    async def _validate_schedule_business_rules(schedule_data: ScheduleCreate, db_session):
        """Validate all business rules for schedule creation."""

        # Get employee and shift data
        employee = await get_employee(db_session, schedule_data.employee_id)
        if not employee:
            raise ValidationError("Employee not found", field="employee_id")

        shift = await get_shift(db_session, schedule_data.shift_id)
        if not shift:
            raise ValidationError("Shift not found", field="shift_id")

        # Get existing schedules for conflict checking
        existing_schedules = await get_employee_schedules(
            db_session, employee_id=schedule_data.employee_id, start_date=schedule_data.date, end_date=schedule_data.date
        )

        # Convert to dict format for validation
        employee_data = {"qualifications": employee.qualifications or [], "availability": employee.availability or {}}

        shift_data = {
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "required_qualifications": shift.required_qualifications or [],
        }

        existing_schedules_data = [
            {
                "id": s.id,
                "employee_id": s.employee_id,
                "date": s.date,
                "start_time": s.shift.start_time,
                "end_time": s.shift.end_time,
                "status": s.status,
            }
            for s in existing_schedules
        ]

        # Run business rule validation
        schedule_data.validate_business_rules(
            employee_data=employee_data, shift_data=shift_data, existing_schedules=existing_schedules_data
        )

    @staticmethod
    def handle_validation_exception(request: Request, exc: Exception):
        """Global validation exception handler."""
        if isinstance(exc, ValidationError):
            return JSONResponse(
                status_code=422,
                content={
                    "message": "Business validation failed",
                    "field": exc.field,
                    "error": exc.message,
                    "type": "business_validation_error",
                },
            )
        elif isinstance(exc, PydanticValidationError):
            return JSONResponse(
                status_code=422,
                content={
                    "message": "Validation failed",
                    "errors": [
                        {"field": ".".join(str(loc) for loc in error["loc"]), "message": error["msg"], "type": error["type"]}
                        for error in exc.errors()
                    ],
                    "type": "pydantic_validation_error",
                },
            )
        else:
            # Re-raise if not a validation error
            raise exc


# Dependency functions for FastAPI
async def validate_employee_create(employee_data: EmployeeCreate, db=Depends(get_db)):
    """Dependency for employee creation validation."""
    return await ValidationMiddleware.validate_employee_data(employee_data.dict(), employee_id=None, db_session=db)


async def validate_employee_update(employee_id: int, employee_data: EmployeeUpdate, db=Depends(get_db)):
    """Dependency for employee update validation."""
    return await ValidationMiddleware.validate_employee_data(
        employee_data.dict(exclude_unset=True), employee_id=employee_id, db_session=db
    )


async def validate_schedule_create(schedule_data: ScheduleCreate, db=Depends(get_db)):
    """Dependency for schedule creation validation."""
    return await ValidationMiddleware.validate_schedule_data(schedule_data.dict(), schedule_id=None, db_session=db)


async def validate_schedule_update(schedule_id: int, schedule_data: ScheduleUpdate, db=Depends(get_db)):
    """Dependency for schedule update validation."""
    return await ValidationMiddleware.validate_schedule_data(
        schedule_data.dict(exclude_unset=True), schedule_id=schedule_id, db_session=db
    )


# Utility functions for direct validation
async def check_schedule_conflicts(
    employee_id: int, shift_id: int, date: str, db_session, exclude_schedule_id: Optional[int] = None
) -> Dict[str, Any]:
    """Check for schedule conflicts."""
    try:
        # Get shift data
        shift = await get_shift(db_session, shift_id)
        if not shift:
            return {"has_conflicts": False, "conflicts": [], "error": "Shift not found"}

        # Get existing schedules
        existing_schedules = await get_employee_schedules(db_session, employee_id=employee_id, start_date=date, end_date=date)

        existing_schedules_data = [
            {
                "id": s.id,
                "employee_id": s.employee_id,
                "date": s.date,
                "start_time": s.shift.start_time,
                "end_time": s.shift.end_time,
                "status": s.status,
            }
            for s in existing_schedules
        ]

        # Check conflicts
        BusinessLogicValidator.validate_schedule_conflicts(
            employee_id=employee_id,
            shift_date=date,
            shift_start=shift.start_time,
            shift_end=shift.end_time,
            existing_schedules=existing_schedules_data,
            exclude_schedule_id=exclude_schedule_id,
        )

        return {"has_conflicts": False, "conflicts": []}

    except ValidationError as e:
        return {"has_conflicts": True, "conflicts": [e.message], "field": e.field}
    except Exception as e:
        logger.error(f"Error checking schedule conflicts: {e}")
        return {"has_conflicts": False, "conflicts": [], "error": "Internal error during conflict check"}


async def validate_employee_qualifications_for_shift(employee_id: int, shift_id: int, db_session) -> Dict[str, Any]:
    """Validate employee qualifications for a shift."""
    try:
        # Get employee and shift data
        employee = await get_employee(db_session, employee_id)
        shift = await get_shift(db_session, shift_id)

        if not employee:
            return {"is_qualified": False, "missing_qualifications": [], "error": "Employee not found"}

        if not shift:
            return {"is_qualified": False, "missing_qualifications": [], "error": "Shift not found"}

        # Validate qualifications
        BusinessLogicValidator.validate_employee_qualifications(
            employee_qualifications=employee.qualifications or [], required_qualifications=shift.required_qualifications or []
        )

        return {"is_qualified": True, "missing_qualifications": []}

    except ValidationError as e:
        # Extract missing qualifications from error message
        missing_quals = []
        if "missing required qualifications:" in e.message:
            quals_text = e.message.split("missing required qualifications:")[-1].strip()
            missing_quals = [q.strip() for q in quals_text.split(",")]

        return {"is_qualified": False, "missing_qualifications": missing_quals}
    except Exception as e:
        logger.error(f"Error validating qualifications: {e}")
        return {"is_qualified": False, "missing_qualifications": [], "error": "Internal error during qualification check"}


# Note: Import dependencies would need to be updated based on actual CRUD service structure
# Placeholder imports for reference:
# from ..database import get_db
# from ..services.crud import get_employee, get_shift, get_employee_schedules, get_employee_by_email
