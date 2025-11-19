"""
CRUD operations for Shift Definitions
"""

from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ShiftDefinition
from ..schemas.shift_definition import ShiftDefinitionCreate, ShiftDefinitionUpdate


class CRUDShiftDefinition:
    """CRUD operations for shift definitions"""

    async def get(self, db: AsyncSession, id: int) -> Optional[ShiftDefinition]:
        """Get a single shift definition by ID"""
        result = await db.execute(select(ShiftDefinition).where(ShiftDefinition.id == id))
        return result.scalar_one_or_none()

    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[ShiftDefinition]:
        """Get a shift definition by name"""
        result = await db.execute(select(ShiftDefinition).where(ShiftDefinition.name == name))
        return result.scalar_one_or_none()

    async def get_by_abbreviation(self, db: AsyncSession, abbreviation: str) -> Optional[ShiftDefinition]:
        """Get a shift definition by abbreviation"""
        result = await db.execute(
            select(ShiftDefinition).where(ShiftDefinition.abbreviation == abbreviation)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        """
        Get multiple shift definitions with pagination and filtering

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Dictionary of filters (department_id, shift_type, is_active, search)
            sort_by: Field to sort by
            sort_order: Sort order (asc or desc)

        Returns:
            Dictionary with 'items' and 'total' keys
        """
        query = select(ShiftDefinition)

        # Apply filters
        if filters:
            conditions = []

            if "department_id" in filters:
                if filters["department_id"] is None:
                    conditions.append(ShiftDefinition.department_id.is_(None))
                else:
                    conditions.append(ShiftDefinition.department_id == filters["department_id"])

            if "shift_type" in filters:
                conditions.append(ShiftDefinition.shift_type == filters["shift_type"])

            if "is_active" in filters:
                conditions.append(ShiftDefinition.is_active == filters["is_active"])

            if "search" in filters and filters["search"]:
                search_term = f"%{filters['search']}%"
                conditions.append(
                    or_(
                        ShiftDefinition.name.ilike(search_term),
                        ShiftDefinition.abbreviation.ilike(search_term),
                        ShiftDefinition.description.ilike(search_term),
                    )
                )

            if conditions:
                query = query.where(and_(*conditions))

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply sorting
        sort_column = getattr(ShiftDefinition, sort_by, ShiftDefinition.name)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(sort_column)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Execute query
        result = await db.execute(query)
        items = result.scalars().all()

        return {"items": items, "total": total}

    async def create(
        self,
        db: AsyncSession,
        obj_in: ShiftDefinitionCreate,
        created_by_id: Optional[int] = None
    ) -> ShiftDefinition:
        """Create a new shift definition"""
        db_obj = ShiftDefinition(
            name=obj_in.name,
            abbreviation=obj_in.abbreviation,
            shift_type=obj_in.shift_type,
            start_time=obj_in.start_time,
            end_time=obj_in.end_time,
            color=obj_in.color,
            required_staff=obj_in.required_staff,
            department_id=obj_in.department_id,
            hourly_rate_multiplier=obj_in.hourly_rate_multiplier,
            required_qualifications=obj_in.required_qualifications,
            is_active=obj_in.is_active,
            description=obj_in.description,
            created_by_id=created_by_id,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        db_obj: ShiftDefinition,
        obj_in: ShiftDefinitionUpdate
    ) -> ShiftDefinition:
        """Update an existing shift definition"""
        update_data = obj_in.dict(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, id: int) -> bool:
        """Delete a shift definition"""
        result = await db.execute(select(ShiftDefinition).where(ShiftDefinition.id == id))
        obj = result.scalar_one_or_none()

        if obj:
            await db.delete(obj)
            await db.commit()
            return True
        return False

    async def get_active(
        self,
        db: AsyncSession,
        *,
        department_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[ShiftDefinition]:
        """Get all active shift definitions, optionally filtered by department"""
        query = select(ShiftDefinition).where(ShiftDefinition.is_active == True)

        if department_id is not None:
            query = query.where(
                or_(
                    ShiftDefinition.department_id == department_id,
                    ShiftDefinition.department_id.is_(None)  # Include organization-wide shifts
                )
            )

        query = query.order_by(ShiftDefinition.name).offset(skip).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_by_type(
        self,
        db: AsyncSession,
        shift_type: str,
        *,
        is_active: Optional[bool] = None
    ) -> List[ShiftDefinition]:
        """Get all shift definitions of a specific type"""
        query = select(ShiftDefinition).where(ShiftDefinition.shift_type == shift_type)

        if is_active is not None:
            query = query.where(ShiftDefinition.is_active == is_active)

        query = query.order_by(ShiftDefinition.start_time)

        result = await db.execute(query)
        return result.scalars().all()

    async def check_name_exists(
        self,
        db: AsyncSession,
        name: str,
        exclude_id: Optional[int] = None
    ) -> bool:
        """Check if a shift definition name already exists"""
        query = select(ShiftDefinition).where(ShiftDefinition.name == name)

        if exclude_id:
            query = query.where(ShiftDefinition.id != exclude_id)

        result = await db.execute(query)
        return result.scalar_one_or_none() is not None

    async def check_abbreviation_exists(
        self,
        db: AsyncSession,
        abbreviation: str,
        exclude_id: Optional[int] = None
    ) -> bool:
        """Check if a shift definition abbreviation already exists"""
        query = select(ShiftDefinition).where(ShiftDefinition.abbreviation == abbreviation)

        if exclude_id:
            query = query.where(ShiftDefinition.id != exclude_id)

        result = await db.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_shift_types_with_counts(self, db: AsyncSession) -> Dict[str, int]:
        """Get count of shift definitions by type"""
        result = await db.execute(
            select(
                ShiftDefinition.shift_type,
                func.count(ShiftDefinition.id).label("count")
            )
            .where(ShiftDefinition.is_active == True)
            .group_by(ShiftDefinition.shift_type)
        )

        return {row[0]: row[1] for row in result}


crud_shift_definition = CRUDShiftDefinition()
