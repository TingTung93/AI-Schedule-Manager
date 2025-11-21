/**
 * WebSocket Mock for Testing
 *
 * Provides a mock WebSocket implementation for testing without real connections.
 */

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;

    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 0);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    // Simulate message echo or response
    setTimeout(() => {
      if (this.onmessage) {
        try {
          const parsedData = JSON.parse(data);
          // Respond with pong for ping
          if (parsedData.type === 'ping') {
            this.onmessage({
              data: JSON.stringify({ type: 'pong', timestamp: Date.now() })
            });
          } else {
            // Echo back the message
            this.onmessage({ data });
          }
        } catch (e) {
          // If not JSON, just echo
          this.onmessage({ data });
        }
      }
    }, 0);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.CLOSED || this.readyState === MockWebSocket.CLOSING) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;

    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({
          type: 'close',
          code,
          reason,
          wasClean: code === 1000
        });
      }
    }, 0);
  }

  addEventListener(event, handler) {
    if (event === 'open') this.onopen = handler;
    if (event === 'close') this.onclose = handler;
    if (event === 'error') this.onerror = handler;
    if (event === 'message') this.onmessage = handler;
  }

  removeEventListener(event, handler) {
    if (event === 'open' && this.onopen === handler) this.onopen = null;
    if (event === 'close' && this.onclose === handler) this.onclose = null;
    if (event === 'error' && this.onerror === handler) this.onerror = null;
    if (event === 'message' && this.onmessage === handler) this.onmessage = null;
  }
}

// Set up global WebSocket mock
global.WebSocket = MockWebSocket;

export default MockWebSocket;
