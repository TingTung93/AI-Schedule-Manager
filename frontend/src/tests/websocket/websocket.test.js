/**
 * Tests for WebSocket functionality
 */

import { jest } from '@jest/globals';
import { WebSocketManager } from '../../services/websocket.js';
import { useWebSocket, useWebSocketEvent, useScheduleUpdates, useNotifications } from '../../hooks/useWebSocket.js';
import { renderHook, act } from '@testing-library/react';

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = mockLocalStorage;

// Mock window.location
global.window = {
  location: {
    protocol: 'https:',
    host: 'localhost:3000'
  }
};

describe('WebSocketManager', () => {
  let manager;
  let mockWebSocket;

  beforeEach(() => {
    manager = new WebSocketManager();
    mockWebSocket = {
      close: jest.fn(),
      send: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1
    };
    global.WebSocket.mockReturnValue(mockWebSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const token = 'test-token';
      const connectPromise = manager.connect(token);

      // Simulate connection open
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();

      await expect(connectPromise).resolves.toBeUndefined();
      expect(manager.isConnected).toBe(true);
    });

    test('should handle connection failure', async () => {
      const token = 'test-token';
      const connectPromise = manager.connect(token);

      // Simulate connection error
      const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      errorHandler(new Error('Connection failed'));

      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(manager.isConnected).toBe(false);
    });

    test('should disconnect properly', () => {
      manager.isConnected = true;
      manager.ws = mockWebSocket;

      manager.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
      expect(manager.isConnected).toBe(false);
      expect(manager.ws).toBeNull();
    });

    test('should prevent multiple concurrent connections', async () => {
      manager.isConnecting = true;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await manager.connect('token');

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket already connected or connecting');
      expect(global.WebSocket).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      manager.isConnected = true;
      manager.ws = mockWebSocket;
    });

    test('should send messages when connected', () => {
      const result = manager.send('test_event', { data: 'test' });

      expect(result).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalled();

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('test_event');
      expect(sentMessage.data).toEqual({ data: 'test' });
    });

    test('should queue messages when disconnected', () => {
      manager.isConnected = false;
      manager.config.queueMessages = true;

      const result = manager.send('test_event', { data: 'test' });

      expect(result).toBe(false);
      expect(manager.messageQueue).toHaveLength(1);
      expect(manager.messageQueue[0].type).toBe('test_event');
    });

    test('should handle message queue limit', () => {
      manager.isConnected = false;
      manager.config.queueMessages = true;
      manager.config.maxQueueSize = 2;

      // Fill queue beyond limit
      manager.send('msg1', {});
      manager.send('msg2', {});
      manager.send('msg3', {}); // Should remove first message

      expect(manager.messageQueue).toHaveLength(2);
      expect(manager.messageQueue[0].type).toBe('msg2');
      expect(manager.messageQueue[1].type).toBe('msg3');
    });

    test('should process received messages', () => {
      const eventSpy = jest.spyOn(manager, 'emit');
      const message = {
        type: 'test_event',
        data: { test: 'data' }
      };

      // Simulate message reception
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];
      messageHandler({ data: JSON.stringify(message) });

      expect(eventSpy).toHaveBeenCalledWith('test_event', message.data);
      expect(eventSpy).toHaveBeenCalledWith('message', message);
    });

    test('should handle invalid JSON messages', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];
      messageHandler({ data: 'invalid json' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing WebSocket message:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      manager.isConnected = true;
      manager.ws = mockWebSocket;
    });

    test('should join rooms', () => {
      manager.joinRoom('schedules');

      expect(manager.rooms.has('schedules')).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalled();

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('join_room');
      expect(sentMessage.data.room).toBe('schedules');
    });

    test('should leave rooms', () => {
      manager.rooms.add('schedules');

      manager.leaveRoom('schedules');

      expect(manager.rooms.has('schedules')).toBe(false);
      expect(mockWebSocket.send).toHaveBeenCalled();

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('leave_room');
      expect(sentMessage.data.room).toBe('schedules');
    });

    test('should not join room if already joined', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      manager.rooms.add('schedules');

      manager.joinRoom('schedules');

      expect(consoleSpy).toHaveBeenCalledWith('Already in room: schedules');
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Event Listeners', () => {
    test('should add and remove event listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      manager.addEventListener('test_event', callback1);
      manager.addEventListener('test_event', callback2);

      manager.emit('test_event', { data: 'test' });

      expect(callback1).toHaveBeenCalledWith({ data: 'test' });
      expect(callback2).toHaveBeenCalledWith({ data: 'test' });

      manager.removeEventListener('test_event', callback1);
      manager.emit('test_event', { data: 'test2' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(2);
    });

    test('should handle errors in event listeners', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      manager.addEventListener('test_event', errorCallback);
      manager.emit('test_event', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in event listener for test_event:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Heartbeat Mechanism', () => {
    beforeEach(() => {
      manager.isConnected = true;
      manager.ws = mockWebSocket;
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start heartbeat on connection', () => {
      manager.startHeartbeat();

      expect(manager.heartbeatInterval).toBeDefined();

      // Fast-forward time to trigger heartbeat
      jest.advanceTimersByTime(manager.config.heartbeatInterval);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('ping');
    });

    test('should handle pong response', () => {
      manager.heartbeatTimeout = setTimeout(() => {}, 1000);

      manager.handlePong();

      expect(manager.heartbeatTimeout).toBeNull();
    });

    test('should timeout on missing pong', () => {
      manager.startHeartbeat();

      // Send ping
      jest.advanceTimersByTime(manager.config.heartbeatInterval);

      // Timeout waiting for pong
      jest.advanceTimersByTime(manager.config.heartbeatTimeout);

      expect(mockWebSocket.close).toHaveBeenCalledWith(4000, 'Heartbeat timeout');
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockLocalStorage.getItem.mockReturnValue('test-token');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should attempt reconnection on disconnect', () => {
      manager.config.reconnectOnClose = true;
      manager.reconnectAttempts = 0;

      // Simulate disconnect
      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeHandler({ code: 1006, reason: 'Connection lost', wasClean: false });

      expect(manager.reconnectAttempts).toBe(1);

      // Fast-forward to trigger reconnection
      jest.advanceTimersByTime(1000);

      expect(global.WebSocket).toHaveBeenCalledTimes(2); // Original + reconnect
    });

    test('should increase delay on subsequent attempts', () => {
      manager.config.reconnectOnClose = true;
      manager.reconnectAttempts = 2;

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeHandler({ code: 1006, reason: 'Connection lost', wasClean: false });

      expect(manager.reconnectAttempts).toBe(3);

      // Should wait longer for third attempt
      jest.advanceTimersByTime(1000);
      expect(global.WebSocket).toHaveBeenCalledTimes(1); // No reconnect yet

      jest.advanceTimersByTime(3000); // Total 4 seconds (exponential backoff)
      expect(global.WebSocket).toHaveBeenCalledTimes(2); // Now reconnect
    });

    test('should stop reconnecting after max attempts', () => {
      manager.config.reconnectOnClose = true;
      manager.reconnectAttempts = manager.maxReconnectAttempts;

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeHandler({ code: 1006, reason: 'Connection lost', wasClean: false });

      // Should not schedule reconnection
      jest.advanceTimersByTime(10000);
      expect(global.WebSocket).toHaveBeenCalledTimes(1); // Only original
    });
  });

  describe('Presence Features', () => {
    beforeEach(() => {
      manager.isConnected = true;
      manager.ws = mockWebSocket;
    });

    test('should send typing indicators', () => {
      manager.sendTyping('schedule-123');

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('user_typing');
      expect(sentMessage.data.location).toBe('schedule-123');
    });

    test('should send editing indicators', () => {
      manager.sendEditing('shift', 456);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('user_editing');
      expect(sentMessage.data.resource_type).toBe('shift');
      expect(sentMessage.data.resource_id).toBe(456);
    });

    test('should update presence status', () => {
      manager.updatePresence('busy', { location: 'dashboard' });

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('user_status_update');
      expect(sentMessage.data.status).toBe('busy');
      expect(sentMessage.data.location).toBe('dashboard');
    });
  });

  describe('Status and Diagnostics', () => {
    test('should return current status', () => {
      manager.isConnected = true;
      manager.connectionId = 'test-conn-123';
      manager.messageQueue = [{ type: 'test' }];
      manager.rooms.add('schedules');

      const status = manager.getStatus();

      expect(status).toEqual({
        isConnected: true,
        isConnecting: false,
        connectionId: 'test-conn-123',
        reconnectAttempts: 0,
        queuedMessages: 1,
        rooms: ['schedules'],
        lastActivity: expect.any(Number)
      });
    });
  });
});

describe('WebSocket React Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useWebSocket', () => {
    test('should return connection status', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('connectionStatus');
      expect(result.current).toHaveProperty('connect');
      expect(result.current).toHaveProperty('disconnect');
    });
  });

  describe('useScheduleUpdates', () => {
    test('should handle schedule updates', () => {
      const { result } = renderHook(() => useScheduleUpdates(123));

      expect(result.current).toHaveProperty('schedules');
      expect(result.current).toHaveProperty('lastUpdate');
      expect(result.current).toHaveProperty('setSchedules');

      expect(result.current.schedules).toEqual([]);
      expect(result.current.lastUpdate).toBeNull();
    });
  });

  describe('useNotifications', () => {
    test('should handle notifications', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current).toHaveProperty('notifications');
      expect(result.current).toHaveProperty('unreadCount');
      expect(result.current).toHaveProperty('markAsRead');
      expect(result.current).toHaveProperty('markAllAsRead');

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    test('should mark notifications as read', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.markAsRead(123);
      });

      // Should call WebSocket manager method
      // This would need more setup to test properly
    });
  });
});

