import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Base service class with common functionality
 * Provides caching, rate limiting, error handling, and configuration management
 */
export class BaseService {
  constructor(config = {}) {
    this.config = {
      cacheTimeout: 300000, // 5 minutes default
      rateLimitWindow: 60000, // 1 minute window
      rateLimitMax: 100, // 100 requests per window
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    // Initialize cache
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Initialize rate limiting
    this.rateLimitRequests = new Map(); // key -> [timestamps]
    
    // Initialize metrics
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      rateLimitExceeded: 0,
      averageResponseTime: 0,
      totalResponseTime: 0
    };

    logger.debug('Base service initialized', { 
      serviceName: this.constructor.name,
      config: this.config 
    });
  }

  /**
   * Get cached data if valid
   * @param {string} key - Cache key
   * @returns {*} Cached data or null
   */
  getCachedData(key) {
    const data = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);

    if (data && timestamp && (Date.now() - timestamp) < this.config.cacheTimeout) {
      this.metrics.cacheHits++;
      logger.debug('Cache hit', { key, serviceName: this.constructor.name });
      return data;
    }

    if (data) {
      // Remove expired cache entry
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }

    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   */
  setCachedData(key, data) {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
    logger.debug('Data cached', { key, serviceName: this.constructor.name });
  }

  /**
   * Clear cache for specific key or all keys
   * @param {string} key - Cache key (optional)
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      logger.debug('Cache cleared for key', { key, serviceName: this.constructor.name });
    } else {
      this.cache.clear();
      this.cacheTimestamps.clear();
      logger.debug('All cache cleared', { serviceName: this.constructor.name });
    }
  }

  /**
   * Check rate limit for a key
   * @param {string} key - Rate limit key
   * @returns {boolean} True if within rate limit
   */
  checkRateLimit(key) {
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindow;

    // Get existing requests for this key
    let requests = this.rateLimitRequests.get(key) || [];

    // Remove requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if we're within the limit
    if (requests.length >= this.config.rateLimitMax) {
      this.metrics.rateLimitExceeded++;
      logger.warn('Rate limit exceeded', { 
        key, 
        requests: requests.length, 
        limit: this.config.rateLimitMax,
        serviceName: this.constructor.name 
      });
      return false;
    }

    // Add current request
    requests.push(now);
    this.rateLimitRequests.set(key, requests);

    return true;
  }

  /**
   * Execute with retry logic
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Retry options
   * @returns {*} Operation result
   */
  async executeWithRetry(operation, options = {}) {
    const { 
      attempts = this.config.retryAttempts, 
      delay = this.config.retryDelay,
      backoff = true 
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        
        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateResponseTimeMetrics(responseTime);
        this.metrics.requests++;

        return result;

      } catch (error) {
        lastError = error;
        this.metrics.errors++;

        logger.warn('Operation failed, retrying', {
          attempt,
          maxAttempts: attempts,
          error: error.message,
          serviceName: this.constructor.name
        });

        // Don't wait after the last attempt
        if (attempt < attempts) {
          const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
          await this.sleep(waitTime);
        }
      }
    }

    logger.error('Operation failed after all retry attempts', {
      attempts,
      error: lastError.message,
      serviceName: this.constructor.name
    });

    throw lastError;
  }

  /**
   * Update response time metrics
   * @param {number} responseTime - Response time in milliseconds
   */
  updateResponseTimeMetrics(responseTime) {
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requests;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate required configuration
   * @param {Array<string>} requiredKeys - Required configuration keys
   */
  validateConfig(requiredKeys) {
    const missing = requiredKeys.filter(key => {
      const value = this.getNestedConfig(key);
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      throw new ServiceError(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Get nested configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @returns {*} Configuration value
   */
  getNestedConfig(key) {
    return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
  }

  /**
   * Handle service errors with logging and metrics
   * @param {Error} error - Error to handle
   * @param {string} operation - Operation that failed
   * @param {Object} context - Additional context
   */
  handleError(error, operation, context = {}) {
    this.metrics.errors++;

    const errorInfo = {
      operation,
      error: error.message,
      serviceName: this.constructor.name,
      ...context
    };

    if (error instanceof ServiceError) {
      logger.warn('Service error occurred', errorInfo);
    } else {
      logger.error('Unexpected error occurred', {
        ...errorInfo,
        stack: error.stack
      });
    }

    throw error;
  }

  /**
   * Get service metrics
   * @returns {Object} Service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      rateLimitKeys: this.rateLimitRequests.size,
      serviceName: this.constructor.name
    };
  }

  /**
   * Reset service metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      rateLimitExceeded: 0,
      averageResponseTime: 0,
      totalResponseTime: 0
    };
    logger.debug('Service metrics reset', { serviceName: this.constructor.name });
  }
}