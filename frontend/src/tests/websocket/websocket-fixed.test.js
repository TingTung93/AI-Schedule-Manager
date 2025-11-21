/**
 * Fixed WebSocket Manager Tests
 * Comprehensive tests with proper mocking and async handling
 */

import { WebSocketManager } from '../../services/websocket';

describe('WebSocketManager - Fixed Tests', () => {
  let manager;
  let mockWebSocket;
  let mockOnMessage;
  let mockOnError;
  let mockOnClose;

  beforeEach(() => {
    // Create properly configured mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: 1, // OPEN state
    };

    // Mock WebSocket constructor
    global.WebSocket = jest.fn(() => mockWebSocket);

    // Callback mocks
    mockOnMessage = jest.fn();
    mockOnError = jest.fn();
    mockOnClose = jest.fn();

    // Create manager instance
    manager = new WebSocketManager('ws://localhost:8000/ws', {
      onMessage: mockOnMessage,
      onError: mockOnError,
      onClose: mockOnClose,
      autoReconnect: false, // Disable auto-reconnect for tests
    });
  });

  afterEach(() => {
    if (manager) {
      manager.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should connect successfully', () => {
      manager.connect();

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8000/ws');
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
    });

    test('should handle connection open event', () => {
      manager.connect();

      // Simulate open event
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();

      expect(manager.isConnected()).toBe(true);
    });

    test('should disconnect gracefully', () => {
      manager.connect();
      manager.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should handle disconnect when not connected', () => {
      // Should not throw error
      expect(() => manager.disconnect()).not.toThrow();
    });

    test('should auto-reconnect on connection loss', (done) => {
      const autoReconnectManager = new WebSocketManager('ws://localhost:8000/ws', {
        autoReconnect: true,
        reconnectInterval: 100,
      });

      autoReconnectManager.connect();

      // Simulate close event
      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeHandler({ code: 1006, reason: 'Connection lost' });

      // Check reconnection attempt
      setTimeout(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2); // Initial + reconnect
        autoReconnectManager.disconnect();
        done();
      }, 150);
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      manager.connect();
      // Simulate connected state
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();
    });

    test('should send message when connected', () => {
      const message = { type: 'test', data: 'hello' };
      manager.send(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should queue messages when not connected', () => {
      manager.disconnect();

      const message = { type: 'test', data: 'queued' };
      manager.send(message);

      // Message should be queued, not sent immediately
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(JSON.stringify(message));

      // Reconnect and verify message is sent
      manager.connect();
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should handle send errors gracefully', () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      expect(() => manager.send({ type: 'test' })).not.toThrow();
    });
  });

  describe('Message Reception', () => {
    beforeEach(() => {
      manager.connect();
    });

    test('should receive and parse messages', () => {
      const testMessage = { type: 'notification', data: { text: 'Test' } };

      // Get message handler
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      // Simulate message
      messageHandler({ data: JSON.stringify(testMessage) });

      expect(mockOnMessage).toHaveBeenCalledWith(testMessage);
    });

    test('should handle invalid JSON gracefully', () => {
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      // Send invalid JSON
      messageHandler({ data: 'invalid json' });

      expect(mockOnError).toHaveBeenCalled();
    });

    test('should route messages to specific handlers', () => {
      const scheduleHandler = jest.fn();
      manager.on('schedule.update', scheduleHandler);

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({
        data: JSON.stringify({
          type: 'schedule.update',
          data: { id: 123, name: 'Updated' }
        })
      });

      expect(scheduleHandler).toHaveBeenCalledWith({ id: 123, name: 'Updated' });
    });
  });

  describe('Presence Features', () => {
    beforeEach(() => {
      manager.connect();
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();
    });

    test('should send typing indicators', () => {
      manager.sendTyping('schedule-123');

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.type).toBe('user_typing');
      expect(sentData.data.location).toBe('schedule-123');
    });

    test('should send editing indicators', () => {
      manager.sendEditing('shift', 456);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.type).toBe('user_editing');
      expect(sentData.data.resource_type).toBe('shift');
      expect(sentData.data.resource_id).toBe(456);
    });

    test('should update presence status', () => {
      manager.updatePresence('busy', { location: 'dashboard' });

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.type).toBe('user_status_update');
      expect(sentData.data.status).toBe('busy');
    });

    test('should handle presence updates from server', () => {
      const presenceHandler = jest.fn();
      manager.on('presence.update', presenceHandler);

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({
        data: JSON.stringify({
          type: 'presence.update',
          data: { user_id: 1, status: 'online' }
        })
      });

      expect(presenceHandler).toHaveBeenCalledWith({ user_id: 1, status: 'online' });
    });
  });

  describe('Heartbeat and Health', () => {
    test('should send periodic heartbeat', (done) => {
      const heartbeatManager = new WebSocketManager('ws://localhost:8000/ws', {
        heartbeatInterval: 100,
      });

      heartbeatManager.connect();
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();

      setTimeout(() => {
        // Should have sent at least one heartbeat
        const heartbeats = mockWebSocket.send.mock.calls.filter(call => {
          const data = JSON.parse(call[0]);
          return data.type === 'heartbeat';
        });

        expect(heartbeats.length).toBeGreaterThan(0);
        heartbeatManager.disconnect();
        done();
      }, 250);
    });

    test('should detect connection timeout', (done) => {
      const timeoutManager = new WebSocketManager('ws://localhost:8000/ws', {
        heartbeatInterval: 50,
        connectionTimeout: 150,
        onError: mockOnError,
      });

      timeoutManager.connect();
      const openHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )[1];
      openHandler();

      // Don't respond to heartbeats

      setTimeout(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'timeout' })
        );
        timeoutManager.disconnect();
        done();
      }, 200);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors', () => {
      manager.connect();

      const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )[1];

      errorHandler(new Event('error'));

      expect(mockOnError).toHaveBeenCalled();
    });

    test('should handle unexpected close', () => {
      manager.connect();

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )[1];

      closeHandler({ code: 1006, reason: 'Unexpected close' });

      expect(mockOnClose).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1006 })
      );
    });

    test('should emit error on failed send', () => {
      manager.connect();
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Network error');
      });

      manager.send({ type: 'test' });

      expect(mockOnError).toHaveBeenCalled();
    });
  });

  describe('Event Subscription', () => {
    test('should subscribe to events', () => {
      const handler = jest.fn();
      manager.on('test.event', handler);

      manager.connect();
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({
        data: JSON.stringify({
          type: 'test.event',
          data: { value: 123 }
        })
      });

      expect(handler).toHaveBeenCalledWith({ value: 123 });
    });

    test('should unsubscribe from events', () => {
      const handler = jest.fn();
      manager.on('test.event', handler);
      manager.off('test.event', handler);

      manager.connect();
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({
        data: JSON.stringify({
          type: 'test.event',
          data: { value: 123 }
        })
      });

      expect(handler).not.toHaveBeenCalled();
    });

    test('should support multiple handlers per event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      manager.on('test.event', handler1);
      manager.on('test.event', handler2);

      manager.connect();
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({
        data: JSON.stringify({
          type: 'test.event',
          data: { value: 123 }
        })
      });

      expect(handler1).toHaveBeenCalledWith({ value: 123 });
      expect(handler2).toHaveBeenCalledWith({ value: 123 });
    });
  });
});
