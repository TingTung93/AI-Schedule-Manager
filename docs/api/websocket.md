# WebSocket API Documentation

The AI Schedule Manager provides real-time communication through WebSocket connections for live updates and notifications.

## Connection

### WebSocket Endpoint
```
ws://localhost:8000/ws
wss://api.ai-schedule-manager.com/ws  # Production
```

### Authentication
WebSocket connections require authentication via query parameters:
```
ws://localhost:8000/ws?token=<jwt_access_token>
```

## Connection Lifecycle

### 1. Connection Establishment
```javascript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

ws.onopen = function(event) {
    console.log('WebSocket connection established');
    // Send initial subscription requests
};
```

### 2. Message Format
All WebSocket messages follow this JSON structure:

```json
{
    "type": "message_type",
    "action": "action_name",
    "data": {
        // Message-specific data
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": 123
}
```

### 3. Connection Management
```javascript
ws.onclose = function(event) {
    if (event.wasClean) {
        console.log('Connection closed cleanly');
    } else {
        console.log('Connection lost. Attempting reconnection...');
        // Implement reconnection logic
    }
};

ws.onerror = function(error) {
    console.error('WebSocket error:', error);
};
```

## Message Types

### 1. Schedule Updates
Real-time schedule changes and notifications.

#### Schedule Created
```json
{
    "type": "schedule",
    "action": "created",
    "data": {
        "schedule_id": 123,
        "employee_id": 45,
        "shift_id": 12,
        "date": "2024-01-20",
        "status": "scheduled",
        "employee": {
            "id": 45,
            "name": "John Doe",
            "role": "server"
        },
        "shift": {
            "id": 12,
            "name": "Morning Shift",
            "start_time": "09:00:00",
            "end_time": "17:00:00"
        }
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": 1
}
```

#### Schedule Updated
```json
{
    "type": "schedule",
    "action": "updated",
    "data": {
        "schedule_id": 123,
        "changes": {
            "status": {
                "old": "scheduled",
                "new": "completed"
            },
            "notes": {
                "old": null,
                "new": "Overtime approved"
            }
        },
        "updated_by": {
            "id": 1,
            "name": "Manager Smith"
        }
    },
    "timestamp": "2024-01-15T18:00:00Z",
    "user_id": 1
}
```

#### Schedule Deleted
```json
{
    "type": "schedule",
    "action": "deleted",
    "data": {
        "schedule_id": 123,
        "employee_id": 45,
        "date": "2024-01-20",
        "reason": "Employee unavailable",
        "deleted_by": {
            "id": 1,
            "name": "Manager Smith"
        }
    },
    "timestamp": "2024-01-15T14:20:00Z",
    "user_id": 1
}
```

### 2. Notifications
Real-time notification delivery.

#### New Notification
```json
{
    "type": "notification",
    "action": "created",
    "data": {
        "notification_id": 456,
        "notification_type": "schedule",
        "title": "Schedule Updated",
        "message": "Your schedule for next week has been updated",
        "priority": "normal",
        "employee_id": 45,
        "metadata": {
            "schedule_id": 123,
            "changes": ["status", "notes"]
        }
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": 45
}
```

#### Notification Read
```json
{
    "type": "notification",
    "action": "read",
    "data": {
        "notification_id": 456,
        "read_by": 45,
        "read_at": "2024-01-15T10:35:00Z"
    },
    "timestamp": "2024-01-15T10:35:00Z",
    "user_id": 45
}
```

### 3. Employee Updates
Employee-related changes.

#### Employee Status Change
```json
{
    "type": "employee",
    "action": "status_changed",
    "data": {
        "employee_id": 45,
        "status": {
            "old": "offline",
            "new": "online"
        },
        "last_seen": "2024-01-15T10:30:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "user_id": 45
}
```

### 4. System Events
System-wide events and announcements.

#### Maintenance Mode
```json
{
    "type": "system",
    "action": "maintenance",
    "data": {
        "status": "starting",
        "estimated_duration": "30 minutes",
        "scheduled_start": "2024-01-15T02:00:00Z",
        "message": "Scheduled maintenance for system upgrades"
    },
    "timestamp": "2024-01-15T01:50:00Z",
    "user_id": null
}
```

#### Broadcast Message
```json
{
    "type": "system",
    "action": "broadcast",
    "data": {
        "title": "New Feature Available",
        "message": "AI Schedule Optimization is now live!",
        "priority": "high",
        "sender": {
            "id": 1,
            "name": "System Administrator"
        }
    },
    "timestamp": "2024-01-15T09:00:00Z",
    "user_id": null
}
```

## Client-to-Server Messages

### 1. Subscribe to Events
```json
{
    "type": "subscription",
    "action": "subscribe",
    "data": {
        "events": ["schedule", "notification"],
        "filters": {
            "employee_id": 45,
            "date_range": {
                "start": "2024-01-15",
                "end": "2024-01-22"
            }
        }
    }
}
```

### 2. Unsubscribe from Events
```json
{
    "type": "subscription",
    "action": "unsubscribe",
    "data": {
        "events": ["schedule"]
    }
}
```

