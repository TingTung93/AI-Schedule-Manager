"""
Security patch for CRUD operations.
Apply this patch to crud.py to fix SQL injection and transaction rollback vulnerabilities.
"""

# Add this method to CRUDBase class
def _sanitize_sql_wildcards(self, value: str) -> str:
    """Sanitize SQL wildcards from user input to prevent SQL injection in ILIKE patterns."""
    if not isinstance(value, str):
        return value
    # Escape SQL wildcard characters
    return value.replace("%", "\\%").replace("_", "\\_")


# Replace get_multi method with this secured version:
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
    # Validate pagination parameters to prevent abuse
    if skip < 0:
        skip = 0
    if limit < 1:
        limit = 1
    if limit > 1000:
        limit = 1000

    query = select(self.model)

    # Apply filters
    if filters:
        for key, value in filters.items():
            if value is not None and hasattr(self.model, key):
                column = getattr(self.model, key)
                if isinstance(value, str) and key in ["name", "email", "title", "message"]:
                    # Text search - sanitize to prevent SQL injection
                    sanitized_value = self._sanitize_sql_wildcards(value)
                    query = query.where(column.ilike(f"%{sanitized_value}%"))
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


# Replace create method with this secured version:
async def create(self, db: AsyncSession, obj_in):
    """Create new record with transaction rollback on error."""
    try:
        if hasattr(obj_in, "dict"):
            obj_data = obj_in.dict()
        else:
            obj_data = obj_in

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        # Invalidate caches if applicable
        await self._invalidate_caches(db_obj)

        return db_obj
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating {self.model.__name__}: {e}")
        raise


# Replace update method with this secured version:
async def update(self, db: AsyncSession, db_obj, obj_in):
    """Update existing record with transaction rollback on error."""
    try:
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

        # Invalidate caches if applicable
        await self._invalidate_caches(db_obj)

        return db_obj
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating {self.model.__name__}: {e}")
        raise


# Replace remove method with this secured version:
async def remove(self, db: AsyncSession, id: int):
    """Delete record by ID with transaction rollback on error."""
    try:
        result = await db.execute(select(self.model).where(self.model.id == id))
        obj = result.scalar_one_or_none()
        if obj:
            await db.delete(obj)
            await db.commit()

            # Invalidate caches if applicable
            await self._invalidate_caches(obj)

        return obj
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting {self.model.__name__}: {e}")
        raise


async def _invalidate_caches(self, obj):
    """Invalidate caches based on model type."""
    if hasattr(self, 'invalidate_cache'):
        await self.invalidate_cache(obj)
