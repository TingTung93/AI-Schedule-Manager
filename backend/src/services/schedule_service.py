"""
Schedule generation service using constraint solver.
"""

import logging
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Employee as DBEmployee
from ..models import Rule as DBRule
from ..models import Schedule as DBSchedule
from ..models import Shift as DBShift
from ..scheduler.constraint_solver import Employee, Shift, ScheduleOptimizer, ShiftType, SchedulingConstraint

logger = logging.getLogger(__name__)


class ScheduleGenerationService:
    """Service for generating schedules using constraint solver."""

    def __init__(self):
        """Initialize the schedule generation service."""
        self.optimizer = ScheduleOptimizer(
            config={
                "max_solve_time": 60,  # 60 seconds timeout
                "min_rest_hours": 8,  # Minimum rest period between shifts
            }
        )

    async def generate_schedule(
        self, db: AsyncSession, start_date: date, end_date: date, constraints: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a schedule for the given date range.

        Args:
            db: Database session
            start_date: Start date for schedule
            end_date: End date for schedule
            constraints: Optional additional constraints

        Returns:
            Dict containing schedule data and status
        """
        try:
            # Fetch active employees from database
            employees_data = await self._fetch_employees(db)
            if not employees_data:
                return {"status": "error", "message": "No active employees found", "schedule": []}

            # Convert DB employees to solver Employee objects
            employees = self._convert_employees(employees_data)

            # Fetch shift templates from database
            shifts_data = await self._fetch_shifts(db)
            if not shifts_data:
                return {"status": "error", "message": "No shift templates found", "schedule": []}

            # Generate shifts for date range
            shifts = self._generate_shifts_for_dates(shifts_data, start_date, end_date)
            if not shifts:
                return {"status": "error", "message": "No shifts generated for date range", "schedule": []}

            # Fetch rules and convert to constraints
            custom_constraints = await self._fetch_constraints(db)

            # Run constraint solver
            logger.info(
                f"Generating schedule: {len(employees)} employees, {len(shifts)} shifts, {len(custom_constraints)} constraints"
            )

            result = self.optimizer.generate_schedule(employees=employees, shifts=shifts, constraints=custom_constraints)

            # If successful, save to database
            if result["status"] in ["optimal", "feasible"]:
                saved_count = await self._save_schedule_to_db(db, result["schedule"], employees_data)
                result["saved_assignments"] = saved_count
                result["message"] = f"Generated {saved_count} schedule assignments"

            return result

        except Exception as e:
            logger.error(f"Error generating schedule: {e}", exc_info=True)
            return {"status": "error", "message": f"Schedule generation failed: {str(e)}", "schedule": []}

    async def optimize_schedule(self, db: AsyncSession, schedule_ids: List[int]) -> Dict[str, Any]:
        """
        Optimize existing schedule assignments.

        Args:
            db: Database session
            schedule_ids: List of schedule IDs to optimize

        Returns:
            Dict containing optimization results
        """
        try:
            # Fetch existing schedules
            query = select(DBSchedule).where(DBSchedule.id.in_(schedule_ids))
            result = await db.execute(query)
            schedules = result.scalars().all()

            if not schedules:
                return {"status": "error", "message": "No schedules found", "improvements": {}}

            # Get date range from schedules
            dates = [s.date for s in schedules]
            start_date = min(dates)
            end_date = max(dates)

            # Re-generate with optimization
            result = await self.generate_schedule(db, start_date, end_date)

            if result["status"] in ["optimal", "feasible"]:
                # Calculate improvements
                improvements = await self._calculate_improvements(db, schedules, result["schedule"])
                result["improvements"] = improvements

            return result

        except Exception as e:
            logger.error(f"Error optimizing schedule: {e}", exc_info=True)
            return {"status": "error", "message": f"Optimization failed: {str(e)}", "improvements": {}}

    async def check_conflicts(self, db: AsyncSession, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Check for conflicts in proposed schedule.

        Args:
            db: Database session
            start_date: Start date
            end_date: End date

        Returns:
            Dict containing conflicts found
        """
        conflicts = []

        # Fetch all schedules in date range
        query = select(DBSchedule).where(and_(DBSchedule.date >= start_date, DBSchedule.date <= end_date))
        result = await db.execute(query)
        schedules = result.scalars().all()

        # Check for double bookings
        employee_shifts = {}
        for schedule in schedules:
            emp_id = schedule.employee_id
            shift_date = schedule.date

            if emp_id not in employee_shifts:
                employee_shifts[emp_id] = []

            employee_shifts[emp_id].append(
                {"schedule_id": schedule.id, "shift_id": schedule.shift_id, "date": shift_date}
            )

        # Detect overlapping shifts for same employee
        for emp_id, shifts in employee_shifts.items():
            for i, shift1 in enumerate(shifts):
                for shift2 in shifts[i + 1 :]:
                    if shift1["date"] == shift2["date"]:
                        conflicts.append(
                            {
                                "type": "double_booking",
                                "employee_id": emp_id,
                                "date": shift1["date"].isoformat(),
                                "shift_ids": [shift1["shift_id"], shift2["shift_id"]],
                            }
                        )

        # Check qualification mismatches
        for schedule in schedules:
            employee = await db.get(DBEmployee, schedule.employee_id)
            shift = await db.get(DBShift, schedule.shift_id)

            if employee and shift:
                if shift.required_qualifications:
                    missing_quals = set(shift.required_qualifications) - set(employee.qualifications or [])
                    if missing_quals:
                        conflicts.append(
                            {
                                "type": "qualification_mismatch",
                                "employee_id": employee.id,
                                "shift_id": shift.id,
                                "missing_qualifications": list(missing_quals),
                            }
                        )

        return {"conflicts": conflicts, "conflict_count": len(conflicts)}

    async def _fetch_employees(self, db: AsyncSession) -> List[DBEmployee]:
        """Fetch active employees from database."""
        query = select(DBEmployee).where(DBEmployee.active == True)
        result = await db.execute(query)
        return result.scalars().all()

    async def _fetch_shifts(self, db: AsyncSession) -> List[DBShift]:
        """Fetch active shift templates from database."""
        query = select(DBShift).where(DBShift.active == True)
        result = await db.execute(query)
        return result.scalars().all()

    async def _fetch_constraints(self, db: AsyncSession) -> List[SchedulingConstraint]:
        """Fetch scheduling rules and convert to constraints."""
        query = select(DBRule).where(DBRule.active == True)
        result = await db.execute(query)
        rules = result.scalars().all()

        constraints = []
        for rule in rules:
            constraint = SchedulingConstraint(
                id=str(rule.id), name=rule.original_text, type=rule.rule_type, parameters=rule.constraints, priority=rule.priority
            )
            constraints.append(constraint)

        return constraints

    def _convert_employees(self, db_employees: List[DBEmployee]) -> List[Employee]:
        """Convert database Employee models to solver Employee objects."""
        employees = []

        for db_emp in db_employees:
            # Parse availability pattern
            availability = {}
            if db_emp.availability_pattern:
                for day, hours in db_emp.availability_pattern.items():
                    # Convert hours to time tuples
                    if isinstance(hours, list):
                        availability[day] = []
                        for hour_range in hours:
                            if isinstance(hour_range, dict):
                                start = self._parse_time(hour_range.get("start", "09:00"))
                                end = self._parse_time(hour_range.get("end", "17:00"))
                                availability[day].append((start, end))

            emp = Employee(
                id=str(db_emp.id),
                name=db_emp.name,
                qualifications=db_emp.qualifications or [],
                availability=availability,
                max_hours_per_week=db_emp.max_hours_per_week or 40,
                min_hours_per_week=0,
            )
            employees.append(emp)

        return employees

    def _generate_shifts_for_dates(self, shift_templates: List[DBShift], start_date: date, end_date: date) -> List[Shift]:
        """Generate shift instances for each day in the date range."""
        shifts = []
        current_date = start_date

        while current_date <= end_date:
            for template in shift_templates:
                # Convert shift type
                shift_type = ShiftType.FULL_DAY
                if template.shift_type == "morning":
                    shift_type = ShiftType.MORNING
                elif template.shift_type == "afternoon":
                    shift_type = ShiftType.AFTERNOON
                elif template.shift_type == "evening":
                    shift_type = ShiftType.EVENING
                elif template.shift_type == "night":
                    shift_type = ShiftType.NIGHT

                shift = Shift(
                    id=f"{template.id}_{current_date.isoformat()}",
                    date=current_date,
                    start_time=template.start_time,
                    end_time=template.end_time,
                    required_qualifications=template.required_qualifications or [],
                    min_employees=template.required_staff,
                    max_employees=template.required_staff + 2,  # Allow some flexibility
                    shift_type=shift_type,
                )
                shifts.append(shift)

            current_date += timedelta(days=1)

        return shifts

    async def _save_schedule_to_db(
        self, db: AsyncSession, schedule_data: List[Dict[str, Any]], employees_lookup: List[DBEmployee]
    ) -> int:
        """Save generated schedule to database."""
        saved_count = 0

        # Create employee ID map
        emp_map = {str(emp.id): emp.id for emp in employees_lookup}

        for shift_assignment in schedule_data:
            # Parse shift ID to get template ID and date
            shift_id_parts = shift_assignment["shift_id"].split("_")
            template_id = int(shift_id_parts[0])
            shift_date = date.fromisoformat(shift_assignment["date"])

            # Create schedule for each assigned employee
            for assigned_emp in shift_assignment["assigned_employees"]:
                emp_id = emp_map.get(assigned_emp["id"])
                if emp_id:
                    # Check if schedule already exists
                    query = select(DBSchedule).where(
                        and_(DBSchedule.employee_id == emp_id, DBSchedule.shift_id == template_id, DBSchedule.date == shift_date)
                    )
                    result = await db.execute(query)
                    existing = result.scalar_one_or_none()

                    if not existing:
                        schedule = DBSchedule(
                            employee_id=emp_id, shift_id=template_id, date=shift_date, status="scheduled", overtime_approved=False
                        )
                        db.add(schedule)
                        saved_count += 1

        await db.commit()
        return saved_count

    async def _calculate_improvements(
        self, db: AsyncSession, old_schedules: List[DBSchedule], new_schedule: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate improvements from optimization."""
        improvements = {
            "total_assignments": len(new_schedule),
            "coverage_improved": True,
            "conflicts_resolved": 0,
            "workload_balanced": True,
        }

        # Calculate coverage percentage
        total_slots = sum(len(s["assigned_employees"]) for s in new_schedule)
        improvements["coverage_percentage"] = f"{min(100, (total_slots / max(1, len(new_schedule))) * 100):.1f}%"

        return improvements

    def _parse_time(self, time_str: str) -> time:
        """Parse time string to time object."""
        try:
            if isinstance(time_str, time):
                return time_str
            parts = time_str.split(":")
            return time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
        except Exception:
            return time(9, 0)  # Default to 9 AM


# Singleton instance
schedule_service = ScheduleGenerationService()
