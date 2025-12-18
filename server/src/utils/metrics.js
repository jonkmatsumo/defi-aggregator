import { logger } from './logger.js';

/**
 * MetricsCollector
 *
 * Centralized metrics collection for monitoring service performance.
 * Tracks request counts, response times, error rates, and resource usage.
 */
export class MetricsCollector {
  constructor(options = {}) {
    this.options = {
      histogramBuckets: options.histogramBuckets || [
        10, 50, 100, 200, 500, 1000, 2000, 5000,
      ],
      flushInterval: options.flushInterval || 60000, // 1 minute
      enablePeriodicLogging: options.enablePeriodicLogging !== false,
      slowThreshold: options.slowThreshold || 1000, // 1 second
      ...options,
    };

    // Request metrics
    this.requests = {
      total: 0,
      byEndpoint: new Map(),
      byMethod: new Map(),
      byStatus: new Map(),
    };

    // Response time metrics
    this.responseTimes = {
      all: [],
      byEndpoint: new Map(),
      histogram: this.createHistogram(),
    };

    // Error metrics
    this.errors = {
      total: 0,
      byType: new Map(),
      byEndpoint: new Map(),
      recent: [], // Keep last 100 errors
    };

    // Service metrics
    this.services = new Map();

    // Rate limit metrics
    this.rateLimits = {
      exceeded: 0,
      byKey: new Map(),
    };

    // Cache metrics
    this.cache = {
      hits: 0,
      misses: 0,
      byService: new Map(),
    };

    // External API metrics
    this.externalAPIs = new Map();

    // Start time for uptime calculation
    this.startTime = Date.now();

    // Periodic metrics logging
    if (this.options.enablePeriodicLogging && process.env.NODE_ENV !== 'test') {
      this.flushIntervalId = setInterval(() => {
        this.logMetricsSummary();
      }, this.options.flushInterval);
    }

    logger.info('MetricsCollector initialized', { options: this.options });
  }

  /**
   * Create histogram buckets for response time tracking
   * @returns {Object} Histogram structure
   */
  createHistogram() {
    const histogram = {};
    this.options.histogramBuckets.forEach(bucket => {
      histogram[`le_${bucket}`] = 0;
    });
    histogram.le_inf = 0;
    return histogram;
  }

  // ============================================
  // Request Metrics
  // ============================================

  /**
   * Record a request
   * @param {string} method - HTTP method
   * @param {string} endpoint - Request endpoint
   * @param {number} statusCode - Response status code
   * @param {number} duration - Response time in milliseconds
   */
  recordRequest(method, endpoint, statusCode, duration) {
    // Total requests
    this.requests.total++;

    // By endpoint
    const endpointKey = `${method}:${endpoint}`;
    const endpointStats = this.requests.byEndpoint.get(endpointKey) || {
      count: 0,
      errors: 0,
    };
    endpointStats.count++;
    if (statusCode >= 400) endpointStats.errors++;
    this.requests.byEndpoint.set(endpointKey, endpointStats);

    // By method
    this.requests.byMethod.set(
      method,
      (this.requests.byMethod.get(method) || 0) + 1
    );

    // By status
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.requests.byStatus.set(
      statusGroup,
      (this.requests.byStatus.get(statusGroup) || 0) + 1
    );

    // Record response time
    this.recordResponseTime(endpoint, duration);

    // Log slow requests
    if (duration > this.options.slowThreshold) {
      logger.warn('Slow request detected', {
        method,
        endpoint,
        statusCode,
        duration,
        threshold: this.options.slowThreshold,
      });
    }
  }

  /**
   * Record response time
   * @param {string} endpoint - Request endpoint
   * @param {number} duration - Response time in milliseconds
   */
  recordResponseTime(endpoint, duration) {
    // Keep rolling window of response times (last 1000)
    this.responseTimes.all.push(duration);
    if (this.responseTimes.all.length > 1000) {
      this.responseTimes.all.shift();
    }

    // By endpoint
    let endpointTimes = this.responseTimes.byEndpoint.get(endpoint);
    if (!endpointTimes) {
      endpointTimes = [];
      this.responseTimes.byEndpoint.set(endpoint, endpointTimes);
    }
    endpointTimes.push(duration);
    if (endpointTimes.length > 100) {
      endpointTimes.shift();
    }

    // Update histogram
    let recorded = false;
    for (const bucket of this.options.histogramBuckets) {
      if (duration <= bucket && !recorded) {
        this.responseTimes.histogram[`le_${bucket}`]++;
        recorded = true;
      }
    }
    this.responseTimes.histogram.le_inf++;
  }

