"""
Tests for WebSocket Manager
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket

from backend.src.websocket.manager import ConnectionManager, manager, authenticate_websocket
from backend.src.websocket.events import EventHandler, ScheduleEvents, EmployeeEvents
from backend.src.models.user import User


class TestConnectionManager:
    """Test cases for ConnectionManager"""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager instance for testing"""
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket instance"""
        mock_ws = Mock(spec=WebSocket)
        mock_ws.accept = AsyncMock()
        mock_ws.send_text = AsyncMock()
        mock_ws.close = AsyncMock()
        return mock_ws

    @pytest.mark.asyncio
    async def test_connect_user(self, connection_manager, mock_websocket):
        """Test user connection"""
        user_id = 123
        connection_id = "test_conn_1"

        # Test connection
        result = await connection_manager.connect(mock_websocket, user_id, connection_id)

        assert result is True
        assert connection_id in connection_manager.active_connections
        assert user_id in connection_manager.user_connections
        assert connection_id in connection_manager.user_connections[user_id]
        assert connection_id in connection_manager.connection_meta
        assert connection_id in connection_manager.last_heartbeat

        # Verify WebSocket was accepted
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect_user(self, connection_manager, mock_websocket):
        """Test user disconnection"""
        user_id = 123
        connection_id = "test_conn_1"

        # Connect first
        await connection_manager.connect(mock_websocket, user_id, connection_id)

        # Then disconnect
        await connection_manager.disconnect(connection_id)

        assert connection_id not in connection_manager.active_connections
        assert user_id not in connection_manager.user_connections
        assert connection_id not in connection_manager.connection_meta
        assert connection_id not in connection_manager.last_heartbeat

    @pytest.mark.asyncio
    async def test_join_leave_room(self, connection_manager, mock_websocket):
        """Test room joining and leaving"""
        user_id = 123
        connection_id = "test_conn_1"
        room = "schedules"

        # Connect user first
        await connection_manager.connect(mock_websocket, user_id, connection_id)

        # Join room
        result = await connection_manager.join_room(connection_id, room)
        assert result is True
        assert connection_id in connection_manager.rooms[room]
        assert room in connection_manager.connection_meta[connection_id]["rooms"]

        # Leave room
        result = await connection_manager.leave_room(connection_id, room)
        assert result is True
        assert connection_id not in connection_manager.rooms[room]
        assert room not in connection_manager.connection_meta[connection_id]["rooms"]

    @pytest.mark.asyncio
    async def test_send_personal_message(self, connection_manager, mock_websocket):
        """Test sending personal messages"""
        user_id = 123
        connection_id = "test_conn_1"
        message = {"type": "test", "data": "hello"}

        # Connect user
        await connection_manager.connect(mock_websocket, user_id, connection_id)

        # Send message
        await connection_manager.send_personal_message(message, user_id)

        # Verify message was sent
        mock_websocket.send_text.assert_called_once()
        sent_data = mock_websocket.send_text.call_args[0][0]
        assert json.loads(sent_data) == message

    @pytest.mark.asyncio
    async def test_broadcast_to_room(self, connection_manager, mock_websocket):
        """Test broadcasting to room"""
        user_id = 123
        connection_id = "test_conn_1"
        room = "schedules"
        message = {"type": "broadcast", "data": "hello room"}

        # Connect user and join room
        await connection_manager.connect(mock_websocket, user_id, connection_id)
        await connection_manager.join_room(connection_id, room)

        # Broadcast to room
        await connection_manager.broadcast_to_room(room, message)

        # Verify message was sent
        mock_websocket.send_text.assert_called()
        sent_data = mock_websocket.send_text.call_args[0][0]
        assert json.loads(sent_data) == message

    @pytest.mark.asyncio
    async def test_heartbeat_handling(self, connection_manager, mock_websocket):
        """Test heartbeat mechanism"""
        user_id = 123
        connection_id = "test_conn_1"

        # Connect user
        await connection_manager.connect(mock_websocket, user_id, connection_id)

        # Handle heartbeat
        await connection_manager.handle_heartbeat(connection_id)

        # Verify pong was sent
        mock_websocket.send_text.assert_called()
        sent_data = mock_websocket.send_text.call_args[0][0]
        pong_message = json.loads(sent_data)
        assert pong_message["type"] == "pong"

    @pytest.mark.asyncio
    async def test_message_queueing(self, connection_manager):
        """Test message queueing for offline users"""
        user_id = 123
        message = {"type": "queued", "data": "offline message"}

        # Send message to offline user
        await connection_manager.send_personal_message(message, user_id)

        # Verify message was queued
        assert user_id in connection_manager.message_queue
        assert len(connection_manager.message_queue[user_id]) == 1

        queued_msg = connection_manager.message_queue[user_id][0]
        assert queued_msg["type"] == message["type"]
        assert queued_msg["data"] == message["data"]
        assert "queued_at" in queued_msg

    @pytest.mark.asyncio
    async def test_stale_connection_cleanup(self, connection_manager, mock_websocket):
        """Test cleanup of stale connections"""
        user_id = 123
        connection_id = "test_conn_1"

        # Connect user
        await connection_manager.connect(mock_websocket, user_id, connection_id)

        # Simulate stale connection by setting old heartbeat
        connection_manager.last_heartbeat[connection_id] = 0  # Very old timestamp

        # Run cleanup
        await connection_manager.cleanup_stale_connections()

        # Verify connection was removed
        assert connection_id not in connection_manager.active_connections

    def test_get_connection_stats(self, connection_manager):
        """Test connection statistics"""
        # Add some mock data
        connection_manager.active_connections["conn1"] = Mock()
        connection_manager.active_connections["conn2"] = Mock()
        connection_manager.user_connections[123] = {"conn1"}
        connection_manager.user_connections[456] = {"conn2"}
        connection_manager.rooms["schedules"] = {"conn1", "conn2"}
        connection_manager.message_queue[789] = [{"msg": "test"}]

        stats = connection_manager.get_connection_stats()

        assert stats["total_connections"] == 2
        assert stats["unique_users"] == 2
        assert stats["rooms"]["schedules"] == 2
        assert stats["queued_messages"] == 1


class TestEventHandler:
    """Test cases for EventHandler"""

    @pytest.fixture
    def mock_manager(self):
        """Mock the global manager"""
        with patch("backend.src.websocket.events.manager") as mock:
            mock.send_message = AsyncMock()
            mock.broadcast_to_room = AsyncMock()
            mock.handle_heartbeat = AsyncMock()
            mock.join_room = AsyncMock(return_value=True)
            mock.leave_room = AsyncMock(return_value=True)
            yield mock

    @pytest.mark.asyncio
    async def test_handle_ping(self, mock_manager):
        """Test ping event handling"""
        connection_id = "test_conn"

        await EventHandler.handle_ping(connection_id)

        mock_manager.handle_heartbeat.assert_called_once_with(connection_id)

    @pytest.mark.asyncio
    async def test_handle_join_room(self, mock_manager):
        """Test room join handling"""
        connection_id = "test_conn"
        data = {"room": "schedules"}

        await EventHandler.handle_join_room(connection_id, data)

        mock_manager.join_room.assert_called_once_with(connection_id, "schedules")
        mock_manager.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_join_room_missing_name(self, mock_manager):
        """Test room join with missing room name"""
        connection_id = "test_conn"
        data = {}

        await EventHandler.handle_join_room(connection_id, data)

        mock_manager.join_room.assert_not_called()
        mock_manager.send_message.assert_called_once()
        # Check that error message was sent
        call_args = mock_manager.send_message.call_args
        assert call_args[0][1]["type"] == "error"

    @pytest.mark.asyncio
    async def test_handle_event_routing(self, mock_manager):
        """Test event routing to correct handlers"""
        connection_id = "test_conn"

        # Test ping routing
        await EventHandler.handle_event(connection_id, "ping", {})
        mock_manager.handle_heartbeat.assert_called_once()

        # Test join_room routing
        await EventHandler.handle_event(connection_id, "join_room", {"room": "test"})
        mock_manager.join_room.assert_called_once()

        # Test unknown event
        await EventHandler.handle_event(connection_id, "unknown_event", {})
        # Should not raise exception


class TestScheduleEvents:
    """Test cases for Schedule Events"""

    @pytest.fixture
    def mock_manager(self):
        """Mock the global manager"""
        with patch("backend.src.websocket.events.manager") as mock:
            mock.broadcast_to_room = AsyncMock()
            yield mock

    @pytest.mark.asyncio
    async def test_schedule_created_event(self, mock_manager):
        """Test schedule created event"""
        schedule_data = {"id": 1, "name": "Test Schedule"}
        created_by = 123

        await ScheduleEvents.schedule_created(schedule_data, created_by)

        mock_manager.broadcast_to_room.assert_called_once()
        call_args = mock_manager.broadcast_to_room.call_args
        assert call_args[0][0] == "schedules"  # Room name

        event_data = call_args[0][1]
        assert event_data["type"] == "schedule_created"
        assert event_data["data"] == schedule_data
        assert event_data["created_by"] == created_by

    @pytest.mark.asyncio
    async def test_schedule_updated_event(self, mock_manager):
        """Test schedule updated event"""
        schedule_id = 1
        changes = {"name": "Updated Schedule"}
        updated_by = 123

        await ScheduleEvents.schedule_updated(schedule_id, changes, updated_by)

        mock_manager.broadcast_to_room.assert_called_once()
        call_args = mock_manager.broadcast_to_room.call_args

        event_data = call_args[0][1]
        assert event_data["type"] == "schedule_updated"
        assert event_data["schedule_id"] == schedule_id
        assert event_data["changes"] == changes
        assert event_data["updated_by"] == updated_by


class TestEmployeeEvents:
    """Test cases for Employee Events"""

    @pytest.fixture
    def mock_manager(self):
        """Mock the global manager"""
        with patch("backend.src.websocket.events.manager") as mock:
            mock.broadcast_to_room = AsyncMock()
            mock.send_personal_message = AsyncMock()
            yield mock

    @pytest.mark.asyncio
    async def test_employee_status_changed(self, mock_manager):
        """Test employee status change event"""
        employee_id = 456
        old_status = "available"
        new_status = "busy"

        await EmployeeEvents.status_changed(employee_id, old_status, new_status)

        mock_manager.broadcast_to_room.assert_called_once()
        call_args = mock_manager.broadcast_to_room.call_args

        assert call_args[0][0] == "employees"
        event_data = call_args[0][1]
        assert event_data["type"] == "employee_status_changed"
        assert event_data["employee_id"] == employee_id
        assert event_data["old_status"] == old_status
        assert event_data["new_status"] == new_status

    @pytest.mark.asyncio
    async def test_shift_assigned_event(self, mock_manager):
        """Test shift assignment event"""
        employee_id = 456
        shift_id = 789
        assigned_by = 123

        await EmployeeEvents.shift_assigned(employee_id, shift_id, assigned_by)

        # Should broadcast to both employees and shifts rooms
        assert mock_manager.broadcast_to_room.call_count == 2

        # Should send personal notification
        mock_manager.send_personal_message.assert_called_once()
        personal_msg_args = mock_manager.send_personal_message.call_args
        assert personal_msg_args[0][1] == employee_id  # User ID


@pytest.mark.asyncio
async def test_authenticate_websocket():
    """Test WebSocket authentication"""
    mock_websocket = Mock(spec=WebSocket)
    mock_websocket.close = AsyncMock()

    # Test with invalid token
    with patch("backend.src.websocket.manager.decode_token") as mock_decode:
        mock_decode.side_effect = Exception("Invalid token")

        result = await authenticate_websocket(mock_websocket, "invalid_token")

        assert result is None
        mock_websocket.close.assert_called_once()

    # Test with valid token
    mock_websocket.reset_mock()
    with patch("backend.src.websocket.manager.decode_token") as mock_decode:
        mock_decode.return_value = {"sub": "123", "email": "test@example.com", "username": "testuser"}

        result = await authenticate_websocket(mock_websocket, "valid_token")

        assert result is not None
        assert isinstance(result, User)
        assert result.id == 123
        mock_websocket.close.assert_not_called()


class TestIntegration:
    """Integration tests for WebSocket functionality"""

    @pytest.mark.asyncio
    async def test_complete_user_flow(self):
        """Test complete user flow from connection to disconnection"""
        connection_manager = ConnectionManager()
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.accept = AsyncMock()
        mock_websocket.send_text = AsyncMock()

        user_id = 123
        connection_id = "test_integration"

        # 1. Connect user
        await connection_manager.connect(mock_websocket, user_id, connection_id)
        assert connection_id in connection_manager.active_connections

        # 2. Join rooms
        await connection_manager.join_room(connection_id, "schedules")
        await connection_manager.join_room(connection_id, "employees")
        assert connection_id in connection_manager.rooms["schedules"]
        assert connection_id in connection_manager.rooms["employees"]

        # 3. Send messages
        test_message = {"type": "test", "data": "integration"}
        await connection_manager.send_personal_message(test_message, user_id)
        await connection_manager.broadcast_to_room("schedules", test_message)

        # 4. Handle heartbeat
        await connection_manager.handle_heartbeat(connection_id)

        # 5. Disconnect
        await connection_manager.disconnect(connection_id)
        assert connection_id not in connection_manager.active_connections
        assert connection_id not in connection_manager.rooms["schedules"]
        assert connection_id not in connection_manager.rooms["employees"]

    @pytest.mark.asyncio
    async def test_multiple_connections_same_user(self):
        """Test multiple connections from the same user"""
        connection_manager = ConnectionManager()
        mock_websocket1 = Mock(spec=WebSocket)
        mock_websocket2 = Mock(spec=WebSocket)
        mock_websocket1.accept = AsyncMock()
        mock_websocket2.accept = AsyncMock()
        mock_websocket1.send_text = AsyncMock()
        mock_websocket2.send_text = AsyncMock()

        user_id = 123
        conn_id1 = "conn1"
        conn_id2 = "conn2"

        # Connect same user twice
        await connection_manager.connect(mock_websocket1, user_id, conn_id1)
        await connection_manager.connect(mock_websocket2, user_id, conn_id2)

        # Both connections should be tracked
        assert len(connection_manager.user_connections[user_id]) == 2
        assert conn_id1 in connection_manager.user_connections[user_id]
        assert conn_id2 in connection_manager.user_connections[user_id]

        # Send personal message should reach both connections
        message = {"type": "test", "data": "multi-conn"}
        await connection_manager.send_personal_message(message, user_id)

        mock_websocket1.send_text.assert_called()
        mock_websocket2.send_text.assert_called()

        # Disconnect one connection
        await connection_manager.disconnect(conn_id1)
        assert len(connection_manager.user_connections[user_id]) == 1
        assert conn_id2 in connection_manager.user_connections[user_id]

        # Disconnect second connection
        await connection_manager.disconnect(conn_id2)
        assert user_id not in connection_manager.user_connections


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
