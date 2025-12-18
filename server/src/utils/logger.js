import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

// Custom format for detailed error logging
const errorFormat = winston.format(info => {
  if (info.error instanceof Error) {
    info.error = {
      message: info.error.message,
      stack: info.error.stack,
      name: info.error.name,
      code: info.error.code,
    };
  }
  return info;
});

const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    errorFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  text: winston.format.combine(
    winston.format.timestamp(),
    errorFormat(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
    })
  ),
};

export const logger = winston.createLogger({
  level: logLevel,
  format: formats[logFormat] || formats.json,
  defaultMeta: { service: 'defi-aggregator' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// ============================================
// Request Logging Utilities
// ============================================

/**
 * Generate a unique request ID
 * @returns {string} Unique request ID
 */
export function generateRequestId() {
  return uuidv4().substring(0, 8);
}

/**
 * Create a request-scoped logger with correlation ID
 * @param {string} requestId - Unique request identifier
 * @returns {Object} Request-scoped logger
 */
export function createRequestLogger(requestId) {
  const childLogger = logger.child({ requestId });

  return {
    info: (message, metadata = {}) =>
      childLogger.info(message, { ...metadata, requestId }),
    warn: (message, metadata = {}) =>
      childLogger.warn(message, { ...metadata, requestId }),
    error: (message, metadata = {}) =>
      childLogger.error(message, { ...metadata, requestId }),
    debug: (message, metadata = {}) =>
      childLogger.debug(message, { ...metadata, requestId }),

    // Specialized logging methods
    requestStart: (method, path, query = {}) => {
      childLogger.info('Request started', {
        requestId,
        method,
        path,
        query: Object.keys(query).length > 0 ? query : undefined,
        timestamp: Date.now(),
      });
    },

    requestEnd: (statusCode, duration, responseSize = 0) => {
      const level =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      childLogger[level]('Request completed', {
        requestId,
        statusCode,
        duration,
        responseSize,
        timestamp: Date.now(),
      });
    },

    serviceCall: (serviceName, method, duration, success) => {
      const level = success ? 'debug' : 'warn';
      childLogger[level]('Service call', {
        requestId,
        serviceName,
        method,
        duration,
        success,
        timestamp: Date.now(),
      });
    },
  };
}

// ============================================
// Error Logging Utilities
// ============================================

/**
 * Log error with full context and stack trace
 * @param {Error} error - Error to log
 * @param {Object} context - Additional context
 */
export function logError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    name: error.name || 'Error',
    code: error.code,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
    stack: error.stack,
    ...context,
  };

  // Determine severity based on error type
  const severity = getSeverityFromError(error);

  if (severity === 'error') {
    logger.error('Error occurred', errorInfo);
  } else if (severity === 'warn') {
    logger.warn('Warning', errorInfo);
  } else {
    logger.info('Notice', errorInfo);
  }
}

/**
 * Determine log severity from error type
 * @param {Error} error - Error to analyze
 * @returns {string} Severity level
 */
function getSeverityFromError(error) {
  // Client errors (4xx) are warnings, not errors
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return 'warn';
  }

  // Rate limit errors are warnings
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return 'warn';
  }

  // Validation errors are warnings
  if (error.code === 'VALIDATION_ERROR' || error.name === 'ValidationError') {
    return 'warn';
  }

  // Everything else is an error
  return 'error';
}

/**
 * Log structured message with metadata
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export function logStructured(level, message, metadata = {}) {
  logger[level]({
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

// ============================================
// Performance Logging Utilities
// ============================================

/**
 * Create a timer for measuring operation duration
 * @param {string} operation - Operation name
 * @param {Object} context - Additional context
 * @returns {Object} Timer object with end() method
 */
export function createTimer(operation, context = {}) {
  const startTime = Date.now();
  const startHrTime = process.hrtime.bigint();

  return {
    operation,
    startTime,

    /**
     * End the timer and log the result
     * @param {boolean} success - Whether operation succeeded
     * @param {Object} additionalContext - Additional context to log
     * @returns {number} Duration in milliseconds
     */
    end: (success = true, additionalContext = {}) => {
      const endHrTime = process.hrtime.bigint();
      const durationNs = Number(endHrTime - startHrTime);
      const durationMs = durationNs / 1_000_000;

      const logData = {
        operation,
        duration: Math.round(durationMs * 100) / 100, // Round to 2 decimal places
        durationUnit: 'ms',
        success,
        ...context,
        ...additionalContext,
      };

      if (success) {
        logger.debug('Operation completed', logData);
      } else {
        logger.warn('Operation failed', logData);
      }

      return durationMs;
    },

    /**
     * Get elapsed time without ending the timer
     * @returns {number} Elapsed time in milliseconds
     */
    elapsed: () => {
      const endHrTime = process.hrtime.bigint();
      const durationNs = Number(endHrTime - startHrTime);
      return durationNs / 1_000_000;
    },
  };
}

