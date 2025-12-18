export class ServerError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    context = {}
  ) {
    super(message);
    this.name = 'ServerError';
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.severity = this.getSeverity(statusCode);
  }

  getSeverity(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
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

export class ServiceError extends ServerError {
  constructor(message, serviceName = 'unknown') {
    super(message, 500, 'SERVICE_ERROR');
    this.name = 'ServiceError';
    this.serviceName = serviceName;
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
        timestamp: error.timestamp || new Date().toISOString(),
        severity: error.severity || 'error',
      },
    },
    timestamp: Date.now(),
  };
}

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new ServerError(
          'Circuit breaker is OPEN',
          503,
          'CIRCUIT_BREAKER_OPEN'
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }
}

export function classifyError(error) {
  // Classify errors by type and severity
  if (error instanceof ConfigurationError) {
    return { category: 'configuration', severity: 'error', recoverable: false };
  }

  if (error instanceof LLMError) {
    return { category: 'llm', severity: 'warn', recoverable: true };
  }

  if (error instanceof ToolError) {
    return { category: 'tool', severity: 'warn', recoverable: true };
  }

  if (error instanceof WebSocketError) {
    return { category: 'websocket', severity: 'info', recoverable: true };
  }

  if (error instanceof ConversationError) {
    return { category: 'conversation', severity: 'warn', recoverable: true };
  }

  if (error instanceof ServiceError) {
    return { category: 'service', severity: 'warn', recoverable: true };
  }

  // Network/timeout errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return { category: 'network', severity: 'warn', recoverable: true };
  }

  // Default classification
  return { category: 'unknown', severity: 'error', recoverable: false };
}
