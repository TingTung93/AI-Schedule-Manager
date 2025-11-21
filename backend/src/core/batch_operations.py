"""
Batch operation utilities for efficient bulk database operations
"""

import logging
from typing import List, TypeVar, Generic, Dict, Any
from sqlalchemy import insert, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = logging.getLogger(__name__)

T = TypeVar('T')

# Batch size configuration
DEFAULT_BATCH_SIZE = 500
MAX_BATCH_SIZE = 1000


class BatchOperations:
    """Utility class for efficient batch database operations"""

    @staticmethod
    async def bulk_insert(
        db: AsyncSession,
        model,
        items: List[Dict[str, Any]],
        batch_size: int = DEFAULT_BATCH_SIZE,
        commit: bool = True
    ) -> int:
        """
        Efficient bulk insert using PostgreSQL COPY or batch INSERT

        Args:
            db: Database session
            model: SQLAlchemy model class
            items: List of dictionaries with item data
            batch_size: Items per batch (default: 500)
            commit: Whether to commit after insert (default: True)

        Returns:
            Number of items inserted

        Example:
            items = [
                {"name": "John", "email": "john@example.com"},
                {"name": "Jane", "email": "jane@example.com"},
            ]
            count = await BatchOperations.bulk_insert(db, Employee, items)
        """
        if not items:
            return 0

        total_inserted = 0

        # Process in batches
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]

            # Use bulk insert
            stmt = insert(model).values(batch)

            try:
                await db.execute(stmt)
                total_inserted += len(batch)

                logger.debug(f"Bulk inserted {len(batch)} items (total: {total_inserted}/{len(items)})")

            except Exception as e:
                logger.error(f"Bulk insert failed for batch {i//batch_size}: {e}")
                raise

        # Commit if requested
        if commit:
            await db.commit()

        logger.info(f"Bulk insert completed: {total_inserted} items")
        return total_inserted

    @staticmethod
    async def bulk_upsert(
        db: AsyncSession,
        model,
        items: List[Dict[str, Any]],
        constraint_columns: List[str],
        update_columns: List[str],
        batch_size: int = DEFAULT_BATCH_SIZE,
        commit: bool = True
    ) -> int:
        """
        Bulk insert with ON CONFLICT DO UPDATE (PostgreSQL upsert)

        Args:
            db: Database session
            model: SQLAlchemy model class
            items: List of dictionaries with item data
            constraint_columns: Columns that define uniqueness constraint
            update_columns: Columns to update on conflict
            batch_size: Items per batch
            commit: Whether to commit after upsert

        Returns:
            Number of items upserted

        Example:
            items = [
                {"email": "john@example.com", "name": "John Updated"},
            ]
            count = await BatchOperations.bulk_upsert(
                db, Employee, items,
                constraint_columns=["email"],
                update_columns=["name", "updated_at"]
            )
        """
        if not items:
            return 0

        total_upserted = 0

        # Process in batches
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]

            # Build upsert statement (PostgreSQL specific)
            stmt = pg_insert(model).values(batch)

            # Define conflict action
            update_dict = {col: stmt.excluded[col] for col in update_columns}
            stmt = stmt.on_conflict_do_update(
                index_elements=constraint_columns,
                set_=update_dict
            )

            try:
                await db.execute(stmt)
                total_upserted += len(batch)

                logger.debug(f"Bulk upserted {len(batch)} items (total: {total_upserted}/{len(items)})")

            except Exception as e:
                logger.error(f"Bulk upsert failed for batch {i//batch_size}: {e}")
                raise

        # Commit if requested
        if commit:
            await db.commit()

        logger.info(f"Bulk upsert completed: {total_upserted} items")
        return total_upserted

    @staticmethod
    async def bulk_update(
        db: AsyncSession,
        model,
        updates: List[Dict[str, Any]],
        id_column: str = 'id',
        batch_size: int = DEFAULT_BATCH_SIZE,
        commit: bool = True
    ) -> int:
        """
        Bulk update multiple records efficiently

        Args:
            db: Database session
            model: SQLAlchemy model class
            updates: List of dicts with id and fields to update
            id_column: Name of ID column (default: 'id')
            batch_size: Items per batch
            commit: Whether to commit after update

        Returns:
            Number of items updated

        Example:
            updates = [
                {"id": 1, "status": "active"},
                {"id": 2, "status": "inactive"},
            ]
            count = await BatchOperations.bulk_update(db, Employee, updates)
        """
        if not updates:
            return 0

        total_updated = 0

        # Process in batches
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]

            # Extract IDs and update data
            for item in batch:
                item_id = item.pop(id_column)

                # Build update statement
                stmt = (
                    update(model)
                    .where(getattr(model, id_column) == item_id)
                    .values(**item)
                )

                try:
                    result = await db.execute(stmt)
                    total_updated += result.rowcount

                except Exception as e:
                    logger.error(f"Bulk update failed for item {item_id}: {e}")
                    raise

        # Commit if requested
        if commit:
            await db.commit()

        logger.info(f"Bulk update completed: {total_updated} items")
        return total_updated

    @staticmethod
    async def bulk_delete(
        db: AsyncSession,
        model,
        ids: List[Any],
        id_column: str = 'id',
        batch_size: int = DEFAULT_BATCH_SIZE,
        commit: bool = True
    ) -> int:
        """
        Bulk delete records by IDs

        Args:
            db: Database session
            model: SQLAlchemy model class
            ids: List of IDs to delete
            id_column: Name of ID column (default: 'id')
            batch_size: Items per batch
            commit: Whether to commit after delete

        Returns:
            Number of items deleted

        Example:
            deleted = await BatchOperations.bulk_delete(
                db, Employee, [1, 2, 3, 4, 5]
            )
        """
        if not ids:
            return 0

        total_deleted = 0

        # Process in batches
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]

            # Build delete statement
            stmt = delete(model).where(getattr(model, id_column).in_(batch_ids))

            try:
                result = await db.execute(stmt)
                total_deleted += result.rowcount

                logger.debug(f"Bulk deleted {result.rowcount} items (total: {total_deleted}/{len(ids)})")

            except Exception as e:
                logger.error(f"Bulk delete failed for batch {i//batch_size}: {e}")
                raise

        # Commit if requested
        if commit:
            await db.commit()

        logger.info(f"Bulk delete completed: {total_deleted} items")
        return total_deleted


