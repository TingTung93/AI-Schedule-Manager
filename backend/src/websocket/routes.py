"""
WebSocket Routes for AI Schedule Manager
FastAPI WebSocket endpoints and routing
"""

import json
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, Depends
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .manager import manager, authenticate_websocket
from .events import EventHandler
from ..database.database import get_async_session

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT authentication token"),
    db: AsyncSession = Depends(get_async_session),
):
    """Main WebSocket endpoint for real-time communication"""
    connection_id = str(uuid.uuid4())
    user = None

    try:
        # Authenticate user
        user = await authenticate_websocket(websocket, token)
        if not user:
            return

        # Connect user
        connected = await manager.connect(websocket, user.id, connection_id)
        if not connected:
            await websocket.close(code=4002, reason="Connection failed")
            return

        logger.info(f"WebSocket connected: User {user.id}, Connection {connection_id}")

        # Send welcome message
        await manager.send_message(
            connection_id,
            {"type": "connected", "connection_id": connection_id, "user_id": user.id, "message": "Connected successfully"},
        )

        # Message handling loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)

                # Extract event type and data
                event_type = message.get("type")
                event_data = message.get("data", {})

                if not event_type:
                    await manager.send_message(connection_id, {"type": "error", "message": "Event type required"})
                    continue

                # Handle the event
                await EventHandler.handle_event(connection_id, event_type, event_data)

            except json.JSONDecodeError:
                await manager.send_message(connection_id, {"type": "error", "message": "Invalid JSON format"})
            except Exception as e:
                logger.error(f"Error processing message from {connection_id}: {e}")
                await manager.send_message(connection_id, {"type": "error", "message": "Error processing message"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: Connection {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error for connection {connection_id}: {e}")
    finally:
        # Clean up connection
        await manager.disconnect(connection_id)


@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics"""
    try:
        stats = manager.get_connection_stats()
        return {"success": True, "data": stats}
    except Exception as e:
        logger.error(f"Error getting WebSocket stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stats")


@router.get("/ws/rooms/{room_name}/members")
async def get_room_members(room_name: str):
    """Get members in a specific room"""
    try:
        members = manager.get_room_members(room_name)
        return {"success": True, "room": room_name, "members": members, "count": len(members)}
    except Exception as e:
        logger.error(f"Error getting room members for {room_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get room members")


@router.get("/ws/online-users")
async def get_online_users():
    """Get list of online users"""
    try:
        online_users = manager.get_online_users()
        return {"success": True, "online_users": online_users, "count": len(online_users)}
    except Exception as e:
        logger.error(f"Error getting online users: {e}")
        raise HTTPException(status_code=500, detail="Failed to get online users")


@router.post("/ws/broadcast/{room_name}")
async def broadcast_to_room(room_name: str, message: dict, exclude_connections: Optional[list] = None):
    """Broadcast message to specific room (admin endpoint)"""
    try:
        exclude_set = set(exclude_connections) if exclude_connections else None
        await manager.broadcast_to_room(room_name, message, exclude=exclude_set)

        return {"success": True, "message": "Broadcast sent successfully", "room": room_name}
    except Exception as e:
        logger.error(f"Error broadcasting to room {room_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to broadcast message")


@router.post("/ws/send-to-user/{user_id}")
async def send_to_user(user_id: int, message: dict):
    """Send message to specific user (admin endpoint)"""
    try:
        await manager.send_personal_message(message, user_id)

        return {"success": True, "message": "Message sent successfully", "user_id": user_id}
    except Exception as e:
        logger.error(f"Error sending message to user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.delete("/ws/connections/{connection_id}")
async def disconnect_connection(connection_id: str):
    """Forcefully disconnect a specific connection (admin endpoint)"""
    try:
        if connection_id in manager.active_connections:
            await manager.disconnect(connection_id)
            return {"success": True, "message": "Connection disconnected successfully"}
        else:
            raise HTTPException(status_code=404, detail="Connection not found")
    except Exception as e:
        logger.error(f"Error disconnecting connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect connection")


# Health check endpoint
@router.get("/ws/health")
async def websocket_health():
    """Health check for WebSocket service"""
    try:
        stats = manager.get_connection_stats()
        return {
            "status": "healthy",
            "timestamp": "2025-09-16T01:01:14.989Z",
            "connections": stats["total_connections"],
            "rooms": len(stats["rooms"]),
        }
    except Exception as e:
        logger.error(f"WebSocket health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}
