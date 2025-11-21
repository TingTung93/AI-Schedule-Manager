"""
Cursor-based pagination utilities for efficient large dataset queries
"""

from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeMeta

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic paginated response model

    Attributes:
        data: List of items in current page
        next_cursor: Cursor for next page (None if last page)
        has_more: Whether more items are available
        count: Number of items in current page
    """
    data: List[T]
    next_cursor: Optional[int] = None
    has_more: bool = False
    count: int = 0

    class Config:
        arbitrary_types_allowed = True


async def paginate_query(
    db: AsyncSession,
    model: DeclarativeMeta,
    cursor: Optional[int] = None,
    limit: int = 50,
    order_by = None
) -> PaginatedResponse:
    """
    Cursor-based pagination for efficient large result sets

    Args:
        db: Database session
        model: SQLAlchemy model class
        cursor: Cursor position (ID of last item from previous page)
        limit: Number of items per page (default: 50, max recommended: 100)
        order_by: Order by clause (defaults to model.id.asc())

    Returns:
        PaginatedResponse with data and pagination metadata

    Example:
        result = await paginate_query(
            db=db,
            model=Employee,
            cursor=request.cursor,
            limit=50,
            order_by=Employee.created_at.desc()
        )
    """
    # Build base query
    query = select(model)

    # Apply cursor filter
    if cursor:
        query = query.where(model.id > cursor)

    # Apply ordering
    if order_by is not None:
        query = query.order_by(order_by)
    else:
        query = query.order_by(model.id.asc())

    # Fetch limit + 1 to check if more items exist
    query = query.limit(limit + 1)

    # Execute query
    result = await db.execute(query)
    items = result.scalars().all()

    # Determine if more items exist
    has_more = len(items) > limit

    # Trim to requested limit
    if has_more:
        items = items[:limit]

    # Get next cursor
    next_cursor = items[-1].id if items and has_more else None

    return PaginatedResponse(
        data=items,
        next_cursor=next_cursor,
        has_more=has_more,
        count=len(items)
    )


async def paginate_with_filters(
    db: AsyncSession,
    base_query,
    cursor: Optional[int] = None,
    limit: int = 50,
    cursor_column = None
) -> PaginatedResponse:
    """
    Cursor-based pagination for pre-filtered queries

    Args:
        db: Database session
        base_query: Pre-built SQLAlchemy query with filters applied
        cursor: Cursor position
        limit: Items per page
        cursor_column: Column to use for cursor (defaults to id)

    Returns:
        PaginatedResponse with data and pagination metadata

    Example:
        query = select(Employee).where(Employee.department_id == dept_id)
        result = await paginate_with_filters(
            db=db,
            base_query=query,
            cursor=request.cursor,
            limit=25
        )
    """
    # Apply cursor filter if provided
    if cursor and cursor_column is not None:
        base_query = base_query.where(cursor_column > cursor)

    # Fetch limit + 1 to check if more items exist
    query = base_query.limit(limit + 1)

    # Execute query
    result = await db.execute(query)
    items = result.scalars().all()

    # Determine if more items exist
    has_more = len(items) > limit

    # Trim to requested limit
    if has_more:
        items = items[:limit]

    # Get next cursor from cursor column
    if items and has_more:
        if cursor_column is not None:
            next_cursor = getattr(items[-1], cursor_column.key)
        else:
            next_cursor = items[-1].id
    else:
        next_cursor = None

    return PaginatedResponse(
        data=items,
        next_cursor=next_cursor,
        has_more=has_more,
        count=len(items)
    )


class OffsetPagination(BaseModel):
    """
    Traditional offset-based pagination (less efficient for large datasets)

    Use cursor-based pagination for better performance on large tables.
    """
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        arbitrary_types_allowed = True


async def paginate_with_offset(
    db: AsyncSession,
    query,
    page: int = 1,
    page_size: int = 50
) -> OffsetPagination:
    """
    Offset-based pagination (less efficient than cursor-based)

    WARNING: Performance degrades with large offsets. Use cursor-based
    pagination (paginate_query) for tables with >10,000 rows.

    Args:
        db: Database session
        query: SQLAlchemy query
        page: Page number (1-indexed)
        page_size: Items per page

    Returns:
        OffsetPagination with items and metadata
    """
    # Count total items (expensive for large tables!)
    from sqlalchemy import func, select as sa_select
    count_query = sa_select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Calculate offset
    offset = (page - 1) * page_size

    # Fetch page items
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return OffsetPagination(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


__all__ = [
    'PaginatedResponse',
    'OffsetPagination',
    'paginate_query',
    'paginate_with_filters',
    'paginate_with_offset'
]
