"""
Notification API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from ..dependencies import get_database_session, get_current_user
from ..schemas import NotificationCreate, NotificationUpdate, NotificationResponse, PaginatedResponse, MessageResponse
from ..services.crud import crud_notification
from datetime import datetime

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("", response_model=PaginatedResponse)
async def get_notifications(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100)
):
    """Get all notifications for current user."""
    skip = (page - 1) * size

    result = await crud_notification.get_multi_with_filters(
        db=db,
        skip=skip,
        limit=size,
        user_id=current_user.get("id"),
        read=read
    )

    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size
    )

@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get specific notification."""
    notification = await crud_notification.get(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return notification

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Mark notification as read."""
    notification = await crud_notification.get(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    update_data = NotificationUpdate(read=True, read_at=datetime.utcnow())
    updated = await crud_notification.update(db, notification, update_data)
    return updated

@router.post("/mark-all-read", response_model=MessageResponse)
async def mark_all_notifications_as_read(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications as read for current user."""
    await crud_notification.mark_all_read(db, current_user.get("id"))
    return MessageResponse(message="All notifications marked as read")

@router.delete("/{notification_id}", response_model=MessageResponse)
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Delete notification."""
    notification = await crud_notification.remove(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return MessageResponse(message="Notification deleted successfully")