class BatchShiftOperations:
    """Specialized batch operations for shift scheduling"""

    @staticmethod
    async def create_shifts_bulk(
        db: AsyncSession,
        shifts_data: List[Dict[str, Any]],
        batch_size: int = 500
    ) -> int:
        """
        Efficiently create multiple shifts in bulk

        Optimized for schedule generation which creates hundreds of shifts.

        Args:
            db: Database session
            shifts_data: List of shift dictionaries
            batch_size: Shifts per batch (default: 500)

        Returns:
            Number of shifts created
        """
        from ..models import Shift

        # Add timestamps
        from datetime import datetime
        now = datetime.utcnow()
        for shift in shifts_data:
            shift.setdefault('created_at', now)
            shift.setdefault('updated_at', now)

        # Use bulk insert
        return await BatchOperations.bulk_insert(
            db=db,
            model=Shift,
            items=shifts_data,
            batch_size=batch_size,
            commit=True
        )

    @staticmethod
    async def update_shifts_status_bulk(
        db: AsyncSession,
        shift_ids: List[int],
        new_status: str,
        batch_size: int = 500
    ) -> int:
        """
        Bulk update shift statuses

        Args:
            db: Database session
            shift_ids: List of shift IDs to update
            new_status: New status value
            batch_size: Updates per batch

        Returns:
            Number of shifts updated
        """
        from ..models import Shift
        from datetime import datetime

        updates = [
            {
                "id": shift_id,
                "status": new_status,
                "updated_at": datetime.utcnow()
            }
            for shift_id in shift_ids
        ]

        return await BatchOperations.bulk_update(
            db=db,
            model=Shift,
            updates=updates,
            batch_size=batch_size,
            commit=True
        )


__all__ = [
    'BatchOperations',
    'BatchShiftOperations',
    'DEFAULT_BATCH_SIZE',
    'MAX_BATCH_SIZE'
]