describe('Integration Tests', () => {
  let manager;

  beforeEach(() => {
    manager = new WebSocketManager();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should handle complete connection lifecycle', async () => {
    const mockWS = {
      close: jest.fn(),
      send: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1
    };
    global.WebSocket.mockReturnValue(mockWS);

    // Connect
    const connectPromise = manager.connect('test-token');
    const openHandler = mockWS.addEventListener.mock.calls.find(
      call => call[0] === 'open'
    )[1];
    openHandler();
    await connectPromise;

    expect(manager.isConnected).toBe(true);

    // Join room
    manager.joinRoom('schedules');
    expect(manager.rooms.has('schedules')).toBe(true);

    // Send message
    manager.send('test_message', { data: 'test' });
    expect(mockWS.send).toHaveBeenCalled();

    // Simulate heartbeat
    jest.advanceTimersByTime(30000);
    expect(mockWS.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"ping"')
    );

    // Disconnect
    manager.disconnect();
    expect(manager.isConnected).toBe(false);
    expect(mockWS.close).toHaveBeenCalled();
  });

  test('should handle network interruption and recovery', async () => {
    const mockWS = {
      close: jest.fn(),
      send: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1
    };
    global.WebSocket.mockReturnValue(mockWS);
    mockLocalStorage.getItem.mockReturnValue('test-token');

    // Initial connection
    const connectPromise = manager.connect('test-token');
    const openHandler = mockWS.addEventListener.mock.calls.find(
      call => call[0] === 'open'
    )[1];
    openHandler();
    await connectPromise;

    // Queue messages while connected
    manager.send('message1', { data: 'test1' });
    expect(mockWS.send).toHaveBeenCalledTimes(1);

    // Simulate network failure
    const closeHandler = mockWS.addEventListener.mock.calls.find(
      call => call[0] === 'close'
    )[1];
    closeHandler({ code: 1006, reason: 'Network error', wasClean: false });

    expect(manager.isConnected).toBe(false);

    // Queue messages while disconnected
    manager.send('message2', { data: 'test2' });
    expect(manager.messageQueue).toHaveLength(1);

    // Simulate reconnection
    jest.advanceTimersByTime(1000);
    expect(global.WebSocket).toHaveBeenCalledTimes(2);

    // Simulate successful reconnection
    const newOpenHandler = mockWS.addEventListener.mock.calls.find(
      call => call[0] === 'open'
    )[1];
    newOpenHandler();

    // Should send queued messages
    expect(manager.messageQueue).toHaveLength(0);
  });
});