/**
 * Log a slow operation warning
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {number} threshold - Threshold in milliseconds
 * @param {Object} context - Additional context
 */
export function logSlowOperation(operation, duration, threshold, context = {}) {
  if (duration > threshold) {
    logger.warn('Slow operation detected', {
      operation,
      duration,
      threshold,
      exceedBy: Math.round((duration - threshold) * 100) / 100,
      ...context,
    });
  }
}

// ============================================
// Rate Limit Logging
// ============================================

/**
 * Log rate limit status
 * @param {string} key - Rate limit key
 * @param {Object} status - Rate limit status
 * @param {Object} context - Additional context
 */
export function logRateLimitStatus(key, status, context = {}) {
  const { allowed, remaining, resetTime, reason } = status;

  if (!allowed) {
    logger.warn('Rate limit exceeded', {
      rateLimitKey: key,
      remaining,
      resetTime,
      reason,
      ...context,
    });
  } else if (remaining !== undefined && remaining < 10) {
    logger.debug('Rate limit approaching', {
      rateLimitKey: key,
      remaining,
      resetTime,
      ...context,
    });
  }
}

// ============================================
// Service-specific Logging
// ============================================

/**
 * Log external API call
 * @param {string} provider - API provider name
 * @param {string} endpoint - API endpoint
 * @param {number} duration - Call duration in milliseconds
 * @param {boolean} success - Whether call succeeded
 * @param {Object} context - Additional context
 */
export function logExternalAPICall(
  provider,
  endpoint,
  duration,
  success,
  context = {}
) {
  const logData = {
    type: 'external_api_call',
    provider,
    endpoint,
    duration,
    success,
    ...context,
  };

  if (success) {
    logger.info('External API call completed', logData);
  } else {
    logger.error('External API call failed', logData);
  }

  // Log slow API calls
  if (duration > 5000) {
    logSlowOperation(`${provider}:${endpoint}`, duration, 5000, context);
  }
}

/**
 * Log cache operation
 * @param {string} operation - Cache operation ('get', 'set', 'delete', 'clear')
 * @param {string} key - Cache key
 * @param {boolean} hit - Whether it was a cache hit (for 'get')
 * @param {Object} context - Additional context
 */
export function logCacheOperation(operation, key, hit = null, context = {}) {
  const logData = {
    type: 'cache_operation',
    operation,
    key,
    ...context,
  };

  if (operation === 'get') {
    logData.hit = hit;
  }

  logger.debug('Cache operation', logData);
}

// ============================================
// Audit Logging
// ============================================

/**
 * Log an audit event
 * @param {string} action - Action performed
 * @param {Object} details - Action details
 */
export function logAudit(action, details = {}) {
  logger.info('Audit', {
    type: 'audit',
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

// ============================================
// File Transport Configuration
// ============================================

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
    })
  );

  // Separate file for performance logs
  logger.add(
    new winston.transports.File({
      filename: 'logs/performance.log',
      level: 'debug',
      maxsize: 5242880,
      maxFiles: 3,
      tailable: true,
    })
  );
}

// ============================================
// Logger Statistics
// ============================================

// Track logging statistics
const logStats = {
  counts: {
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
  },
  lastError: null,
  startTime: Date.now(),
};

// Intercept log calls to track statistics
const originalLog = logger.log.bind(logger);
logger.log = function (level, ...args) {
  if (logStats.counts[level] !== undefined) {
    logStats.counts[level]++;
  }
  if (level === 'error') {
    logStats.lastError = new Date().toISOString();
  }
  return originalLog(level, ...args);
};

/**
 * Get logger statistics
 * @returns {Object} Logger statistics
 */
export function getLoggerStats() {
  return {
    ...logStats,
    uptime: Date.now() - logStats.startTime,
    logLevel,
    logFormat,
  };
}

/**
 * Reset logger statistics
 */
export function resetLoggerStats() {
  logStats.counts = { error: 0, warn: 0, info: 0, debug: 0 };
  logStats.lastError = null;
  logStats.startTime = Date.now();
}

export default logger;