  // ============================================
  // Error Metrics
  // ============================================

  /**
   * Record an error
   * @param {string} errorType - Error type/code
   * @param {string} endpoint - Request endpoint (optional)
   * @param {Object} details - Error details
   */
  recordError(errorType, endpoint = null, details = {}) {
    this.errors.total++;

    // By type
    this.errors.byType.set(
      errorType,
      (this.errors.byType.get(errorType) || 0) + 1
    );

    // By endpoint
    if (endpoint) {
      this.errors.byEndpoint.set(
        endpoint,
        (this.errors.byEndpoint.get(endpoint) || 0) + 1
      );
    }

    // Keep recent errors
    this.errors.recent.push({
      type: errorType,
      endpoint,
      timestamp: Date.now(),
      ...details,
    });

    // Limit to last 100 errors
    if (this.errors.recent.length > 100) {
      this.errors.recent.shift();
    }
  }

  // ============================================
  // Service Metrics
  // ============================================

  /**
   * Record service metrics
   * @param {string} serviceName - Service name
   * @param {Object} metrics - Service metrics
   */
  recordServiceMetrics(serviceName, metrics) {
    this.services.set(serviceName, {
      ...metrics,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Get service metrics
   * @param {string} serviceName - Service name
   * @returns {Object|null} Service metrics
   */
  getServiceMetrics(serviceName) {
    return this.services.get(serviceName) || null;
  }

  // ============================================
  // Rate Limit Metrics
  // ============================================

  /**
   * Record rate limit exceeded
   * @param {string} key - Rate limit key
   */
  recordRateLimitExceeded(key) {
    this.rateLimits.exceeded++;
    this.rateLimits.byKey.set(key, (this.rateLimits.byKey.get(key) || 0) + 1);
  }

  // ============================================
  // Cache Metrics
  // ============================================

  /**
   * Record cache operation
   * @param {string} serviceName - Service name
   * @param {boolean} hit - Whether it was a cache hit
   */
  recordCacheOperation(serviceName, hit) {
    if (hit) {
      this.cache.hits++;
    } else {
      this.cache.misses++;
    }

    // By service
    let serviceCache = this.cache.byService.get(serviceName);
    if (!serviceCache) {
      serviceCache = { hits: 0, misses: 0 };
      this.cache.byService.set(serviceName, serviceCache);
    }
    if (hit) {
      serviceCache.hits++;
    } else {
      serviceCache.misses++;
    }
  }

  // ============================================
  // External API Metrics
  // ============================================

  /**
   * Record external API call
   * @param {string} provider - API provider
   * @param {number} duration - Call duration in milliseconds
   * @param {boolean} success - Whether call succeeded
   */
  recordExternalAPICall(provider, duration, success) {
    let providerMetrics = this.externalAPIs.get(provider);
    if (!providerMetrics) {
      providerMetrics = {
        calls: 0,
        errors: 0,
        totalDuration: 0,
        responseTimes: [],
      };
      this.externalAPIs.set(provider, providerMetrics);
    }

    providerMetrics.calls++;
    providerMetrics.totalDuration += duration;
    if (!success) {
      providerMetrics.errors++;
    }

    // Keep last 100 response times
    providerMetrics.responseTimes.push(duration);
    if (providerMetrics.responseTimes.length > 100) {
      providerMetrics.responseTimes.shift();
    }
  }

  // ============================================
  // Statistics Calculation
  // ============================================

  /**
   * Calculate statistics from array of values
   * @param {number[]} values - Values to analyze
   * @returns {Object} Statistics
   */
  calculateStats(values) {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Math.round((sum / values.length) * 100) / 100,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      count: values.length,
    };
  }

  /**
   * Calculate percentile value
   * @param {number[]} sortedValues - Sorted array of values
   * @param {number} p - Percentile (0-100)
   * @returns {number} Percentile value
   */
  percentile(sortedValues, p) {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  // ============================================
  // Get Metrics
  // ============================================

  /**
   * Get all metrics
   * @returns {Object} All metrics
   */
  getMetrics() {
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.startTime) / 1000);

    return {
      uptime: {
        seconds: uptimeSeconds,
        formatted: this.formatUptime(uptimeSeconds),
      },
      requests: {
        total: this.requests.total,
        perSecond:
          uptimeSeconds > 0
            ? Math.round((this.requests.total / uptimeSeconds) * 100) / 100
            : 0,
        byMethod: Object.fromEntries(this.requests.byMethod),
        byStatus: Object.fromEntries(this.requests.byStatus),
        byEndpoint: Object.fromEntries(
          Array.from(this.requests.byEndpoint.entries()).map(([k, v]) => [k, v])
        ),
      },
      responseTimes: {
        overall: this.calculateStats(this.responseTimes.all),
        histogram: this.responseTimes.histogram,
        byEndpoint: Object.fromEntries(
          Array.from(this.responseTimes.byEndpoint.entries()).map(([k, v]) => [
            k,
            this.calculateStats(v),
          ])
        ),
      },
      errors: {
        total: this.errors.total,
        rate:
          this.requests.total > 0
            ? Math.round((this.errors.total / this.requests.total) * 10000) /
              100
            : 0,
        byType: Object.fromEntries(this.errors.byType),
        byEndpoint: Object.fromEntries(this.errors.byEndpoint),
        recent: this.errors.recent.slice(-10),
      },
      cache: {
        hits: this.cache.hits,
        misses: this.cache.misses,
        hitRate:
          this.cache.hits + this.cache.misses > 0
            ? Math.round(
                (this.cache.hits / (this.cache.hits + this.cache.misses)) *
                  10000
              ) / 100
            : 0,
        byService: Object.fromEntries(this.cache.byService),
      },
      rateLimits: {
        exceeded: this.rateLimits.exceeded,
        byKey: Object.fromEntries(this.rateLimits.byKey),
      },
      externalAPIs: Object.fromEntries(
        Array.from(this.externalAPIs.entries()).map(([provider, metrics]) => [
          provider,
          {
            calls: metrics.calls,
            errors: metrics.errors,
            errorRate:
              metrics.calls > 0
                ? Math.round((metrics.errors / metrics.calls) * 10000) / 100
                : 0,
            avgResponseTime:
              metrics.calls > 0
                ? Math.round(metrics.totalDuration / metrics.calls)
                : 0,
            responseTimes: this.calculateStats(metrics.responseTimes),
          },
        ])
      ),
      services: Object.fromEntries(this.services),
      system: {
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
      },
      timestamp: now,
    };
  }

  /**
   * Get summary metrics for quick health check
   * @returns {Object} Summary metrics
   */
  getSummary() {
    const stats = this.calculateStats(this.responseTimes.all);
    return {
      requests: this.requests.total,
      errors: this.errors.total,
      errorRate:
        this.requests.total > 0
          ? Math.round((this.errors.total / this.requests.total) * 10000) / 100
          : 0,
      avgResponseTime: stats.avg,
      p95ResponseTime: stats.p95,
      cacheHitRate:
        this.cache.hits + this.cache.misses > 0
          ? Math.round(
              (this.cache.hits / (this.cache.hits + this.cache.misses)) * 10000
            ) / 100
          : 0,
      rateLimitsExceeded: this.rateLimits.exceeded,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Log periodic metrics summary
   */
  logMetricsSummary() {
    const summary = this.getSummary();
    logger.info('Metrics summary', {
      type: 'metrics_summary',
      ...summary,
    });
  }

  /**
   * Format uptime as human-readable string
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.requests = {
      total: 0,
      byEndpoint: new Map(),
      byMethod: new Map(),
      byStatus: new Map(),
    };
    this.responseTimes = {
      all: [],
      byEndpoint: new Map(),
      histogram: this.createHistogram(),
    };
    this.errors = {
      total: 0,
      byType: new Map(),
      byEndpoint: new Map(),
      recent: [],
    };
    this.services.clear();
    this.rateLimits = {
      exceeded: 0,
      byKey: new Map(),
    };
    this.cache = {
      hits: 0,
      misses: 0,
      byService: new Map(),
    };
    this.externalAPIs.clear();
    this.startTime = Date.now();

    logger.info('Metrics reset');
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();

export default MetricsCollector;