### 3. Heartbeat/Ping
```json
{
    "type": "ping",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Handling

### Connection Errors
```json
{
    "type": "error",
    "action": "connection_error",
    "data": {
        "code": "INVALID_TOKEN",
        "message": "Authentication token is invalid or expired",
        "details": {
            "token_expired": true,
            "refresh_required": true
        }
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### Subscription Errors
```json
{
    "type": "error",
    "action": "subscription_error",
    "data": {
        "code": "PERMISSION_DENIED",
        "message": "Insufficient permissions to subscribe to this event type",
        "requested_events": ["employee"],
        "allowed_events": ["schedule", "notification"]
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## Presence System

### User Presence
Track online/offline status of users.

#### Presence Update
```json
{
    "type": "presence",
    "action": "status_update",
    "data": {
        "user_id": 45,
        "status": "online",
        "last_activity": "2024-01-15T10:30:00Z",
        "device_info": {
            "type": "web",
            "browser": "Chrome",
            "ip": "192.168.1.100"
        }
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Typing Indicators (for chat features)
```json
{
    "type": "presence",
    "action": "typing",
    "data": {
        "user_id": 45,
        "typing": true,
        "context": "shift_notes"
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

## Implementation Examples

### JavaScript Client
```javascript
class ScheduleWebSocket {
    constructor(token) {
        this.token = token;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    connect() {
        const wsUrl = `ws://localhost:8000/ws?token=${this.token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);
    }

    onOpen(event) {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;

        // Subscribe to relevant events
        this.subscribe(['schedule', 'notification']);
    }

    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    onClose(event) {
        console.log('WebSocket disconnected:', event.code, event.reason);

        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Reconnection attempt ${this.reconnectAttempts}`);
                this.connect();
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        }
    }

    onError(error) {
        console.error('WebSocket error:', error);
    }

    handleMessage(message) {
        switch (message.type) {
            case 'schedule':
                this.handleScheduleUpdate(message);
                break;
            case 'notification':
                this.handleNotification(message);
                break;
            case 'error':
                this.handleError(message);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    handleScheduleUpdate(message) {
        const { action, data } = message;

        switch (action) {
            case 'created':
                console.log('New schedule created:', data);
                // Update UI with new schedule
                break;
            case 'updated':
                console.log('Schedule updated:', data);
                // Update existing schedule in UI
                break;
            case 'deleted':
                console.log('Schedule deleted:', data);
                // Remove schedule from UI
                break;
        }
    }

    handleNotification(message) {
        const { action, data } = message;

        if (action === 'created') {
            // Show notification to user
            this.showNotification(data);
        }
    }

    handleError(message) {
        const { data } = message;
        console.error('WebSocket error:', data.message);

        if (data.code === 'INVALID_TOKEN') {
            // Redirect to login
            window.location.href = '/login';
        }
    }

    subscribe(events) {
        this.send({
            type: 'subscription',
            action: 'subscribe',
            data: { events }
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected');
        }
    }

    showNotification(notification) {
        // Implementation depends on your notification system
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico'
            });
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
        }
    }
}

// Usage
const token = localStorage.getItem('access_token');
const wsClient = new ScheduleWebSocket(token);
wsClient.connect();
```

### Python Client
```python
import asyncio
import websockets
import json
import logging

class ScheduleWebSocketClient:
    def __init__(self, token):
        self.token = token
        self.uri = f"ws://localhost:8000/ws?token={token}"
        self.websocket = None

    async def connect(self):
        try:
            self.websocket = await websockets.connect(self.uri)
            await self.subscribe(['schedule', 'notification'])

            async for message in self.websocket:
                await self.handle_message(json.loads(message))

        except websockets.exceptions.ConnectionClosed:
            logging.info("WebSocket connection closed")
        except Exception as e:
            logging.error(f"WebSocket error: {e}")

    async def handle_message(self, message):
        message_type = message.get('type')
        action = message.get('action')
        data = message.get('data')

        if message_type == 'schedule':
            await self.handle_schedule_update(action, data)
        elif message_type == 'notification':
            await self.handle_notification(action, data)
        elif message_type == 'error':
            await self.handle_error(data)

    async def handle_schedule_update(self, action, data):
        print(f"Schedule {action}: {data}")

    async def handle_notification(self, action, data):
        if action == 'created':
            print(f"New notification: {data['title']} - {data['message']}")

    async def handle_error(self, data):
        print(f"WebSocket error: {data['message']}")

    async def subscribe(self, events):
        if self.websocket:
            message = {
                'type': 'subscription',
                'action': 'subscribe',
                'data': {'events': events}
            }
            await self.websocket.send(json.dumps(message))

    async def disconnect(self):
        if self.websocket:
            await self.websocket.close()

# Usage
async def main():
    token = "your_jwt_token_here"
    client = ScheduleWebSocketClient(token)
    await client.connect()

asyncio.run(main())
```

## Rate Limiting

WebSocket connections are subject to rate limiting:

- **Connection Rate**: 5 connections per minute per IP
- **Message Rate**: 100 messages per minute per connection
- **Subscription Rate**: 10 subscriptions per minute per connection

## Security Considerations

1. **Token Validation**: Tokens are validated on each connection
2. **Permission Checking**: Users can only subscribe to events they have permission to view
3. **Message Filtering**: Server filters messages based on user permissions
4. **Connection Limits**: Maximum 3 concurrent connections per user
5. **Heartbeat Timeout**: Connections timeout after 5 minutes of inactivity

## Best Practices

1. **Reconnection Logic**: Implement exponential backoff for reconnections
2. **Message Queuing**: Queue messages when connection is lost
3. **Error Handling**: Gracefully handle connection errors and token expiration
4. **Resource Cleanup**: Properly close connections to prevent memory leaks
5. **Heartbeat**: Send periodic ping messages to keep connection alive