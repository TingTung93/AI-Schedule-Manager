"""
WebSocket Manager for AI Schedule Manager
Handles WebSocket connections, rooms, and real-time communication
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

import jwt
from fastapi import Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.auth_utils import decode_token, get_current_user
from ..database.database import get_async_session
from ..models.user import User

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections with rooms and authentication"""

    def __init__(self):
        # Active connections by connection ID
        self.active_connections: Dict[str, WebSocket] = {}

        # User to connection mapping
        self.user_connections: Dict[int, Set[str]] = {}

        # Rooms for different data types
        self.rooms: Dict[str, Set[str]] = {
            "schedules": set(),
            "employees": set(),
            "notifications": set(),
            "rules": set(),
            "shifts": set(),
            "conflicts": set(),
            "presence": set(),
        }

        # Connection metadata
        self.connection_meta: Dict[str, Dict[str, Any]] = {}

        # Heartbeat tracking
        self.last_heartbeat: Dict[str, float] = {}

        # Message queue for disconnected users
        self.message_queue: Dict[int, List[Dict]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, connection_id: str) -> bool:
        """Accept WebSocket connection and authenticate user"""
        try:
            await websocket.accept()

            # Store connection
            self.active_connections[connection_id] = websocket

            # Add to user connections
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)

            # Initialize metadata
            self.connection_meta[connection_id] = {
                "user_id": user_id,
                "connected_at": time.time(),
                "last_activity": time.time(),
                "rooms": set(),
                "status": "online",
            }

            # Initialize heartbeat
            self.last_heartbeat[connection_id] = time.time()

            # Join presence room by default
            await self.join_room(connection_id, "presence")

            # Send queued messages
            await self.send_queued_messages(user_id, connection_id)

            logger.info(f"User {user_id} connected with connection {connection_id}")

            # Notify presence update
            await self.broadcast_to_room(
                "presence",
                {"type": "user_connected", "user_id": user_id, "timestamp": datetime.now().isoformat()},
                exclude={connection_id},
            )

            return True

        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {e}")
            return False

    async def disconnect(self, connection_id: str):
        """Remove WebSocket connection"""
        if connection_id not in self.active_connections:
            return

        # Get user info before cleanup
        user_id = self.connection_meta.get(connection_id, {}).get("user_id")
        rooms = self.connection_meta.get(connection_id, {}).get("rooms", set())

        # Remove from all rooms
        for room in rooms:
            self.rooms.get(room, set()).discard(connection_id)

        # Remove from active connections
        del self.active_connections[connection_id]

        # Remove from user connections
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        # Cleanup metadata
        if connection_id in self.connection_meta:
            del self.connection_meta[connection_id]

        # Cleanup heartbeat
        if connection_id in self.last_heartbeat:
            del self.last_heartbeat[connection_id]

        logger.info(f"User {user_id} disconnected (connection {connection_id})")

        # Notify presence update if user is completely offline
        if user_id and user_id not in self.user_connections:
            await self.broadcast_to_room(
                "presence", {"type": "user_disconnected", "user_id": user_id, "timestamp": datetime.now().isoformat()}
            )

    async def join_room(self, connection_id: str, room: str) -> bool:
        """Add connection to a room"""
        if connection_id not in self.active_connections:
            return False

        if room not in self.rooms:
            self.rooms[room] = set()

        self.rooms[room].add(connection_id)
        self.connection_meta[connection_id]["rooms"].add(room)

        logger.debug(f"Connection {connection_id} joined room {room}")
        return True

    async def leave_room(self, connection_id: str, room: str) -> bool:
        """Remove connection from a room"""
        if room in self.rooms:
            self.rooms[room].discard(connection_id)

        if connection_id in self.connection_meta:
            self.connection_meta[connection_id]["rooms"].discard(room)

        logger.debug(f"Connection {connection_id} left room {room}")
        return True

    async def send_personal_message(self, message: Dict, user_id: int):
        """Send message to specific user's all connections"""
        if user_id not in self.user_connections:
            # Queue message for when user comes online
            if user_id not in self.message_queue:
                self.message_queue[user_id] = []
            self.message_queue[user_id].append({**message, "queued_at": datetime.now().isoformat()})
            return

        # Send to all user's connections
        for connection_id in self.user_connections[user_id].copy():
            await self.send_message(connection_id, message)

    async def send_message(self, connection_id: str, message: Dict):
        """Send message to specific connection"""
        if connection_id not in self.active_connections:
            return

        try:
            websocket = self.active_connections[connection_id]
            await websocket.send_text(json.dumps(message))

            # Update last activity
            if connection_id in self.connection_meta:
                self.connection_meta[connection_id]["last_activity"] = time.time()

        except Exception as e:
            logger.error(f"Error sending message to {connection_id}: {e}")
            await self.disconnect(connection_id)

    async def broadcast_to_room(self, room: str, message: Dict, exclude: Optional[Set[str]] = None):
        """Broadcast message to all connections in a room"""
        if room not in self.rooms:
            return

        exclude = exclude or set()
        connections = self.rooms[room] - exclude

        # Send to all connections in parallel
        tasks = []
        for connection_id in connections.copy():
            tasks.append(self.send_message(connection_id, message))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_to_all(self, message: Dict, exclude: Optional[Set[str]] = None):
        """Broadcast message to all active connections"""
        exclude = exclude or set()
        connections = set(self.active_connections.keys()) - exclude

        tasks = []
        for connection_id in connections:
            tasks.append(self.send_message(connection_id, message))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_queued_messages(self, user_id: int, connection_id: str):
        """Send queued messages to newly connected user"""
        if user_id not in self.message_queue:
            return

        messages = self.message_queue[user_id]
        for message in messages:
            await self.send_message(connection_id, {**message, "was_queued": True})

        # Clear queue
        del self.message_queue[user_id]

    async def handle_heartbeat(self, connection_id: str):
        """Handle heartbeat from client"""
        self.last_heartbeat[connection_id] = time.time()

        if connection_id in self.connection_meta:
            self.connection_meta[connection_id]["last_activity"] = time.time()

        # Send pong response
        await self.send_message(connection_id, {"type": "pong", "timestamp": datetime.now().isoformat()})

    async def cleanup_stale_connections(self):
        """Remove connections that haven't sent heartbeat recently"""
        current_time = time.time()
        stale_connections = []

        for connection_id, last_beat in self.last_heartbeat.items():
            if current_time - last_beat > 60:  # 60 seconds timeout
                stale_connections.append(connection_id)

        for connection_id in stale_connections:
            logger.warning(f"Removing stale connection: {connection_id}")
            await self.disconnect(connection_id)

    def get_room_members(self, room: str) -> List[Dict]:
        """Get list of members in a room"""
        if room not in self.rooms:
            return []

        members = []
        for connection_id in self.rooms[room]:
            if connection_id in self.connection_meta:
                meta = self.connection_meta[connection_id]
                members.append(
                    {
                        "connection_id": connection_id,
                        "user_id": meta["user_id"],
                        "connected_at": meta["connected_at"],
                        "last_activity": meta["last_activity"],
                        "status": meta["status"],
                    }
                )

        return members

    def get_online_users(self) -> List[int]:
        """Get list of online user IDs"""
        return list(self.user_connections.keys())

    def get_connection_stats(self) -> Dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self.active_connections),
            "unique_users": len(self.user_connections),
            "rooms": {room: len(connections) for room, connections in self.rooms.items()},
            "queued_messages": sum(len(msgs) for msgs in self.message_queue.values()),
        }


# Global connection manager instance
manager = ConnectionManager()


async def authenticate_websocket(websocket: WebSocket, token: str) -> Optional[User]:
    """Authenticate WebSocket connection using JWT token"""
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")

        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return None

        # You would typically fetch user from database here
        # For now, return a mock user object
        user = User(id=int(user_id), email=payload.get("email", ""), username=payload.get("username", ""))
        return user

    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return None


async def heartbeat_task():
    """Background task to cleanup stale connections"""
    while True:
        try:
            await manager.cleanup_stale_connections()
            await asyncio.sleep(30)  # Check every 30 seconds
        except Exception as e:
            logger.error(f"Heartbeat task error: {e}")
            await asyncio.sleep(10)
