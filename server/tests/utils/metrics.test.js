import { jest } from '@jest/globals';

// Mock the logger before importing metrics
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Now import the module under test
const { MetricsCollector, metricsCollector } = await import('../../src/utils/metrics.js');

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector({
      enablePeriodicLogging: false // Disable for tests
    });
  });

  afterEach(() => {
    collector.destroy();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      expect(collector.options.histogramBuckets).toEqual([10, 50, 100, 200, 500, 1000, 2000, 5000]);
      expect(collector.options.slowThreshold).toBe(1000);
    });

    it('should accept custom options', () => {
      const custom = new MetricsCollector({
        slowThreshold: 500,
        enablePeriodicLogging: false
      });
      
      expect(custom.options.slowThreshold).toBe(500);
      custom.destroy();
    });
  });

  describe('Request Metrics', () => {
    it('should record requests', () => {
      collector.recordRequest('GET', '/api/test', 200, 150);

      expect(collector.requests.total).toBe(1);
    });

    it('should track by endpoint', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);
      collector.recordRequest('GET', '/api/test', 200, 150);
      collector.recordRequest('POST', '/api/other', 201, 200);

      const getStats = collector.requests.byEndpoint.get('GET:/api/test');
      expect(getStats.count).toBe(2);
    });

    it('should track by method', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);
      collector.recordRequest('POST', '/api/test', 201, 100);

      expect(collector.requests.byMethod.get('GET')).toBe(1);
      expect(collector.requests.byMethod.get('POST')).toBe(1);
    });

    it('should track by status group', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);
      collector.recordRequest('GET', '/api/test', 201, 100);
      collector.recordRequest('GET', '/api/test', 404, 100);
      collector.recordRequest('GET', '/api/test', 500, 100);

      expect(collector.requests.byStatus.get('2xx')).toBe(2);
      expect(collector.requests.byStatus.get('4xx')).toBe(1);
      expect(collector.requests.byStatus.get('5xx')).toBe(1);
    });

    it('should track errors by endpoint', () => {
      collector.recordRequest('GET', '/api/test', 500, 100);

      const stats = collector.requests.byEndpoint.get('GET:/api/test');
      expect(stats.errors).toBe(1);
    });
  });

  describe('Response Time Metrics', () => {
    it('should record response times', () => {
      collector.recordResponseTime('/api/test', 100);
      collector.recordResponseTime('/api/test', 200);

      expect(collector.responseTimes.all.length).toBe(2);
    });

    it('should update histogram', () => {
      collector.recordResponseTime('/api/test', 50);
      collector.recordResponseTime('/api/test', 150);
      collector.recordResponseTime('/api/test', 600);

      expect(collector.responseTimes.histogram.le_50).toBe(1);
      expect(collector.responseTimes.histogram.le_200).toBe(1);
      expect(collector.responseTimes.histogram.le_1000).toBe(1);
    });

    it('should keep rolling window of response times', () => {
      // Add more than 1000 response times
      for (let i = 0; i < 1100; i++) {
        collector.recordResponseTime('/api/test', i);
      }

      expect(collector.responseTimes.all.length).toBe(1000);
    });
  });

  describe('Error Metrics', () => {
    it('should record errors', () => {
      collector.recordError('VALIDATION_ERROR', '/api/test', { field: 'email' });

      expect(collector.errors.total).toBe(1);
      expect(collector.errors.byType.get('VALIDATION_ERROR')).toBe(1);
    });

    it('should track by endpoint', () => {
      collector.recordError('ERROR', '/api/test');
      collector.recordError('ERROR', '/api/test');

      expect(collector.errors.byEndpoint.get('/api/test')).toBe(2);
    });

    it('should keep recent errors', () => {
      collector.recordError('ERROR_1', '/api/test');
      collector.recordError('ERROR_2', '/api/other');

      expect(collector.errors.recent.length).toBe(2);
      expect(collector.errors.recent[0].type).toBe('ERROR_1');
    });

    it('should limit recent errors to 100', () => {
      for (let i = 0; i < 150; i++) {
        collector.recordError(`ERROR_${i}`, '/api/test');
      }

      expect(collector.errors.recent.length).toBe(100);
    });
  });

  describe('Service Metrics', () => {
    it('should record service metrics', () => {
      collector.recordServiceMetrics('TestService', {
        requests: 100,
        cacheHits: 80
      });

      const metrics = collector.getServiceMetrics('TestService');
      expect(metrics.requests).toBe(100);
      expect(metrics.cacheHits).toBe(80);
    });

    it('should return null for unknown service', () => {
      const metrics = collector.getServiceMetrics('UnknownService');
      expect(metrics).toBeNull();
    });
  });

  describe('Rate Limit Metrics', () => {
    it('should record rate limit exceeded', () => {
      collector.recordRateLimitExceeded('api-key-1');
      collector.recordRateLimitExceeded('api-key-1');
      collector.recordRateLimitExceeded('api-key-2');

      expect(collector.rateLimits.exceeded).toBe(3);
      expect(collector.rateLimits.byKey.get('api-key-1')).toBe(2);
      expect(collector.rateLimits.byKey.get('api-key-2')).toBe(1);
    });
  });

  describe('Cache Metrics', () => {
    it('should record cache hits', () => {
      collector.recordCacheOperation('TestService', true);

      expect(collector.cache.hits).toBe(1);
      expect(collector.cache.misses).toBe(0);
    });

    it('should record cache misses', () => {
      collector.recordCacheOperation('TestService', false);

      expect(collector.cache.hits).toBe(0);
      expect(collector.cache.misses).toBe(1);
    });

    it('should track by service', () => {
      collector.recordCacheOperation('Service1', true);
      collector.recordCacheOperation('Service1', true);
      collector.recordCacheOperation('Service2', false);

      const service1Cache = collector.cache.byService.get('Service1');
      expect(service1Cache.hits).toBe(2);
    });
  });

  describe('External API Metrics', () => {
    it('should record external API calls', () => {
      collector.recordExternalAPICall('CoinGecko', 200, true);
      collector.recordExternalAPICall('CoinGecko', 150, true);
      collector.recordExternalAPICall('CoinGecko', 300, false);

      const metrics = collector.externalAPIs.get('CoinGecko');
      expect(metrics.calls).toBe(3);
      expect(metrics.errors).toBe(1);
      expect(metrics.totalDuration).toBe(650);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate correct statistics', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const stats = collector.calculateStats(values);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(100);
      expect(stats.avg).toBe(55);
      expect(stats.count).toBe(10);
    });

    it('should handle empty array', () => {
      const stats = collector.calculateStats([]);

      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.avg).toBe(0);
    });

    it('should calculate percentiles', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sorted = [...values].sort((a, b) => a - b);

      expect(collector.percentile(sorted, 50)).toBe(5);
      expect(collector.percentile(sorted, 90)).toBe(9);
    });
  });

  describe('Get Metrics', () => {
    it('should return comprehensive metrics', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);
      collector.recordError('ERROR', '/api/test');
      collector.recordCacheOperation('TestService', true);

      const metrics = collector.getMetrics();

      expect(metrics.uptime).toBeDefined();
      expect(metrics.requests).toBeDefined();
      expect(metrics.responseTimes).toBeDefined();
      expect(metrics.errors).toBeDefined();
      expect(metrics.cache).toBeDefined();
      expect(metrics.system).toBeDefined();
    });

    it('should include error rate', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);
      collector.recordRequest('GET', '/api/test', 500, 100);
      collector.recordError('ERROR', '/api/test');

      const metrics = collector.getMetrics();

      expect(metrics.errors.rate).toBe(50); // 1 error / 2 requests = 50%
    });

    it('should include cache hit rate', () => {
      collector.recordCacheOperation('Service', true);
      collector.recordCacheOperation('Service', true);
      collector.recordCacheOperation('Service', false);
      collector.recordCacheOperation('Service', false);

      const metrics = collector.getMetrics();

      expect(metrics.cache.hitRate).toBe(50); // 2 hits / 4 total = 50%
    });
  });

  describe('Get Summary', () => {
    it('should return summary metrics', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);

      const summary = collector.getSummary();

      expect(summary.requests).toBeDefined();
      expect(summary.errors).toBeDefined();
      expect(summary.errorRate).toBeDefined();
      expect(summary.avgResponseTime).toBeDefined();
      expect(summary.cacheHitRate).toBeDefined();
      expect(summary.uptime).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      collector.recordRequest('GET', '/api/test', 200, 100);
      collector.recordError('ERROR', '/api/test');

      collector.reset();

      expect(collector.requests.total).toBe(0);
      expect(collector.errors.total).toBe(0);
    });
  });

  describe('Format Uptime', () => {
    it('should format uptime correctly', () => {
      expect(collector.formatUptime(30)).toBe('30s');
      expect(collector.formatUptime(90)).toBe('1m 30s');
      expect(collector.formatUptime(3661)).toBe('1h 1m 1s');
      expect(collector.formatUptime(90061)).toBe('1d 1h 1m 1s');
    });
  });
});

describe('Singleton Instance', () => {
  it('should export a singleton instance', () => {
    expect(metricsCollector).toBeInstanceOf(MetricsCollector);
  });
});
