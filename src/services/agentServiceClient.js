/**
 * AgentServiceClient
 *
 * Real implementation of AgentService that communicates with the GenAI server
 * via WebSocket connection. Replaces mockAgentService with actual AI capabilities.
 */

import { AgentService } from "./mockAgentService";

/**
 * Generate a unique ID for messages
 */
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Connection states
 */
const ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

/**
 * AgentServiceClient
 *
 * WebSocket-based implementation of AgentService for real server communication.
 * Provides automatic reconnection, message correlation, and error handling.
 */
class AgentServiceClient extends AgentService {
  /**
   * Create a new AgentServiceClient
   * @param {string} serverUrl - WebSocket server URL (e.g., 'ws://localhost:3001')
   * @param {Object} options - Configuration options
   * @param {number} options.maxReconnectAttempts - Maximum reconnection attempts (default: 5)
   * @param {number} options.reconnectDelay - Initial reconnection delay in ms (default: 1000)
   * @param {number} options.maxReconnectDelay - Maximum reconnection delay in ms (default: 30000)
   * @param {number} options.messageTimeout - Message response timeout in ms (default: 30000)
   * @param {number} options.pingInterval - Ping interval in ms (default: 30000)
   */
  constructor(serverUrl, options = {}) {
    super();

    this.serverUrl = serverUrl;
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      reconnectDelay: options.reconnectDelay || 1000,
      maxReconnectDelay: options.maxReconnectDelay || 30000,
      messageTimeout: options.messageTimeout || 30000,
      pingInterval: options.pingInterval || 30000,
      ...options,
    };

    // Connection state
    this.websocket = null;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.pingInterval = null;

    // Message handling
    this.messageQueue = [];
    this.pendingRequests = new Map(); // messageId -> { resolve, reject, timeout }

    // Event handlers
    this.messageHandlers = [];
    this.connectionChangeHandlers = [];
    this.errorHandlers = [];

    // Conversation context for restoration
    this.conversationHistory = [];

