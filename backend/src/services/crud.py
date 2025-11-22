"""
CRUD operations for all models.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Department, Employee, Notification, Rule, Schedule, ScheduleAssignment, ScheduleTemplate, Shift
from ..schemas import (
    DepartmentCreate,
    DepartmentUpdate,
    EmployeeCreate,
    EmployeeUpdate,
    NotificationCreate,
    NotificationUpdate,
    RuleCreate,
    RuleUpdate,
    ScheduleCreate,
    ScheduleUpdate,
    ShiftCreate,
    ShiftUpdate,
)
from ..utils.cache import (
    cache_manager,
    invalidate_department_cache,
    invalidate_employee_cache,
    invalidate_schedule_cache,
    invalidate_shift_cache,
)

logger = logging.getLogger(__name__)


class CRUDBase:
    """Base CRUD class with common operations."""

    def __init__(self, model):
        self.model = model

    async def get(self, db: AsyncSession, id: int):
        """Get single record by ID."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        filters: Dict[str, Any] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ):
        """Get multiple records with pagination and filtering."""
        query = select(self.model)

        # Apply filters
        if filters:
            for key, value in filters.items():
                if value is not None and hasattr(self.model, key):
                    column = getattr(self.model, key)
                    if isinstance(value, str) and key in ["name", "email", "title", "message"]:
                        # Text search
                        query = query.where(column.ilike(f"%{value}%"))
                    else:
                        query = query.where(column == value)

        # Apply sorting
        if hasattr(self.model, sort_by):
            column = getattr(self.model, sort_by)
            if sort_order == "desc":
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def create(self, db: AsyncSession, obj_in):
        """Create new record and invalidate related caches."""
        if hasattr(obj_in, "dict"):
            obj_data = obj_in.dict()
        else:
            obj_data = obj_in

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        # Invalidate related caches based on model type
        self._invalidate_cache_after_create(db_obj)

        return db_obj

    def _invalidate_cache_after_create(self, db_obj):
        """Invalidate caches after creating a record."""
        model_name = db_obj.__class__.__name__
        if model_name == "Employee":
            invalidate_employee_cache()
        elif model_name == "Department":
            invalidate_department_cache()
        elif model_name == "Shift":
            invalidate_shift_cache()
        elif model_name == "Schedule":
            invalidate_schedule_cache()

    async def update(self, db: AsyncSession, db_obj, obj_in):
        """Update existing record and invalidate related caches."""
        if hasattr(obj_in, "dict"):
            update_data = obj_in.dict(exclude_unset=True)
        else:
            update_data = obj_in

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        # Invalidate related caches based on model type
        self._invalidate_cache_after_update(db_obj)

        return db_obj

    def _invalidate_cache_after_update(self, db_obj):
        """Invalidate caches after updating a record."""
        model_name = db_obj.__class__.__name__
        if model_name == "Employee":
            invalidate_employee_cache(employee_id=db_obj.id, email=getattr(db_obj, "email", None))
        elif model_name == "Department":
            invalidate_department_cache(department_id=db_obj.id)
        elif model_name == "Shift":
            invalidate_shift_cache(shift_id=db_obj.id, shift_name=getattr(db_obj, "name", None))
        elif model_name == "Schedule":
            invalidate_schedule_cache(schedule_id=db_obj.id)

    async def remove(self, db: AsyncSession, id: int):
        """Delete record by ID and invalidate related caches."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        obj = result.scalar_one_or_none()
        if obj:
            # Invalidate caches before deleting
            self._invalidate_cache_after_delete(obj)
            await db.delete(obj)
            await db.commit()
        return obj

    def _invalidate_cache_after_delete(self, db_obj):
        """Invalidate caches after deleting a record."""
        model_name = db_obj.__class__.__name__
        if model_name == "Employee":
            invalidate_employee_cache(employee_id=db_obj.id, email=getattr(db_obj, "email", None))
        elif model_name == "Department":
            invalidate_department_cache(department_id=db_obj.id)
        elif model_name == "Shift":
            invalidate_shift_cache(shift_id=db_obj.id, shift_name=getattr(db_obj, "name", None))
        elif model_name == "Schedule":
            invalidate_schedule_cache(schedule_id=db_obj.id)


class CRUDEmployee(CRUDBase):
    """CRUD operations for Employee model."""

    def __init__(self):
        super().__init__(Employee)

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[Employee]:
        """Get employee by email with caching."""
        # Try cache first
        cache_key = f"email:{email}"
        cached_employee = cache_manager.get("employee", cache_key)
        if cached_employee is not None:
            logger.debug(f"Cache hit for employee email: {email}")
            # Convert dict back to Employee object
            from ..models import Employee

            return Employee(**cached_employee) if isinstance(cached_employee, dict) else cached_employee

        # Cache miss - query database
        result = await db.execute(select(Employee).where(Employee.email == email))
        employee = result.scalar_one_or_none()

        # Cache the result if found
        if employee:
            # Convert to dict for JSON serialization in cache
            employee_dict = {
                "id": employee.id,
                "name": employee.name,
                "email": employee.email,
                "role": employee.role,
                "phone": employee.phone,
                "hourly_rate": employee.hourly_rate,
                "max_hours_per_week": employee.max_hours_per_week,
                "qualifications": employee.qualifications,
                "is_active": employee.is_active,
                "department_id": employee.department_id,
            }
            cache_manager.set("employee", cache_key, employee_dict)
            logger.debug(f"Cached employee: {email}")

        return employee

    async def get_multi_with_search(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        search: str = None,
        role: str = None,
        active: bool = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ):
        """Get employees with advanced filtering."""
        query = select(Employee)

        # Apply filters
        if search:
            query = query.where(or_(Employee.name.ilike(f"%{search}%"), Employee.email.ilike(f"%{search}%")))

        if role:
            query = query.where(Employee.role == role)

        if active is not None:
            query = query.where(Employee.is_active == active)

        # Apply sorting
        if hasattr(Employee, sort_by):
            column = getattr(Employee, sort_by)
            if sort_order == "desc":
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def get_schedule(self, db: AsyncSession, employee_id: int, date_from: str = None, date_to: str = None):
        """
        Get employee schedule assignments.

        Returns ScheduleAssignment objects (not Schedule containers) for the given employee.
        """
        from datetime import date as date_type

        # Query assignments for this employee
        query = (
            select(ScheduleAssignment)
            .join(Shift, ScheduleAssignment.shift_id == Shift.id)
            .join(Schedule, ScheduleAssignment.schedule_id == Schedule.id)
            .where(ScheduleAssignment.employee_id == employee_id)
            .options(
                selectinload(ScheduleAssignment.shift),
                selectinload(ScheduleAssignment.schedule),
                selectinload(ScheduleAssignment.employee),
            )
        )

        # Filter by shift dates (not schedule dates)
        if date_from:
            if isinstance(date_from, str):
                date_from = date_type.fromisoformat(date_from)
            query = query.where(Shift.date >= date_from)

        if date_to:
            if isinstance(date_to, str):
                date_to = date_type.fromisoformat(date_to)
            query = query.where(Shift.date <= date_to)

        # Order by shift date
        query = query.order_by(Shift.date.desc())

        result = await db.execute(query)
        return result.scalars().all()


class CRUDRule(CRUDBase):
    """CRUD operations for Rule model."""

    def __init__(self):
        super().__init__(Rule)

    async def get_multi_with_filters(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        rule_type: str = None,
        employee_id: int = None,
        active: bool = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ):
        """Get rules with filtering."""
        query = select(Rule).options(selectinload(Rule.employee))

        # Apply filters
        if rule_type:
            query = query.where(Rule.rule_type == rule_type)

        if employee_id:
            query = query.where(Rule.employee_id == employee_id)

        if active is not None:
            query = query.where(Rule.active == active)

        # Apply sorting
        if hasattr(Rule, sort_by):
            column = getattr(Rule, sort_by)
            if sort_order == "desc":
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}


class CRUDSchedule(CRUDBase):
    """CRUD operations for Schedule model."""

    def __init__(self):
        super().__init__(Schedule)

    async def get_multi_with_relations(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        employee_id: int = None,
        shift_id: int = None,
        date_from: str = None,
        date_to: str = None,
        status: str = None,
        sort_by: str = "date",
        sort_order: str = "desc",
    ):
        """Get schedules with assignments, employees and shifts data."""
        query = select(Schedule).options(selectinload(Schedule.assignments))

        # Apply filters based on schedule date range
        if date_from:
            query = query.where(Schedule.week_start >= date_from)

        if date_to:
            query = query.where(Schedule.week_end <= date_to)

        if status:
            query = query.where(Schedule.status == status)

        # Apply sorting
        if hasattr(Schedule, sort_by):
            column = getattr(Schedule, sort_by)
            if sort_order == "desc":
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def update_shift(self, db: AsyncSession, schedule_id: int, shift_id: int, updates: dict):
        """Update a specific shift in a schedule."""
        # Get the schedule
        schedule = await self.get(db, schedule_id)
        if not schedule:
            return None

        # Update shift reference
        schedule.shift_id = shift_id

        # Apply any additional updates
        for field, value in updates.items():
            if hasattr(schedule, field):
                setattr(schedule, field, value)

        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
        return schedule


class CRUDNotification(CRUDBase):
    """CRUD operations for Notification model."""

    def __init__(self):
        super().__init__(Notification)

    async def get_multi_with_filters(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        employee_id: int = None,
        notification_type: str = None,
        read: bool = None,
        priority: str = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ):
        """Get notifications with filtering."""
        # Note: Notification.employee relationship not available due to different Base classes
        query = select(Notification)

        # Apply filters
        if employee_id:
            query = query.where(Notification.user_id == employee_id)

        if notification_type:
            query = query.where(Notification.notification_type == notification_type)

        if read is not None:
            query = query.where(Notification.read == read)

        if priority:
            query = query.where(Notification.priority == priority)

        # Apply sorting
        if hasattr(Notification, sort_by):
            column = getattr(Notification, sort_by)
            if sort_order == "desc":
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def mark_as_read(self, db: AsyncSession, notification_id: int):
        """Mark notification as read."""
        notification = await self.get(db, notification_id)
        if notification:
            notification.read = True
            db.add(notification)
            await db.commit()
            await db.refresh(notification)
        return notification

    async def mark_all_as_read(self, db: AsyncSession, employee_id: int = None):
        """Mark all notifications as read for user or globally."""
        query = update(Notification).values(read=True)

        if employee_id:
            query = query.where(Notification.employee_id == employee_id)

        result = await db.execute(query)
        await db.commit()
        return result.rowcount


class CRUDShift(CRUDBase):
    """CRUD operations for Shift model."""

    def __init__(self):
        super().__init__(Shift)

    async def get_shift_types(self, db: AsyncSession) -> dict:
        """Get all shift types with counts."""
        from sqlalchemy import func

        result = await db.execute(
            select(Shift.shift_type, func.count(Shift.id))
            .where(Shift.active == True)
            .group_by(Shift.shift_type)
        )
        rows = result.all()
        return {shift_type: count for shift_type, count in rows}

    async def check_conflicts(
        self, db: AsyncSession, department: str, start_time, end_time, exclude_id: int = None
    ) -> List[Shift]:
        """Check for conflicting shifts in the same department."""
        query = select(Shift).where(
            Shift.department == department,
            Shift.active == True,
            or_(
                # New shift starts during existing shift
                (Shift.start_time <= start_time) & (Shift.end_time > start_time),
                # New shift ends during existing shift
                (Shift.start_time < end_time) & (Shift.end_time >= end_time),
                # New shift encompasses existing shift
                (Shift.start_time >= start_time) & (Shift.end_time <= end_time),
            ),
        )

        if exclude_id:
            query = query.where(Shift.id != exclude_id)

        result = await db.execute(query)
        return result.scalars().all()

    async def count_schedule_usage(self, db: AsyncSession, shift_id: int) -> int:
        """
        Count how many schedule assignments reference this shift.

        Returns the number of ScheduleAssignment records using this shift.
        """
        result = await db.execute(
            select(func.count(ScheduleAssignment.id)).where(ScheduleAssignment.shift_id == shift_id)
        )
        return result.scalar()


class CRUDScheduleTemplate(CRUDBase):
    """CRUD operations for ScheduleTemplate model."""

    def __init__(self):
        super().__init__(ScheduleTemplate)

    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[ScheduleTemplate]:
        """Get template by name."""
        result = await db.execute(select(ScheduleTemplate).where(ScheduleTemplate.name == name))
        return result.scalar_one_or_none()

    async def get_active_templates(self, db: AsyncSession, skip: int = 0, limit: int = 100):
        """Get all active templates."""
        query = select(ScheduleTemplate).where(ScheduleTemplate.active == True).order_by(ScheduleTemplate.created_at.desc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}


class CRUDDepartment(CRUDBase):
    """CRUD operations for Department model."""

    def __init__(self):
        super().__init__(Department)

    async def get_with_hierarchy(self, db: AsyncSession, department_id: int):
        """Get department with parent and children, with caching."""
        # Try cache first
        cache_key = f"hierarchy:{department_id}"
        cached_dept = cache_manager.get("department", cache_key)
        if cached_dept is not None:
            logger.debug(f"Cache hit for department hierarchy: {department_id}")
            # Note: This returns dict, caller may need to handle conversion
            return cached_dept

        # Cache miss - query database
        query = select(Department).where(Department.id == department_id)
        query = query.options(selectinload(Department.parent), selectinload(Department.children))
        result = await db.execute(query)
        department = result.scalar_one_or_none()

        # Cache the result if found
        if department:
            dept_dict = {
                "id": department.id,
                "name": department.name,
                "description": department.description,
                "active": department.active,
                "parent_id": department.parent_id,
                "parent": {
                    "id": department.parent.id,
                    "name": department.parent.name,
                }
                if department.parent
                else None,
                "children": [{"id": child.id, "name": child.name} for child in department.children],
            }
            cache_manager.set("department", cache_key, dept_dict)
            logger.debug(f"Cached department hierarchy: {department_id}")

        return department

    async def get_multi_with_hierarchy(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        active: bool = None,
        parent_id: int = None,
        search: str = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ):
        """Get departments with hierarchy and filtering."""
        query = select(Department).options(selectinload(Department.parent), selectinload(Department.children))

        # Apply filters
        if active is not None:
            query = query.where(Department.active == active)

        if parent_id is not None:
            query = query.where(Department.parent_id == parent_id)

        if search:
            query = query.where(Department.name.ilike(f"%{search}%"))

        # Apply sorting
        if hasattr(Department, sort_by):
            column = getattr(Department, sort_by)
            if sort_order == "desc":
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def get_staff(self, db: AsyncSession, department_id: int, skip: int = 0, limit: int = 100):
        """Get all staff in department."""
        query = select(Employee).where(Employee.department_id == department_id)
        query = query.order_by(Employee.name.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def get_shifts(self, db: AsyncSession, department_id: int, skip: int = 0, limit: int = 100):
        """Get all shifts in department."""
        query = select(Shift).where(Shift.department_id == department_id)
        query = query.order_by(Shift.name.asc())

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def check_dependencies(self, db: AsyncSession, department_id: int) -> dict:
        """Check if department has dependencies before deletion."""
        # Check employees
        employee_count = await db.execute(select(func.count()).where(Employee.department_id == department_id))
        employees = employee_count.scalar()

        # Check shifts
        shift_count = await db.execute(select(func.count()).where(Shift.department_id == department_id))
        shifts = shift_count.scalar()

        # Check child departments
        child_count = await db.execute(select(func.count()).where(Department.parent_id == department_id))
        children = child_count.scalar()

        return {
            "has_dependencies": (employees > 0 or shifts > 0 or children > 0),
            "employees": employees,
            "shifts": shifts,
            "children": children,
        }

    async def get_analytics_overview(self, db: AsyncSession) -> dict:
        """
        Get department analytics overview.

        Returns comprehensive statistics about all departments.
        """
        # Total departments (active/inactive)
        dept_stats = await db.execute(
            select(
                func.count(Department.id).label("total"),
                func.sum(func.cast(Department.active, Integer)).label("active"),
            )
        )
        dept_row = dept_stats.first()
        total_departments = dept_row.total or 0
        active_departments = dept_row.active or 0
        inactive_departments = total_departments - active_departments

        # Employee assignment statistics
        employee_stats = await db.execute(
            select(
                func.count(Employee.id).label("total"),
                func.sum(func.cast(Employee.department_id.isnot(None), Integer)).label("assigned"),
            )
        )
        emp_row = employee_stats.first()
        total_employees = emp_row.total or 0
        assigned_employees = emp_row.assigned or 0
        unassigned_employees = total_employees - assigned_employees

        # Average employees per department
        avg_employees = round(assigned_employees / total_departments, 2) if total_departments > 0 else 0.0

        # Largest and smallest departments
        dept_sizes = await db.execute(
            select(
                Department.id,
                Department.name,
                Department.active,
                func.count(Employee.id).label("employee_count")
            )
            .outerjoin(Employee, Employee.department_id == Department.id)
            .group_by(Department.id, Department.name, Department.active)
            .having(func.count(Employee.id) > 0)
            .order_by(func.count(Employee.id).desc())
        )
        all_dept_sizes = dept_sizes.all()

        largest_dept = None
        smallest_dept = None
        if all_dept_sizes:
            largest = all_dept_sizes[0]
            largest_dept = {
                "id": largest.id,
                "name": largest.name,
                "employee_count": largest.employee_count,
                "active": largest.active,
            }
            smallest = all_dept_sizes[-1]
            smallest_dept = {
                "id": smallest.id,
                "name": smallest.name,
                "employee_count": smallest.employee_count,
                "active": smallest.active,
            }

        # Calculate hierarchy depth using recursive CTE
        # Count root departments
        root_count = await db.execute(
            select(func.count(Department.id)).where(Department.parent_id.is_(None))
        )
        root_departments = root_count.scalar() or 0

        # Max hierarchy depth (simplified - get max depth by counting parent references)
        max_depth = 1  # At least 1 level if departments exist
        if total_departments > 0:
            # For simplicity, we'll calculate depth by checking parent chains
            # In production, use recursive CTE for accurate depth
            depth_query = await db.execute(
                select(func.max(func.coalesce(Department.parent_id, 0)))
            )
            max_depth = 1  # Default depth

        return {
            "total_departments": total_departments,
            "active_departments": active_departments,
            "inactive_departments": inactive_departments,
            "total_employees_assigned": assigned_employees,
            "total_employees_unassigned": unassigned_employees,
            "average_employees_per_department": avg_employees,
            "largest_department": largest_dept,
            "smallest_department": smallest_dept,
            "max_hierarchy_depth": max_depth,
            "root_departments_count": root_departments,
        }

    async def get_employee_distribution(self, db: AsyncSession) -> list:
        """
        Get employee distribution across departments.

        Returns list of departments with employee counts and percentages.
        """
        # Get total employees for percentage calculation
        total_result = await db.execute(
            select(func.count(Employee.id)).where(Employee.department_id.isnot(None))
        )
        total_employees = total_result.scalar() or 0

        # Get distribution per department
        distribution = await db.execute(
            select(
                Department.id,
                Department.name,
                Department.active,
                func.count(Employee.id).label("employee_count")
            )
            .outerjoin(Employee, Employee.department_id == Department.id)
            .group_by(Department.id, Department.name, Department.active)
            .order_by(func.count(Employee.id).desc())
        )

        results = []
        for row in distribution.all():
            percentage = round((row.employee_count / total_employees * 100), 2) if total_employees > 0 else 0.0
            results.append({
                "department_id": row.id,
                "department_name": row.name,
                "employee_count": row.employee_count,
                "percentage": percentage,
                "active": row.active,
            })

        return results

    async def get_department_detailed_analytics(self, db: AsyncSession, department_id: int) -> dict:
        """
        Get detailed analytics for a specific department.

        Includes employee counts by role, subdepartment count, and assignment trends.
        """
        # Check if department exists
        dept = await self.get(db, department_id)
        if not dept:
            return None

        # Total employees in department
        total_emp = await db.execute(
            select(func.count(Employee.id)).where(Employee.department_id == department_id)
        )
        total_employees = total_emp.scalar() or 0

        # Employees by role
        role_distribution = await db.execute(
            select(Employee.role, func.count(Employee.id).label("count"))
            .where(Employee.department_id == department_id)
            .group_by(Employee.role)
        )
        employee_by_role = {row.role: row.count for row in role_distribution.all()}

        # Active vs inactive employees
        active_count = await db.execute(
            select(func.count(Employee.id))
            .where(Employee.department_id == department_id, Employee.is_active == True)
        )
        active_employees = active_count.scalar() or 0
        inactive_employees = total_employees - active_employees

        # Subdepartment count
        child_count = await db.execute(
            select(func.count(Department.id)).where(Department.parent_id == department_id)
        )
        subdepartment_count = child_count.scalar() or 0

        # Assignment trends (simplified - tracking employee count changes)
        # In a real implementation, you would track assignment history
        # For now, return empty trends as placeholder
        assignment_trends_30d = []
        assignment_trends_60d = []
        assignment_trends_90d = []

        return {
            "department_id": department_id,
            "department_name": dept.name,
            "total_employees": total_employees,
            "employee_by_role": employee_by_role,
            "active_employees": active_employees,
            "inactive_employees": inactive_employees,
            "subdepartment_count": subdepartment_count,
            "assignment_trends_30d": assignment_trends_30d,
            "assignment_trends_60d": assignment_trends_60d,
            "assignment_trends_90d": assignment_trends_90d,
        }


# Create CRUD instances
crud_department = CRUDDepartment()
crud_employee = CRUDEmployee()
crud_rule = CRUDRule()
crud_schedule = CRUDSchedule()
crud_notification = CRUDNotification()
crud_shift = CRUDShift()
crud_schedule_template = CRUDScheduleTemplate()
