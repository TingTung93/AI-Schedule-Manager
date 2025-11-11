"""
WebSocket module for AI Schedule Manager
"""

from .events import (
    ConflictEvents,
    EmployeeEvents,
    EventHandler,
    EventType,
    NotificationEvents,
    PresenceEvents,
    RuleEvents,
    ScheduleEvents,
    ShiftEvents,
    format_error_message,
    format_event_message,
)
from .manager import ConnectionManager, authenticate_websocket, heartbeat_task, manager
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