    // Identifier for fallback logic
    this.isAgentServiceClient = true;
  }

  /**
   * Establish WebSocket connection to the server
   * @returns {Promise<void>}
   */
  async connect() {
    if (
      this.connectionState === ConnectionState.CONNECTING ||
      this.connectionState === ConnectionState.CONNECTED
    ) {
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      this.websocket = new WebSocket(this.serverUrl);

      this.websocket.onopen = () => {
        this.handleConnectionOpen();
      };

      this.websocket.onmessage = event => {
        this.handleMessage(event);
      };

      this.websocket.onclose = event => {
        this.handleConnectionClose(event);
      };

      this.websocket.onerror = error => {
        this.handleConnectionError(error);
      };

      // Wait for connection to be established
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        const checkConnection = () => {
          if (this.connectionState === ConnectionState.CONNECTED) {
            clearTimeout(timeout);
            resolve();
          } else if (this.connectionState === ConnectionState.ERROR) {
            clearTimeout(timeout);
            reject(new Error("Connection failed"));
          } else {
            setTimeout(checkConnection, 100);
          }
        };

        checkConnection();
      });
    } catch (error) {
      this.setConnectionState(ConnectionState.ERROR);
      throw new Error(`Failed to connect to server: ${error.message}`);
    }
  }

  /**
   * Handle WebSocket connection open
   */
  handleConnectionOpen() {
    this.setConnectionState(ConnectionState.CONNECTED);
    this.reconnectAttempts = 0;

    // Start ping interval
    this.startPingInterval();

    // Process queued messages
    this.processMessageQueue();
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "CONNECTION_ESTABLISHED":
          this.sessionId = message.payload.sessionId;
          break;

        case "CHAT_RESPONSE":
          this.handleChatResponse(message);
          break;

        case "STREAM_CHUNK":
          this.handleStreamChunk(message);
          break;

        case "STREAM_END":
          this.handleStreamEnd(message);
          break;

        case "ERROR":
          this.handleErrorResponse(message);
          break;

        case "PONG":
          // Ping response received, connection is healthy
          break;

        default:
          console.warn("Unknown message type:", message.type);
      }

      // Notify message handlers
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error("Error in message handler:", error);
        }
      });
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }

  /**
   * Handle chat response from server
   */
  handleChatResponse(message) {
    const pendingRequest = this.pendingRequests.get(message.id);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(message.id);

      // Add to conversation history for context restoration
      if (message.payload.message) {
        this.conversationHistory.push(message.payload.message);
      }

      pendingRequest.resolve(message.payload.message);
    }
  }

  /**
   * Handle streaming chunk from server
   */
  handleStreamChunk(message) {
    // For now, we'll handle streaming in a future iteration
    // This is a placeholder for streaming support
    console.log("Received stream chunk:", message);
  }

  /**
   * Handle stream end from server
   */
  handleStreamEnd(message) {
    // For now, we'll handle streaming in a future iteration
    // This is a placeholder for streaming support
    console.log("Stream ended:", message);
  }

  /**
   * Handle error response from server
   */
  handleErrorResponse(message) {
    const pendingRequest = this.pendingRequests.get(message.id);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(message.id);

      const error = new Error(message.payload.error?.message || "Server error");
      error.details = message.payload.error;
      pendingRequest.reject(error);
    }
  }

  /**
   * Handle WebSocket connection close
   */
  handleConnectionClose(event) {
    this.stopPingInterval();

    if (this.connectionState === ConnectionState.CONNECTED) {
      // Unexpected disconnection, attempt reconnection
      this.attemptReconnection();
    } else {
      this.setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Handle WebSocket connection error
   */
  handleConnectionError(error) {
    console.error("WebSocket error:", error);
    this.setConnectionState(ConnectionState.ERROR);

    // Notify error handlers
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error("Error in error handler:", handlerError);
      }
    });
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  attemptReconnection() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.setConnectionState(ConnectionState.ERROR);
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.options.maxReconnectDelay
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Reset websocket before reconnecting
        this.websocket = null;
        await this.connect();
        // Restore conversation context after reconnection
        await this.restoreContext();
      } catch (error) {
        console.error("Reconnection failed:", error);
        this.attemptReconnection();
      }
    }, delay);
  }

  /**
   * Restore conversation context after reconnection
   */
  async restoreContext() {
    // Context restoration will be implemented when the server supports it
    // For now, we just log that context should be restored
    if (this.conversationHistory.length > 0) {
      console.log(
        "Context restoration needed for",
        this.conversationHistory.length,
        "messages"
      );
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.connectionState === ConnectionState.CONNECTED) {
        this.sendPing();
      }
    }, this.options.pingInterval);
  }

  /**
   * Stop ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send ping message to server
   */
  sendPing() {
    const pingMessage = {
      type: "PING",
      id: generateId(),
      timestamp: Date.now(),
    };

    this.sendRawMessage(pingMessage);
  }

  /**
   * Send raw message to server
   */
  sendRawMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
    }
  }

  /**
   * Process queued messages after connection is established
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendRawMessage(message);
    }
  }

  /**
   * Set connection state and notify handlers
   */
  setConnectionState(newState) {
    const oldState = this.connectionState;
    this.connectionState = newState;

    if (oldState !== newState) {
      this.connectionChangeHandlers.forEach(handler => {
        try {
          handler(newState, oldState);
        } catch (error) {
          console.error("Error in connection change handler:", error);
        }
      });
    }
  }

  /**
   * Send a message to the agent and receive a response
   * @param {string} message - The user's message
   * @param {Array} history - Array of previous ChatMessage objects
   * @returns {Promise<Object>} Agent response with id, role, content, timestamp, and optional uiIntent
   */
  async sendMessage(message, history = []) {
    // Ensure connection is established
    if (this.connectionState !== ConnectionState.CONNECTED) {
      await this.connect();
    }

    // Add user message to conversation history
    const userMessage = {
      id: generateId(),
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(userMessage);

    // Create request message
    const requestId = generateId();
    const requestMessage = {
      type: "CHAT_MESSAGE",
      id: requestId,
      payload: {
        message: message,
        history: history,
        sessionId: this.sessionId,
      },
      timestamp: Date.now(),
    };

    // Send message and wait for response
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Message timeout"));
      }, this.options.messageTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send message
      this.sendRawMessage(requestMessage);
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Stop ping interval
    this.stopPingInterval();

    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close(1000, "Client disconnect");
      this.websocket = null;
    }

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error("Connection closed"));
    });
    this.pendingRequests.clear();

    // Clear state
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.sessionId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Register a message handler
   * @param {Function} handler - Function to call when messages are received
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Register a connection state change handler
   * @param {Function} handler - Function to call when connection state changes
   */
  onConnectionChange(handler) {
    this.connectionChangeHandlers.push(handler);
  }

  /**
   * Register an error handler
   * @param {Function} handler - Function to call when errors occur
   */
  onError(handler) {
    this.errorHandlers.push(handler);
  }

  /**
   * Get current connection state
   * @returns {string} Current connection state
   */
  getConnectionState() {
    return this.connectionState;
  }

  /**
   * Check if client is connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connectionState === ConnectionState.CONNECTED;
  }
}

// Export the client class and connection states
export { AgentServiceClient, ConnectionState };
export default AgentServiceClient;
