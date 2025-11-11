/**
 * WebSocket Client for AI Schedule Manager
 * Handles real-time communication with backend
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.connectionId = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.messageQueue = [];
    this.eventListeners = new Map();
    this.rooms = new Set();
    this.lastActivity = Date.now();

    // Configuration
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      heartbeatTimeout: 10000,  // 10 seconds
      reconnectOnClose: true,
      queueMessages: true,
      maxQueueSize: 100
    };

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Connect to WebSocket server
   * @param {string} token - JWT authentication token
   * @param {Object} options - Connection options
   */
  async connect(token, options = {}) {
    if (this.isConnected || this.isConnecting) {
      console.warn('WebSocket already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = options.host || window.location.host;
      const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

      console.log('Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = this.handleError;

      // Wait for connection or timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        const originalOnOpen = this.ws.onopen;
        this.ws.onopen = (event) => {
          clearTimeout(timeout);
          originalOnOpen(event);
          resolve();
        };

        const originalOnError = this.ws.onerror;
        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          originalOnError(event);
          reject(new Error('Connection failed'));
        };
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    console.log('Disconnecting WebSocket');

    this.config.reconnectOnClose = false;
    this.clearHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.connectionId = null;
    this.rooms.clear();
  }

  /**
   * Send message to server
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  send(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.lastActivity = Date.now();
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        this.queueMessage(message);
        return false;
      }
    } else {
      this.queueMessage(message);
      return false;
    }
  }

  /**
   * Queue message for sending when connected
   * @param {Object} message - Message to queue
   */
  queueMessage(message) {
    if (!this.config.queueMessages) return;

    if (this.messageQueue.length >= this.config.maxQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }

    this.messageQueue.push(message);
    console.log('Message queued:', message.type);
  }

  /**
   * Send queued messages
   */
  sendQueuedMessages() {
    if (this.messageQueue.length === 0) return;

    console.log(`Sending ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      this.send(message.type, message.data);
    });
  }

  /**
   * Join a room
   * @param {string} room - Room name
   */
  joinRoom(room) {
    if (this.rooms.has(room)) {
      console.warn(`Already in room: ${room}`);
      return;
    }

    this.send('join_room', { room });
    this.rooms.add(room);
  }

  /**
   * Leave a room
   * @param {string} room - Room name
   */
  leaveRoom(room) {
    if (!this.rooms.has(room)) {
      console.warn(`Not in room: ${room}`);
      return;
    }

    this.send('leave_room', { room });
    this.rooms.delete(room);
  }

  /**
   * Add event listener
   * @param {string} eventType - Event type to listen for
   * @param {Function} callback - Callback function
   */
  addEventListener(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} eventType - Event type
   * @param {Function} callback - Callback function
   */
  removeEventListener(eventType, callback) {
    if (this.eventListeners.has(eventType)) {
      this.eventListeners.get(eventType).delete(callback);
    }
  }

  /**
   * Emit event to listeners
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  emit(eventType, data) {
    if (this.eventListeners.has(eventType)) {
      this.eventListeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen(event) {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    this.startHeartbeat();
    this.emit('connected', event);
  }

  /**
   * Handle WebSocket message
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      const { type, data = {}, ...rest } = message;

      // Handle system messages
      switch (type) {
        case 'connected':
          this.connectionId = data.connection_id;
          this.sendQueuedMessages();
          break;

        case 'pong':
          this.handlePong();
          break;

        case 'room_joined':
          console.log(`Joined room: ${data.room}`);
          break;

        case 'room_left':
          console.log(`Left room: ${data.room}`);
          break;

        case 'error':
          console.error('WebSocket error:', data.message || data.error);
          this.emit('error', message);
          return;
      }

      // Emit event to listeners
      this.emit(type, { ...data, ...rest });
      this.emit('message', message);

      this.lastActivity = Date.now();

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    console.log('WebSocket disconnected:', event.code, event.reason);

    this.isConnected = false;
    this.isConnecting = false;
    this.clearHeartbeat();

    this.emit('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    // Attempt reconnection if enabled
    if (this.config.reconnectOnClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  handleError(error) {
    console.error('WebSocket error:', error);
    this.emit('error', error);
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (!this.isConnected && this.config.reconnectOnClose) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          this.connect(token).catch(error => {
            console.error('Reconnection failed:', error);
          });
        }
      }
    }, delay);
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.clearHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Clear heartbeat timers
   */
  clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Send heartbeat ping
   */
  sendHeartbeat() {
    if (!this.isConnected) return;

    this.send('ping');

    // Set timeout for pong response
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('Heartbeat timeout - connection may be stale');
      this.ws?.close(4000, 'Heartbeat timeout');
    }, this.config.heartbeatTimeout);
  }

  /**
   * Handle heartbeat pong response
   */
  handlePong() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      rooms: Array.from(this.rooms),
      lastActivity: this.lastActivity
    };
  }

  /**
   * Update presence information
   * @param {string} status - User status
   * @param {Object} data - Additional presence data
   */
  updatePresence(status, data = {}) {
    this.send('user_status_update', {
      status,
      ...data
    });
  }

  /**
   * Send typing indicator
   * @param {string} location - Where user is typing
   */
  sendTyping(location) {
    this.send('user_typing', { location });
  }

  /**
   * Stop typing indicator
   * @param {string} location - Where user stopped typing
   */
  stopTyping(location) {
    this.send('user_stopped_typing', { location });
  }

  /**
   * Send editing indicator
   * @param {string} resourceType - Type of resource being edited
   * @param {number} resourceId - ID of resource being edited
   */
  sendEditing(resourceType, resourceId) {
    this.send('user_editing', {
      resource_type: resourceType,
      resource_id: resourceId
    });
  }

  /**
   * Stop editing indicator
   * @param {string} resourceType - Type of resource
   * @param {number} resourceId - ID of resource
   */
  stopEditing(resourceType, resourceId) {
    this.send('user_stopped_editing', {
      resource_type: resourceType,
      resource_id: resourceId
    });
  }
}

// Create singleton instance
const websocketManager = new WebSocketManager();

// Auto-connect when token is available
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('auth_token');
  if (token) {
    websocketManager.connect(token).catch(console.error);
  }
}

// Export both the class (for testing) and the singleton instance (default)
export { WebSocketManager };
export default websocketManager;