import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock the logger before importing middleware
jest.unstable_mockModule('../../src/utils/logger.js', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => mockLogger)
  };

  return {
    logger: mockLogger,
    generateRequestId: jest.fn(() => 'test-request-id'),
    createRequestLogger: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      requestStart: jest.fn(),
      requestEnd: jest.fn(),
      serviceCall: jest.fn()
    })),
    createTimer: jest.fn(() => ({
      operation: 'test',
      startTime: Date.now(),
      end: jest.fn(() => 100),
      elapsed: jest.fn(() => 50)
    })),
    logSlowOperation: jest.fn()
  };
});

// Mock the metrics collector
jest.unstable_mockModule('../../src/utils/metrics.js', () => ({
  metricsCollector: {
    recordRequest: jest.fn(),
    recordError: jest.fn(),
    recordExternalAPICall: jest.fn()
  }
}));

// Import after mocking
const { requestLoggerMiddleware, errorLoggerMiddleware, logServiceCall, logExternalCall } =
  await import('../../src/middleware/requestLogger.js');
const { metricsCollector } = await import('../../src/utils/metrics.js');
const { createRequestLogger } = await import('../../src/utils/logger.js');

describe('Request Logger Middleware', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(requestLoggerMiddleware());

    // Test routes
    app.get('/api/test', (req, res) => {
      res.json({ success: true });
    });

    app.get('/api/slow', (req, res) => {
      setTimeout(() => {
        res.json({ success: true });
      }, 50);
    });

    app.post('/api/data', (req, res) => {
      res.status(201).json({ success: true, data: req.body });
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    app.get('/api/error', (req, res) => {
      res.status(500).json({ error: 'Server error' });
    });
  });

  describe('Request ID', () => {
    it('should add X-Request-ID header to response', async () => {
      const response = await request(app).get('/api/test');

      expect(response.headers['x-request-id']).toBe('test-request-id');
    });

    it('should attach request ID to request object', async () => {
      let requestId;

      app.get('/api/check-id', (req, res) => {
        requestId = req.requestId;
        res.json({ success: true });
      });

      await request(app).get('/api/check-id');

      expect(requestId).toBe('test-request-id');
    });
  });

  describe('Excluded Paths', () => {
    it('should skip logging for health endpoint', async () => {
      jest.clearAllMocks();

      await request(app).get('/health');

      // Health endpoint should not trigger request logging
      expect(createRequestLogger).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Recording', () => {
    it('should record request metrics', async () => {
      await request(app).get('/api/test');

      expect(metricsCollector.recordRequest).toHaveBeenCalled();
    });

    it('should record error metrics for 5xx responses', async () => {
      await request(app).get('/api/error');

      expect(metricsCollector.recordRequest).toHaveBeenCalledWith(
        'GET',
        '/api/error',
        500,
        expect.any(Number)
      );
    });
  });

  describe('Response Tracking', () => {
    it('should handle POST requests with body', async () => {
      const response = await request(app)
        .post('/api/data')
        .send({ name: 'test' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle various status codes', async () => {
      const response200 = await request(app).get('/api/test');
      const response500 = await request(app).get('/api/error');

      expect(response200.status).toBe(200);
      expect(response500.status).toBe(500);
    });
  });
});

describe('Error Logger Middleware', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(requestLoggerMiddleware());

    // Route that throws error
    app.get('/api/throw', (req, res, next) => {
      const error = new Error('Test error');
      error.statusCode = 500;
      next(error);
    });

    app.get('/api/client-error', (req, res, next) => {
      const error = new Error('Not found');
      error.statusCode = 404;
      next(error);
    });

    // Error handling middleware
    app.use(errorLoggerMiddleware());

    // Final error handler
    app.use((err, req, res, _next) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });
  });

  describe('Error Logging', () => {
    it('should log server errors', async () => {
      await request(app).get('/api/throw');

      expect(metricsCollector.recordError).toHaveBeenCalledWith(
        'SERVER_ERROR',
        '/api/throw',
        expect.any(Object)
      );
    });

    it('should log client errors', async () => {
      await request(app).get('/api/client-error');

      expect(metricsCollector.recordError).toHaveBeenCalledWith(
        'CLIENT_ERROR',
        '/api/client-error',
        expect.any(Object)
      );
    });
  });
});

describe('Service Call Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log successful service calls', async () => {
    const result = await logServiceCall('TestService', 'testMethod', async () => {
      return { data: 'result' };
    });

    expect(result).toEqual({ data: 'result' });
  });

  it('should log failed service calls', async () => {
    const error = new Error('Service error');

    await expect(
      logServiceCall('TestService', 'failingMethod', async () => {
        throw error;
      })
    ).rejects.toThrow('Service error');

    expect(metricsCollector.recordError).toHaveBeenCalled();
  });
});

describe('External Call Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log successful external calls', async () => {
    const result = await logExternalCall('CoinGecko', '/api/v3/simple/price', async () => {
      return { bitcoin: { usd: 50000 } };
    });

    expect(result).toEqual({ bitcoin: { usd: 50000 } });
    expect(metricsCollector.recordExternalAPICall).toHaveBeenCalledWith(
      'CoinGecko',
      expect.any(Number),
      true
    );
  });

  it('should log failed external calls', async () => {
    const error = new Error('API error');

    await expect(
      logExternalCall('CoinGecko', '/api/v3/simple/price', async () => {
        throw error;
      })
    ).rejects.toThrow('API error');

    expect(metricsCollector.recordExternalAPICall).toHaveBeenCalledWith(
      'CoinGecko',
      expect.any(Number),
      false
    );
  });
});
