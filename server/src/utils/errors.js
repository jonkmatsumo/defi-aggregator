export class ServerError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'ServerError';
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

export class ConfigurationError extends ServerError {
  constructor(message) {
    super(message, 500, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class LLMError extends ServerError {
  constructor(message, provider = 'unknown') {
    super(message, 502, 'LLM_ERROR');
    this.name = 'LLMError';
    this.provider = provider;
  }
}

export class ToolError extends ServerError {
  constructor(message, toolName = 'unknown') {
    super(message, 500, 'TOOL_ERROR');
    this.name = 'ToolError';
    this.toolName = toolName;
  }
}

export class WebSocketError extends ServerError {
  constructor(message, sessionId = 'unknown') {
    super(message, 500, 'WEBSOCKET_ERROR');
    this.name = 'WebSocketError';
    this.sessionId = sessionId;
  }
}

export class ConversationError extends ServerError {
  constructor(message, sessionId = 'unknown') {
    super(message, 500, 'CONVERSATION_ERROR');
    this.name = 'ConversationError';
    this.sessionId = sessionId;
  }
}

export function createErrorResponse(error, requestId = null) {
  return {
    type: 'ERROR',
    id: requestId,
    payload: {
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        statusCode: error.statusCode || 500,
        timestamp: error.timestamp || new Date().toISOString()
      }
    },
    timestamp: Date.now()
  };
}