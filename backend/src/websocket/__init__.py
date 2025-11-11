"""
WebSocket module for AI Schedule Manager
"""

from .manager import manager, ConnectionManager, authenticate_websocket, heartbeat_task
from .events import (
    EventHandler,
    ScheduleEvents,
    EmployeeEvents,
    NotificationEvents,
    RuleEvents,
    ShiftEvents,
    ConflictEvents,
    PresenceEvents,
    EventType,
    format_event_message,
    format_error_message,
)
from .routes import router as websocket_router

__all__ = [
    "manager",
    "ConnectionManager",
    "authenticate_websocket",
    "heartbeat_task",
    "EventHandler",
    "ScheduleEvents",
    "EmployeeEvents",
    "NotificationEvents",
    "RuleEvents",
    "ShiftEvents",
    "ConflictEvents",
    "PresenceEvents",
    "EventType",
    "format_event_message",
    "format_error_message",
    "websocket_router",
]
