import { v4 as uuidv4 } from 'uuid';
import { logger, logError } from '../utils/logger.js';
import { WebSocketError, createErrorResponse, classifyError } from '../utils/errors.js';

export class WebSocketHandler {
  constructor(wss, conversationManager, config = {}) {
    this.wss = wss;
    this.conversationManager = conversationManager;
    this.config = {
      pingInterval: config.pingInterval || 30000,
      maxConnections: config.maxConnections || 100,
      messageQueueSize: config.messageQueueSize || 1000
    };
    
    this.connections = new Map(); // sessionId -> { ws, lastActivity }
    this.cleanupInterval = null;
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    // Periodic cleanup of inactive connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, this.config.pingInterval);
  }

  handleConnection(ws, _request) {
    const sessionId = uuidv4();
    
    // Check connection limit
    if (this.connections.size >= this.config.maxConnections) {
      logger.warn('Connection limit exceeded', { 
        currentConnections: this.connections.size,
        maxConnections: this.config.maxConnections 
      });
      ws.close(1013, 'Server overloaded');
      return;
    }

    this.connections.set(sessionId, {
      ws,
      lastActivity: Date.now()
    });

    logger.info('WebSocket connection established', { 
      sessionId,
      totalConnections: this.connections.size 
    });

    // Set up message handling
    ws.on('message', async (data) => {
      await this.handleMessage(sessionId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      const errorClassification = classifyError(error);
      logError(error, { 
        sessionId, 
        connectionCount: this.connections.size,
        classification: errorClassification
      });
      this.handleDisconnection(sessionId);
    });

    // Send welcome message
    this.sendMessage(sessionId, {
      type: 'CONNECTION_ESTABLISHED',
      payload: { sessionId },
      timestamp: Date.now()
    });
  }

  async handleMessage(sessionId, data) {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection) {
        throw new WebSocketError('Session not found', sessionId);
      }

      connection.lastActivity = Date.now();

      const message = JSON.parse(data.toString());
      
      logger.debug('Received message', { sessionId, messageType: message.type });

      switch (message.type) {
      case 'PING':
        this.sendMessage(sessionId, {
          type: 'PONG',
          id: message.id,
          timestamp: Date.now()
        });
        break;

      case 'CHAT_MESSAGE':
        // This will be implemented when ConversationManager is ready
        await this.handleChatMessage(sessionId, message);
        break;

      default:
        logger.warn('Unknown message type', { sessionId, messageType: message.type });
      }

    } catch (error) {
      // Comprehensive error logging with classification
      const errorClassification = classifyError(error);
      logError(error, { 
        sessionId, 
        messageType: 'unknown',
        classification: errorClassification,
        rawDataLength: data.length
      });
      
      let parsedMessage = null;
      try {
        parsedMessage = JSON.parse(data.toString());
      } catch {
        // Ignore parse errors for error handling
      }
      
      const messageId = parsedMessage?.id || null;
      this.sendMessage(sessionId, createErrorResponse(error, messageId));
    }
  }

  async handleChatMessage(sessionId, message) {
    logger.info('Chat message received', { sessionId, messageId: message.id });
    
    try {
      // Extract message content and history from payload
      const userMessage = message.payload?.message || '';
      const messageHistory = message.payload?.history || [];

      if (!userMessage || typeof userMessage !== 'string') {
        throw new WebSocketError('Invalid message content', sessionId);
      }

      // Process message through ConversationManager
      const response = await this.conversationManager.processMessage(
        sessionId,
        userMessage,
        messageHistory
      );

      // Send response back to client
      this.sendMessage(sessionId, {
        type: 'CHAT_RESPONSE',
        id: message.id,
        payload: {
          message: response,
          sessionId
        },
        timestamp: Date.now()
      });

    } catch (error) {
      const errorClassification = classifyError(error);
      logError(error, {
        sessionId,
        messageId: message.id,
        messageLength: message.payload?.message?.length || 0,
        classification: errorClassification
      });

      // Send error response
      this.sendMessage(sessionId, createErrorResponse(error, message.id));
    }
  }

  handleDisconnection(sessionId) {
    const connection = this.connections.get(sessionId);
    if (connection) {
      this.connections.delete(sessionId);
      logger.info('WebSocket connection closed', { 
        sessionId,
        totalConnections: this.connections.size 
      });
    }
  }

  sendMessage(sessionId, message) {
    const connection = this.connections.get(sessionId);
    if (connection && connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(message));
    }
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = this.config.pingInterval * 2; // 2x ping interval

    for (const [_sessionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > timeout) {
        logger.info('Cleaning up inactive connection', { sessionId: _sessionId });
        connection.ws.close(1000, 'Inactive connection');
        this.connections.delete(_sessionId);
      }
    }
  }

  getMetrics() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.config.maxConnections,
      connectionUtilization: (this.connections.size / this.config.maxConnections) * 100
    };
  }

  destroy() {
    // Clean up the interval when the handler is destroyed
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all connections
    for (const [, connection] of this.connections.entries()) {
      connection.ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();
  }
}