/**
 * Fixed WebSocket Manager Tests
 * Comprehensive tests with proper mocking and async handling
 */

import { WebSocketManager } from '../../services/websocket';

describe('WebSocketManager - Fixed Tests', () => {
  let manager;
  let mockWebSocket;

  beforeEach(() => {
    // Mock window.location
    delete window.location;
    window.location = {
      protocol: 'http:',
      host: 'localhost:3000'
    };

    // Create properly configured mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      readyState: 1, // OPEN state
    };

    // Mock WebSocket constructor and constants
    global.WebSocket = jest.fn(() => mockWebSocket);
    global.WebSocket.CONNECTING = 0;
    global.WebSocket.OPEN = 1;
    global.WebSocket.CLOSING = 2;
    global.WebSocket.CLOSED = 3;

    // Create manager instance (no constructor params)
    manager = new WebSocketManager();
  });

  afterEach(() => {
    if (manager) {
      manager.disconnect();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Connection Management', () => {
    test('should construct correct WebSocket URL with token', async () => {
      const token = 'test-token-123';
      const connectPromise = manager.connect(token);

      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:3000/ws?token=test-token-123'
      );

      // Simulate successful connection
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;
    });

    test('should use wss:// for https pages', async () => {
      window.location.protocol = 'https:';

      const token = 'test-token';
      const connectPromise = manager.connect(token);

      expect(global.WebSocket).toHaveBeenCalledWith(
        'wss://localhost:3000/ws?token=test-token'
      );

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;
    });

    test('should handle connection open event', async () => {
      const connectPromise = manager.connect('token');

      // Simulate open event
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;

      expect(manager.isConnected).toBe(true);
    });

    test('should prevent multiple simultaneous connections', async () => {
      const connect1 = manager.connect('token1');
      const connect2 = manager.connect('token2');

      expect(global.WebSocket).toHaveBeenCalledTimes(1);

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connect1;
    });

    test('should disconnect gracefully', async () => {
      const connectPromise = manager.connect('token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;

      manager.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(manager.isConnected).toBe(false);
    });

    test('should handle disconnect when not connected', () => {
      // Should not throw error
      expect(() => manager.disconnect()).not.toThrow();
    });

    test('should timeout if connection takes too long', async () => {
      jest.useFakeTimers();

      const connectPromise = manager.connect('token');

      // Fast-forward past timeout (10 seconds)
      jest.advanceTimersByTime(10000);

      await expect(connectPromise).rejects.toThrow('Connection timeout');

      jest.useRealTimers();
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      const connectPromise = manager.connect('test-token');

      // Simulate successful connection
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;
    });

    test('should send message when connected', () => {
      manager.send('test', { data: 'hello' });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"data":{"data":"hello"}')
      );
    });

    test('should queue messages when not connected', async () => {
      manager.disconnect();

      manager.send('test', { data: 'queued' });

      // Message should be queued
      expect(manager.messageQueue).toHaveLength(1);
      expect(manager.messageQueue[0]).toHaveProperty('type', 'test');
    });

    test('should send queued messages after reconnection', async () => {
      manager.disconnect();

      manager.send('test1', 'queued1');
      manager.send('test2', 'queued2');

      // Reconnect
      mockWebSocket.send.mockClear();
      const connectPromise = manager.connect('token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;

      // Simulate 'connected' message from server to trigger sendQueuedMessages
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'connected', data: { connection_id: '123' } })
        });
      }

      // Check that queued messages were sent
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test1"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"test2"')
      );
    });

    test('should handle send errors gracefully', () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      expect(() => manager.send('test', {})).not.toThrow();
    });

    test('should respect max queue size', () => {
      manager.disconnect();

      // Try to queue more than maxQueueSize (100) messages
      for (let i = 0; i < 150; i++) {
        manager.send('test', { id: i });
      }

      expect(manager.messageQueue.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Message Reception', () => {
    beforeEach(async () => {
      const connectPromise = manager.connect('test-token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;
    });

    test('should receive and parse messages', () => {
      const testMessage = { type: 'notification', data: { message: 'test' } };
      const messageHandler = jest.fn();

      manager.addEventListener('notification', messageHandler);

      // Simulate incoming message
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify(testMessage)
        });
      }

      // Handler receives the data object, not the full message
      expect(messageHandler).toHaveBeenCalledWith({ message: 'test' });
    });

    test('should handle invalid JSON gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      // Send invalid JSON
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({ data: 'invalid json' });
      }

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    test('should route messages to specific handlers', () => {
      const scheduleHandler = jest.fn();
      const notificationHandler = jest.fn();

      manager.addEventListener('schedule.update', scheduleHandler);
      manager.addEventListener('notification', notificationHandler);

      // Send schedule update
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'schedule.update', data: {} })
        });
      }

      expect(scheduleHandler).toHaveBeenCalled();
      expect(notificationHandler).not.toHaveBeenCalled();

      // Send notification
      scheduleHandler.mockClear();
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'notification', data: {} })
        });
      }

      expect(notificationHandler).toHaveBeenCalled();
      expect(scheduleHandler).not.toHaveBeenCalled();
    });

    test('should handle message event for all messages', () => {
      const messageHandler = jest.fn();

      // Listen to 'message' event which fires for all messages
      manager.addEventListener('message', messageHandler);

      // Send various messages
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'test1', data: {} })
        });
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'test2', data: {} })
        });
      }

      expect(messageHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Heartbeat and Health', () => {
    beforeEach(async () => {
      jest.useFakeTimers();

      const connectPromise = manager.connect('test-token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should send periodic heartbeat', () => {
      // Fast-forward past heartbeat interval (30 seconds)
      jest.advanceTimersByTime(30000);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"ping"')
      );
    });

    test('should track last activity time', () => {
      const initialActivity = manager.lastActivity;

      // Send a message
      manager.send('test', {});

      expect(manager.lastActivity).toBeGreaterThanOrEqual(initialActivity);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors', async () => {
      const connectPromise = manager.connect('token');

      // Simulate connection error
      if (mockWebSocket.onerror) {
        mockWebSocket.onerror({ message: 'Connection failed' });
      }

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    test('should handle unexpected close', async () => {
      const connectPromise = manager.connect('token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;

      // Simulate unexpected close
      if (mockWebSocket.onclose) {
        mockWebSocket.onclose({ code: 1006, reason: 'Abnormal closure' });
      }

      expect(manager.isConnected).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    test('should register event listeners', () => {
      const handler = jest.fn();

      manager.addEventListener('test-event', handler);

      expect(manager.eventListeners.has('test-event')).toBe(true);
    });

    test('should remove event listeners', () => {
      const handler = jest.fn();

      manager.addEventListener('test-event', handler);
      manager.removeEventListener('test-event', handler);

      const listeners = manager.eventListeners.get('test-event');
      expect(listeners).toBeDefined();
      expect(listeners.has(handler)).toBe(false);
    });

    test('should call multiple listeners for same event', async () => {
      const connectPromise = manager.connect('token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      manager.addEventListener('test', handler1);
      manager.addEventListener('test', handler2);

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'test', data: {} })
        });
      }

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Room Management', () => {
    beforeEach(async () => {
      const connectPromise = manager.connect('test-token');

      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({});
      }

      await connectPromise;
    });

    test('should join room', () => {
      manager.joinRoom('schedule-123');

      expect(manager.rooms.has('schedule-123')).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"join_room"')
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('schedule-123')
      );
    });

    test('should leave room', () => {
      manager.joinRoom('schedule-123');
      manager.leaveRoom('schedule-123');

      expect(manager.rooms.has('schedule-123')).toBe(false);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"leave_room"')
      );
    });

    test('should handle leaving non-existent room', () => {
      expect(() => manager.leaveRoom('non-existent')).not.toThrow();
    });
  });
});
