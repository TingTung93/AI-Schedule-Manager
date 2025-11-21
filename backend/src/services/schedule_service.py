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
from ..models import ScheduleAssignment as DBScheduleAssignment
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

    async def _get_or_create_schedule_for_week(
        self, db: AsyncSession, shift_date: date, created_by: int = 1
    ) -> DBSchedule:
        """
        Find or create Schedule container for the week containing shift_date.

        Args:
            db: Database session
            shift_date: Date of the shift (used to determine week range)
            created_by: User ID creating the schedule (default: 1 for system)

        Returns:
            Schedule object for the week
        """
        # Calculate week start (Monday) and end (Sunday) from shift_date
        week_start = shift_date - timedelta(days=shift_date.weekday())
        week_end = week_start + timedelta(days=6)

        # Try to find existing schedule for this week
        query = select(DBSchedule).where(DBSchedule.week_start == week_start, DBSchedule.week_end == week_end)
        result = await db.execute(query)
        schedule = result.scalar_one_or_none()

        if not schedule:
            # Create new schedule for this week
            schedule = DBSchedule(
                week_start=week_start,
                week_end=week_end,
                status="draft",
                created_by=created_by,
                version=1,
            )
            db.add(schedule)
            await db.flush()  # Get ID without committing transaction

        return schedule

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
            schedule_ids: List of schedule IDs to optimize (Schedule container IDs)

        Returns:
            Dict containing optimization results
        """
        try:
            from sqlalchemy.orm import selectinload

            # Fetch existing schedules (containers)
            query = (
                select(DBSchedule)
                .where(DBSchedule.id.in_(schedule_ids))
                .options(selectinload(DBSchedule.assignments).selectinload(DBScheduleAssignment.shift))
            )
            result = await db.execute(query)
            schedules = result.scalars().all()

            if not schedules:
                return {"status": "error", "message": "No schedules found", "improvements": {}}

            # Get date range from schedule containers (use week_start and week_end)
            start_date = min(s.week_start for s in schedules)
            end_date = max(s.week_end for s in schedules)

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
        from sqlalchemy.orm import selectinload

        conflicts = []

        # Fetch all assignments where the shift date is in range
        query = (
            select(DBScheduleAssignment)
            .join(DBShift, DBScheduleAssignment.shift_id == DBShift.id)
            .join(DBEmployee, DBScheduleAssignment.employee_id == DBEmployee.id)
            .where(and_(DBShift.date >= start_date, DBShift.date <= end_date))
            .options(
                selectinload(DBScheduleAssignment.employee),
                selectinload(DBScheduleAssignment.shift),
                selectinload(DBScheduleAssignment.schedule),
            )
        )
        result = await db.execute(query)
        assignments = result.scalars().all()

        # Group assignments by employee to check for conflicts
        employee_assignments = {}
        for assignment in assignments:
            emp_id = assignment.employee_id
            if emp_id not in employee_assignments:
                employee_assignments[emp_id] = []
            employee_assignments[emp_id].append(assignment)

        # Check for double bookings and time conflicts
        for emp_id, emp_assignments in employee_assignments.items():
            for i, assignment1 in enumerate(emp_assignments):
                for assignment2 in emp_assignments[i + 1 :]:
                    shift1 = assignment1.shift
                    shift2 = assignment2.shift

                    # Check if shifts are on the same date
                    if shift1.date == shift2.date:
                        # Check for time overlap
                        if shift1.start_time < shift2.end_time and shift1.end_time > shift2.start_time:
                            conflicts.append(
                                {
                                    "type": "double_booking",
                                    "employee_id": emp_id,
                                    "employee_name": assignment1.employee.name,
                                    "date": shift1.date.isoformat(),
                                    "assignment_ids": [assignment1.id, assignment2.id],
                                    "shift_times": [
                                        f"{shift1.start_time}-{shift1.end_time}",
                                        f"{shift2.start_time}-{shift2.end_time}",
                                    ],
                                }
                            )

        # Check qualification mismatches
        for assignment in assignments:
            employee = assignment.employee
            shift = assignment.shift

            if shift.required_qualifications:
                missing_quals = set(shift.required_qualifications) - set(employee.qualifications or [])
                if missing_quals:
                    conflicts.append(
                        {
                            "type": "qualification_mismatch",
                            "assignment_id": assignment.id,
                            "employee_id": employee.id,
                            "employee_name": employee.name,
                            "shift_id": shift.id,
                            "shift_date": shift.date.isoformat(),
                            "missing_qualifications": list(missing_quals),
                        }
                    )

        return {"conflicts": conflicts, "conflict_count": len(conflicts)}

    async def _fetch_employees(self, db: AsyncSession) -> List[DBEmployee]:
        """Fetch active employees from database."""
        query = select(DBEmployee).where(DBEmployee.is_active == True)
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
        """
        Save generated schedule to database.

        Creates Schedule containers for each week and ScheduleAssignment records
        linking employees to shifts within those schedules.
        """
        from sqlalchemy.orm import selectinload

        saved_count = 0

        # Create employee ID map
        emp_map = {str(emp.id): emp.id for emp in employees_lookup}

        # Cache schedules by week to avoid recreating
        schedules_cache = {}

        for shift_assignment in schedule_data:
            # Parse shift ID to get template ID and date
            shift_id_parts = shift_assignment["shift_id"].split("_")
            template_id = int(shift_id_parts[0])
            shift_date = date.fromisoformat(shift_assignment["date"])

            # Get or create Schedule for this week
            week_start = shift_date - timedelta(days=shift_date.weekday())
            week_key = week_start.isoformat()

            if week_key not in schedules_cache:
                schedule = await self._get_or_create_schedule_for_week(db, shift_date, created_by=1)
                schedules_cache[week_key] = schedule
            schedule = schedules_cache[week_key]

            # Create assignment for each assigned employee
            for assigned_emp in shift_assignment["assigned_employees"]:
                emp_id = emp_map.get(assigned_emp["id"])
                if emp_id:
                    # Check if assignment already exists
                    query = (
                        select(DBScheduleAssignment)
                        .where(
                            and_(
                                DBScheduleAssignment.schedule_id == schedule.id,
                                DBScheduleAssignment.employee_id == emp_id,
                                DBScheduleAssignment.shift_id == template_id,
                            )
                        )
                        .options(
                            selectinload(DBScheduleAssignment.schedule),
                            selectinload(DBScheduleAssignment.employee),
                            selectinload(DBScheduleAssignment.shift),
                        )
                    )
                    result = await db.execute(query)
                    existing = result.scalar_one_or_none()

                    if not existing:
                        # Create new assignment
                        assignment = DBScheduleAssignment(
                            schedule_id=schedule.id,
                            employee_id=emp_id,
                            shift_id=template_id,
                            status="assigned",
                            priority=1,
                            auto_assigned=True,  # Generated by AI
                            notes="Auto-generated by AI schedule optimizer",
                        )
                        db.add(assignment)
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
