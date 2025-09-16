"""
WebSocket Events for AI Schedule Manager
Defines event types and handlers for real-time updates
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum

from .manager import manager

logger = logging.getLogger(__name__)

class EventType(str, Enum):
    """WebSocket event types"""
    # Connection events
    PING = "ping"
    PONG = "pong"
    JOIN_ROOM = "join_room"
    LEAVE_ROOM = "leave_room"

    # Schedule events
    SCHEDULE_CREATED = "schedule_created"
    SCHEDULE_UPDATED = "schedule_updated"
    SCHEDULE_DELETED = "schedule_deleted"
    SCHEDULE_PUBLISHED = "schedule_published"

    # Employee events
    EMPLOYEE_STATUS_CHANGED = "employee_status_changed"
    EMPLOYEE_AVAILABILITY_UPDATED = "employee_availability_updated"
    EMPLOYEE_SHIFT_ASSIGNED = "employee_shift_assigned"
    EMPLOYEE_SHIFT_UNASSIGNED = "employee_shift_unassigned"

    # Notification events
    NOTIFICATION_NEW = "notification_new"
    NOTIFICATION_READ = "notification_read"
    NOTIFICATION_DISMISSED = "notification_dismissed"

    # Rule events
    RULE_CREATED = "rule_created"
    RULE_UPDATED = "rule_updated"
    RULE_DELETED = "rule_deleted"
    RULE_ACTIVATED = "rule_activated"
    RULE_DEACTIVATED = "rule_deactivated"

    # Shift events
    SHIFT_CREATED = "shift_created"
    SHIFT_UPDATED = "shift_updated"
    SHIFT_DELETED = "shift_deleted"
    SHIFT_ASSIGNED = "shift_assigned"
    SHIFT_SWAPPED = "shift_swapped"
    SHIFT_TRADE_REQUESTED = "shift_trade_requested"

    # Conflict events
    CONFLICT_DETECTED = "conflict_detected"
    CONFLICT_RESOLVED = "conflict_resolved"
    CONFLICT_ESCALATED = "conflict_escalated"

    # Presence events
    USER_CONNECTED = "user_connected"
    USER_DISCONNECTED = "user_disconnected"
    USER_EDITING = "user_editing"
    USER_STOPPED_EDITING = "user_stopped_editing"
    USER_TYPING = "user_typing"
    USER_STOPPED_TYPING = "user_stopped_typing"

class EventHandler:
    """Handles WebSocket event processing and routing"""

    @staticmethod
    async def handle_event(connection_id: str, event_type: str, data: Dict[str, Any]):
        """Route events to appropriate handlers"""
        try:
            if event_type == EventType.PING:
                await EventHandler.handle_ping(connection_id)
            elif event_type == EventType.JOIN_ROOM:
                await EventHandler.handle_join_room(connection_id, data)
            elif event_type == EventType.LEAVE_ROOM:
                await EventHandler.handle_leave_room(connection_id, data)
            elif event_type.startswith("user_"):
                await EventHandler.handle_presence_event(connection_id, event_type, data)
            else:
                logger.warning(f"Unknown event type: {event_type}")

        except Exception as e:
            logger.error(f"Error handling event {event_type}: {e}")
            await manager.send_message(connection_id, {
                "type": "error",
                "message": f"Error processing event: {str(e)}",
                "event_type": event_type
            })

    @staticmethod
    async def handle_ping(connection_id: str):
        """Handle ping event"""
        await manager.handle_heartbeat(connection_id)

    @staticmethod
    async def handle_join_room(connection_id: str, data: Dict[str, Any]):
        """Handle room join request"""
        room = data.get("room")
        if not room:
            await manager.send_message(connection_id, {
                "type": "error",
                "message": "Room name required"
            })
            return

        success = await manager.join_room(connection_id, room)
        await manager.send_message(connection_id, {
            "type": "room_joined" if success else "room_join_failed",
            "room": room
        })

    @staticmethod
    async def handle_leave_room(connection_id: str, data: Dict[str, Any]):
        """Handle room leave request"""
        room = data.get("room")
        if not room:
            return

        await manager.leave_room(connection_id, room)
        await manager.send_message(connection_id, {
            "type": "room_left",
            "room": room
        })

    @staticmethod
    async def handle_presence_event(connection_id: str, event_type: str, data: Dict[str, Any]):
        """Handle presence-related events"""
        # Broadcast presence events to presence room
        await manager.broadcast_to_room("presence", {
            "type": event_type,
            "connection_id": connection_id,
            "timestamp": datetime.now().isoformat(),
            **data
        }, exclude={connection_id})

# Event emitters for different entities
class ScheduleEvents:
    """Schedule-related event emitters"""

    @staticmethod
    async def schedule_created(schedule_data: Dict[str, Any], created_by: int):
        """Emit schedule created event"""
        await manager.broadcast_to_room("schedules", {
            "type": EventType.SCHEDULE_CREATED,
            "data": schedule_data,
            "created_by": created_by,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def schedule_updated(schedule_id: int, changes: Dict[str, Any], updated_by: int):
        """Emit schedule updated event"""
        await manager.broadcast_to_room("schedules", {
            "type": EventType.SCHEDULE_UPDATED,
            "schedule_id": schedule_id,
            "changes": changes,
            "updated_by": updated_by,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def schedule_deleted(schedule_id: int, deleted_by: int):
        """Emit schedule deleted event"""
        await manager.broadcast_to_room("schedules", {
            "type": EventType.SCHEDULE_DELETED,
            "schedule_id": schedule_id,
            "deleted_by": deleted_by,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def schedule_published(schedule_id: int, published_by: int):
        """Emit schedule published event"""
        await manager.broadcast_to_room("schedules", {
            "type": EventType.SCHEDULE_PUBLISHED,
            "schedule_id": schedule_id,
            "published_by": published_by,
            "timestamp": datetime.now().isoformat()
        })

class EmployeeEvents:
    """Employee-related event emitters"""

    @staticmethod
    async def status_changed(employee_id: int, old_status: str, new_status: str):
        """Emit employee status change event"""
        await manager.broadcast_to_room("employees", {
            "type": EventType.EMPLOYEE_STATUS_CHANGED,
            "employee_id": employee_id,
            "old_status": old_status,
            "new_status": new_status,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def availability_updated(employee_id: int, availability_data: Dict[str, Any]):
        """Emit employee availability update event"""
        await manager.broadcast_to_room("employees", {
            "type": EventType.EMPLOYEE_AVAILABILITY_UPDATED,
            "employee_id": employee_id,
            "availability": availability_data,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def shift_assigned(employee_id: int, shift_id: int, assigned_by: int):
        """Emit shift assignment event"""
        # Broadcast to both employees and shifts rooms
        event_data = {
            "type": EventType.EMPLOYEE_SHIFT_ASSIGNED,
            "employee_id": employee_id,
            "shift_id": shift_id,
            "assigned_by": assigned_by,
            "timestamp": datetime.now().isoformat()
        }

        await manager.broadcast_to_room("employees", event_data)
        await manager.broadcast_to_room("shifts", event_data)

        # Send personal notification to the employee
        await manager.send_personal_message(
            {
                "type": EventType.NOTIFICATION_NEW,
                "message": f"You have been assigned to shift {shift_id}",
                "category": "shift_assignment",
                "shift_id": shift_id
            },
            employee_id
        )

class NotificationEvents:
    """Notification-related event emitters"""

    @staticmethod
    async def new_notification(user_id: int, notification_data: Dict[str, Any]):
        """Emit new notification event"""
        await manager.send_personal_message({
            "type": EventType.NOTIFICATION_NEW,
            "data": notification_data,
            "timestamp": datetime.now().isoformat()
        }, user_id)

        # Also broadcast to notifications room for admin dashboards
        await manager.broadcast_to_room("notifications", {
            "type": EventType.NOTIFICATION_NEW,
            "user_id": user_id,
            "data": notification_data,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def notification_read(user_id: int, notification_id: int):
        """Emit notification read event"""
        await manager.broadcast_to_room("notifications", {
            "type": EventType.NOTIFICATION_READ,
            "user_id": user_id,
            "notification_id": notification_id,
            "timestamp": datetime.now().isoformat()
        })

class RuleEvents:
    """Rule-related event emitters"""

    @staticmethod
    async def rule_created(rule_data: Dict[str, Any], created_by: int):
        """Emit rule created event"""
        await manager.broadcast_to_room("rules", {
            "type": EventType.RULE_CREATED,
            "data": rule_data,
            "created_by": created_by,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def rule_updated(rule_id: int, changes: Dict[str, Any], updated_by: int):
        """Emit rule updated event"""
        await manager.broadcast_to_room("rules", {
            "type": EventType.RULE_UPDATED,
            "rule_id": rule_id,
            "changes": changes,
            "updated_by": updated_by,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def rule_activated(rule_id: int, activated_by: int):
        """Emit rule activation event"""
        await manager.broadcast_to_room("rules", {
            "type": EventType.RULE_ACTIVATED,
            "rule_id": rule_id,
            "activated_by": activated_by,
            "timestamp": datetime.now().isoformat()
        })

class ShiftEvents:
    """Shift-related event emitters"""

    @staticmethod
    async def shift_created(shift_data: Dict[str, Any], created_by: int):
        """Emit shift created event"""
        await manager.broadcast_to_room("shifts", {
            "type": EventType.SHIFT_CREATED,
            "data": shift_data,
            "created_by": created_by,
            "timestamp": datetime.now().isoformat()
        })

    @staticmethod
    async def shift_trade_requested(shift_id: int, from_employee: int, to_employee: int):
        """Emit shift trade request event"""
        # Notify the target employee
        await manager.send_personal_message({
            "type": EventType.SHIFT_TRADE_REQUESTED,
            "shift_id": shift_id,
            "from_employee": from_employee,
            "timestamp": datetime.now().isoformat()
        }, to_employee)

        # Broadcast to shifts room for managers
        await manager.broadcast_to_room("shifts", {
            "type": EventType.SHIFT_TRADE_REQUESTED,
            "shift_id": shift_id,
            "from_employee": from_employee,
            "to_employee": to_employee,
            "timestamp": datetime.now().isoformat()
        })

class ConflictEvents:
    """Conflict-related event emitters"""

    @staticmethod
    async def conflict_detected(conflict_data: Dict[str, Any], severity: str = "medium"):
        """Emit conflict detected event"""
        await manager.broadcast_to_room("conflicts", {
            "type": EventType.CONFLICT_DETECTED,
            "data": conflict_data,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        })

        # Send urgent notifications for high severity conflicts
        if severity == "high":
            # Get all manager users and notify them
            await manager.broadcast_to_room("notifications", {
                "type": EventType.NOTIFICATION_NEW,
                "category": "urgent_conflict",
                "message": "High severity scheduling conflict detected",
                "data": conflict_data,
                "timestamp": datetime.now().isoformat()
            })

    @staticmethod
    async def conflict_resolved(conflict_id: int, resolution_data: Dict[str, Any], resolved_by: int):
        """Emit conflict resolved event"""
        await manager.broadcast_to_room("conflicts", {
            "type": EventType.CONFLICT_RESOLVED,
            "conflict_id": conflict_id,
            "resolution": resolution_data,
            "resolved_by": resolved_by,
            "timestamp": datetime.now().isoformat()
        })

class PresenceEvents:
    """Presence-related event emitters"""

    @staticmethod
    async def user_editing(connection_id: str, resource_type: str, resource_id: int):
        """Emit user editing event"""
        await manager.broadcast_to_room("presence", {
            "type": EventType.USER_EDITING,
            "connection_id": connection_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "timestamp": datetime.now().isoformat()
        }, exclude={connection_id})

    @staticmethod
    async def user_typing(connection_id: str, location: str):
        """Emit user typing event"""
        await manager.broadcast_to_room("presence", {
            "type": EventType.USER_TYPING,
            "connection_id": connection_id,
            "location": location,
            "timestamp": datetime.now().isoformat()
        }, exclude={connection_id})

# Message formatting utilities
def format_event_message(event_type: str, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
    """Format a standard event message"""
    return {
        "type": event_type,
        "data": data,
        "timestamp": datetime.now().isoformat(),
        **kwargs
    }

def format_error_message(error: str, code: Optional[str] = None) -> Dict[str, Any]:
    """Format an error message"""
    return {
        "type": "error",
        "error": error,
        "code": code,
        "timestamp": datetime.now().isoformat()
    }