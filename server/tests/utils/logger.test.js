import { jest } from '@jest/globals';

// Create a mock logger instance
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  child: jest.fn(function () { return mockLogger; }),
  add: jest.fn()
};

// Create a callable format function that also has methods
// winston.format is used as both a function and has static methods
const mockFormatInstance = { transform: jest.fn((info) => info) };

const createMockFormat = () => {
  // This is the base format function - when called with a function, it returns a format instance factory
  const format = jest.fn(() => {
    // Return a function that creates format instances
    return jest.fn(() => mockFormatInstance);
  });

  // Add static methods
  format.combine = jest.fn(() => mockFormatInstance);
  format.timestamp = jest.fn(() => mockFormatInstance);
  format.errors = jest.fn(() => mockFormatInstance);
  format.json = jest.fn(() => mockFormatInstance);
  format.printf = jest.fn(() => mockFormatInstance);

  return format;
};

const mockFormat = createMockFormat();

// Mock winston before importing logger
jest.unstable_mockModule('winston', () => ({
  default: {
    createLogger: jest.fn(() => mockLogger),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    }
  },
  createLogger: jest.fn(() => mockLogger),
  format: mockFormat,
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Now import the module under test
const loggerModule = await import('../../src/utils/logger.js');
const {
  logger,
  generateRequestId,
  createRequestLogger,
  logError,
  logStructured,
  createTimer,
  logSlowOperation,
  logRateLimitStatus,
  logExternalAPICall,
  logCacheOperation,
  logAudit,
  getLoggerStats,
  resetLoggerStats
} = loggerModule;

describe('Logger Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLoggerStats();
  });

  describe('generateRequestId', () => {
    it('should generate a unique request ID', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate 8 character IDs', () => {
      const id = generateRequestId();
      expect(id.length).toBe(8);
    });

    it('should generate alphanumeric IDs', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[a-f0-9-]+$/);
    });
  });

  describe('createRequestLogger', () => {
    it('should create a logger with all methods', () => {
      const requestLogger = createRequestLogger('test-id');

      expect(requestLogger.info).toBeDefined();
      expect(requestLogger.warn).toBeDefined();
      expect(requestLogger.error).toBeDefined();
      expect(requestLogger.debug).toBeDefined();
      expect(requestLogger.requestStart).toBeDefined();
      expect(requestLogger.requestEnd).toBeDefined();
      expect(requestLogger.serviceCall).toBeDefined();
    });

    it('should include requestId in log calls', () => {
      const requestId = 'test-123';
      const requestLogger = createRequestLogger(requestId);

      requestLogger.info('test message', { extra: 'data' });

      expect(logger.child).toHaveBeenCalledWith({ requestId });
    });
  });

  describe('logError', () => {
    it('should log error with full context', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      error.statusCode = 500;

      logError(error, { extra: 'context' });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log client errors as warnings', () => {
      const error = new Error('Not found');
      error.statusCode = 404;

      logError(error);

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log rate limit errors as warnings', () => {
      const error = new Error('Rate limit exceeded');
      error.code = 'RATE_LIMIT_EXCEEDED';

      logError(error);

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('logStructured', () => {
    it('should log with timestamp and metadata', () => {
      logStructured('info', 'Test message', { data: 'value' });

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test message',
        data: 'value'
      }));
    });

    it('should support different log levels', () => {
      logStructured('warn', 'Warning message');
      logStructured('error', 'Error message');
      logStructured('debug', 'Debug message');

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('createTimer', () => {
    it('should create a timer object', () => {
      const timer = createTimer('test-operation');

      expect(timer.operation).toBe('test-operation');
      expect(timer.startTime).toBeDefined();
      expect(timer.end).toBeDefined();
      expect(timer.elapsed).toBeDefined();
    });

    it('should measure elapsed time', async () => {
      const timer = createTimer('test-operation');

      await new Promise(resolve => setTimeout(resolve, 50));

      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThan(40);
    });

    it('should log on end', () => {
      const timer = createTimer('test-operation');
      const duration = timer.end(true);

      expect(duration).toBeDefined();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should log warning on failure', () => {
      const timer = createTimer('test-operation');
      timer.end(false);

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('logSlowOperation', () => {
    it('should log when duration exceeds threshold', () => {
      logSlowOperation('slow-op', 2000, 1000);

      expect(logger.warn).toHaveBeenCalledWith('Slow operation detected', expect.objectContaining({
        operation: 'slow-op',
        duration: 2000,
        threshold: 1000
      }));
    });

    it('should not log when duration is below threshold', () => {
      jest.clearAllMocks();
      logSlowOperation('fast-op', 500, 1000);

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('logRateLimitStatus', () => {
    it('should log when rate limit exceeded', () => {
      logRateLimitStatus('api-key', {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        reason: 'limit exceeded'
      });

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log debug when approaching limit', () => {
      logRateLimitStatus('api-key', {
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000
      });

      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('logExternalAPICall', () => {
    it('should log successful API calls', () => {
      logExternalAPICall('CoinGecko', '/api/v3/simple/price', 200, true);

      expect(logger.info).toHaveBeenCalled();
    });

    it('should log failed API calls as errors', () => {
      logExternalAPICall('CoinGecko', '/api/v3/simple/price', 500, false);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logCacheOperation', () => {
    it('should log cache get with hit status', () => {
      logCacheOperation('get', 'cache-key', true);

      expect(logger.debug).toHaveBeenCalledWith('Cache operation', expect.objectContaining({
        operation: 'get',
        key: 'cache-key',
        hit: true
      }));
    });
  });

  describe('logAudit', () => {
    it('should log audit events', () => {
      logAudit('user_login', { userId: '123', ip: '192.168.1.1' });

      expect(logger.info).toHaveBeenCalledWith('Audit', expect.objectContaining({
        type: 'audit',
        action: 'user_login',
        userId: '123'
      }));
    });
  });

  describe('Logger Statistics', () => {
    it('should track log counts', () => {
      resetLoggerStats();

      const stats = getLoggerStats();

      expect(stats.counts).toBeDefined();
      expect(stats.uptime).toBeDefined();
      expect(stats.logLevel).toBeDefined();
    });

    it('should reset statistics', () => {
      resetLoggerStats();

      const stats = getLoggerStats();

      expect(stats.counts.error).toBe(0);
      expect(stats.counts.warn).toBe(0);
      expect(stats.counts.info).toBe(0);
    });
  });
});
