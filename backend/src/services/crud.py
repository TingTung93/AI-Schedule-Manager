"""
CRUD operations for all models.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Employee, Notification, Rule, Schedule, ScheduleTemplate, Shift
from ..schemas import (
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
        """Create new record."""
        if hasattr(obj_in, "dict"):
            obj_data = obj_in.dict()
        else:
            obj_data = obj_in

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj, obj_in):
        """Update existing record."""
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
        return db_obj

    async def remove(self, db: AsyncSession, id: int):
        """Delete record by ID."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        obj = result.scalar_one_or_none()
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj


class CRUDEmployee(CRUDBase):
    """CRUD operations for Employee model."""

    def __init__(self):
        super().__init__(Employee)

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[Employee]:
        """Get employee by email."""
        result = await db.execute(select(Employee).where(Employee.email == email))
        return result.scalar_one_or_none()

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
            query = query.where(Employee.active == active)

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
        """Get employee schedule."""
        query = select(Schedule).where(Schedule.employee_id == employee_id)
        query = query.options(selectinload(Schedule.shift))

        if date_from:
            query = query.where(Schedule.date >= date_from)
        if date_to:
            query = query.where(Schedule.date <= date_to)

        query = query.order_by(Schedule.date.desc())

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
        """Get schedules with employee and shift data."""
        query = select(Schedule).options(selectinload(Schedule.employee), selectinload(Schedule.shift))

        # Apply filters
        if employee_id:
            query = query.where(Schedule.employee_id == employee_id)

        if shift_id:
            query = query.where(Schedule.shift_id == shift_id)

        if date_from:
            query = query.where(Schedule.date >= date_from)

        if date_to:
            query = query.where(Schedule.date <= date_to)

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
        query = select(Notification).options(selectinload(Notification.employee))

        # Apply filters
        if employee_id:
            query = query.where(Notification.employee_id == employee_id)

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
        """Count how many schedules reference this shift."""
        result = await db.execute(select(func.count(Schedule.id)).where(Schedule.shift_id == shift_id))
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


# Create CRUD instances
crud_employee = CRUDEmployee()
crud_rule = CRUDRule()
crud_schedule = CRUDSchedule()
crud_notification = CRUDNotification()
crud_shift = CRUDShift()
crud_schedule_template = CRUDScheduleTemplate()
