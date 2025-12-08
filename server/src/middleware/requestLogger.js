import { logger, generateRequestId, createRequestLogger, createTimer, logSlowOperation } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';

/**
 * Request logging middleware
 * 
 * Provides comprehensive request/response logging with:
 * - Unique request IDs for correlation
 * - Response timing measurement
 * - Metrics collection
 * - Slow request detection
 */
export function requestLoggerMiddleware(options = {}) {
  const {
    slowThreshold = 1000, // 1 second
    excludePaths = ['/health', '/metrics', '/favicon.ico'],
    logBody = false,
    logHeaders = false
  } = options;

  return (req, res, next) => {
    // Skip logging for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Generate unique request ID
    const requestId = generateRequestId();
    
    // Attach request ID to request object
    req.requestId = requestId;
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Create request-scoped logger
    req.log = createRequestLogger(requestId);
    
    // Start timing
    const timer = createTimer('http_request', {
      method: req.method,
      path: req.path,
      requestId
    });
    
    // Log request start
    req.log.requestStart(req.method, req.path, req.query);
    
    // Log request body if enabled
    if (logBody && req.body && Object.keys(req.body).length > 0) {
      req.log.debug('Request body', { body: sanitizeBody(req.body) });
    }
    
    // Log request headers if enabled
    if (logHeaders) {
      req.log.debug('Request headers', { 
        headers: sanitizeHeaders(req.headers) 
      });
    }

    // Capture response body size
    let responseSize = 0;
    const originalWrite = res.write;
    const originalEnd = res.end;
    
    res.write = function(chunk, ...args) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      }
      return originalWrite.apply(res, [chunk, ...args]);
    };
    
    res.end = function(chunk, ...args) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      }
      return originalEnd.apply(res, [chunk, ...args]);
    };

    // Log response when finished
    res.on('finish', () => {
      const duration = timer.end(res.statusCode < 400);
      
      // Log request completion
      req.log.requestEnd(res.statusCode, duration, responseSize);
      
      // Record metrics
      metricsCollector.recordRequest(req.method, req.path, res.statusCode, duration);
      
      // Log slow requests
      if (duration > slowThreshold) {
        logSlowOperation(`${req.method} ${req.path}`, duration, slowThreshold, {
          requestId,
          statusCode: res.statusCode,
          responseSize
        });
      }
    });

    // Handle errors
    res.on('error', (error) => {
      const duration = timer.end(false);
      
      req.log.error('Response error', {
        error: error.message,
        duration,
        statusCode: res.statusCode
      });
      
      metricsCollector.recordError(error.code || 'RESPONSE_ERROR', req.path, {
        requestId,
        message: error.message
      });
    });

    next();
  };
}

/**
 * Error logging middleware
 * 
 * Catches and logs errors with full context
 */
export function errorLoggerMiddleware(options = {}) {
  const { includeStackTrace = process.env.NODE_ENV !== 'production' } = options;

  return (error, req, res, next) => {
    const requestId = req.requestId || generateRequestId();
    const log = req.log || createRequestLogger(requestId);
    
    // Determine error severity
    const statusCode = error.statusCode || error.status || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    
    // Log error with context
    const errorInfo = {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode,
      errorCode: error.code,
      errorMessage: error.message
    };
    
    if (includeStackTrace && !isClientError) {
      errorInfo.stack = error.stack;
    }
    
    if (isClientError) {
      log.warn('Client error', errorInfo);
    } else {
      log.error('Server error', errorInfo);
    }
    
    // Record error metrics
    metricsCollector.recordError(
      error.code || (isClientError ? 'CLIENT_ERROR' : 'SERVER_ERROR'),
      req.path,
      { requestId, statusCode }
    );
    
    // Pass to next error handler
    next(error);
  };
}

/**
 * Service call logging wrapper
 * 
 * Wraps service calls with logging and metrics
 * @param {string} serviceName - Name of the service
 * @param {string} methodName - Name of the method
 * @param {Function} operation - Async operation to execute
 * @param {Object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
export async function logServiceCall(serviceName, methodName, operation, context = {}) {
  const timer = createTimer(`${serviceName}.${methodName}`, context);
  
  try {
    const result = await operation();
    const duration = timer.end(true);
    
    logger.debug('Service call completed', {
      serviceName,
      methodName,
      duration,
      success: true,
      ...context
    });
    
    return result;
    
  } catch (error) {
    const duration = timer.end(false);
    
    logger.error('Service call failed', {
      serviceName,
      methodName,
      duration,
      success: false,
      error: error.message,
      ...context
    });
    
    metricsCollector.recordError(
      error.code || 'SERVICE_ERROR',
      `${serviceName}.${methodName}`,
      context
    );
    
    throw error;
  }
}

/**
 * External API call logging wrapper
 * 
 * Wraps external API calls with logging and metrics
 * @param {string} provider - API provider name
 * @param {string} endpoint - API endpoint
 * @param {Function} operation - Async operation to execute
 * @param {Object} context - Additional context
 * @returns {Promise<any>} Operation result
 */
export async function logExternalCall(provider, endpoint, operation, context = {}) {
  const timer = createTimer(`external:${provider}:${endpoint}`, context);
  
  try {
    const result = await operation();
    const duration = timer.end(true);
    
    logger.info('External API call completed', {
      type: 'external_api',
      provider,
      endpoint,
      duration,
      success: true,
      ...context
    });
    
    metricsCollector.recordExternalAPICall(provider, duration, true);
    
    return result;
    
  } catch (error) {
    const duration = timer.end(false);
    
    logger.error('External API call failed', {
      type: 'external_api',
      provider,
      endpoint,
      duration,
      success: false,
      error: error.message,
      errorCode: error.code,
      ...context
    });
    
    metricsCollector.recordExternalAPICall(provider, duration, false);
    metricsCollector.recordError(
      error.code || 'EXTERNAL_API_ERROR',
      `${provider}:${endpoint}`,
      context
    );
    
    throw error;
  }
}

/**
 * Sanitize request body for logging
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
function sanitizeBody(body) {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey', 'mnemonic'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Sanitize headers for logging
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
function sanitizeHeaders(headers) {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  const sanitized = { ...headers };
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

export default requestLoggerMiddleware;

