import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  text: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
    })
  )
};

export const logger = winston.createLogger({
  level: logLevel,
  format: formats[logFormat] || formats.json,
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
});

// Enhanced logging methods for structured error logging
export function logError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    timestamp: error.timestamp || new Date().toISOString(),
    context
  };

  if (error.severity) {
    logger[error.severity](errorInfo);
  } else {
    logger.error(errorInfo);
  }
}

export function logStructured(level, message, metadata = {}) {
  logger[level]({
    message,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

export function createRequestLogger(requestId) {
  return {
    info: (message, metadata = {}) => logStructured('info', message, { requestId, ...metadata }),
    warn: (message, metadata = {}) => logStructured('warn', message, { requestId, ...metadata }),
    error: (message, metadata = {}) => logStructured('error', message, { requestId, ...metadata }),
    debug: (message, metadata = {}) => logStructured('debug', message, { requestId, ...metadata })
  };
}

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}