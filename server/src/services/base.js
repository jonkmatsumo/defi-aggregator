import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';
import { RateLimiter } from './rateLimiter.js';
import { CachingService } from './cachingService.js';

/**
 * Base service class with common functionality
 * Provides advanced caching, rate limiting, error handling, and configuration management
 */
export class BaseService {
  constructor(config = {}) {
    this.config = {
      cacheTimeout: 300000, // 5 minutes default
      rateLimitWindow: 60000, // 1 minute window
      rateLimitMax: 100, // 100 requests per window
      retryAttempts: 3,
      retryDelay: 1000,
      useAdvancedCaching: true,
      useAdvancedRateLimit: true,
      ...config
    };

    // Initialize caching (always use simple caching for backward compatibility)
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Initialize advanced caching if explicitly enabled
    if (this.config.useAdvancedCaching) {
      this.cachingService = new CachingService({
        defaultStrategy: config.cacheStrategy || 'lru',
        maxCaches: config.maxCaches || 5,
        globalMaxSize: config.globalMaxSize || 2000,
        globalMaxMemoryMB: config.globalMaxMemoryMB || 100
      });
      this.cacheName = config.cacheName || this.constructor.name.toLowerCase();
    }

    // Initialize rate limiting (always use simple rate limiting for backward compatibility)
    this.rateLimitRequests = new Map(); // key -> [timestamps]

    // Initialize advanced rate limiting if explicitly enabled
    if (this.config.useAdvancedRateLimit) {
      this.rateLimiter = new RateLimiter({
        defaultWindow: this.config.rateLimitWindow,
        defaultMaxRequests: this.config.rateLimitMax,
        coordinationEnabled: config.coordinationEnabled !== false,
        burstAllowance: config.burstAllowance || 0.2
      });
    }
    
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
   * @param {Object} options - Caching options
   * @returns {*} Cached data or null
   */
  getCachedData(key, options = {}) {
    if (this.config.useAdvancedCaching && this.cachingService) {
      const data = this.cachingService.get(this.cacheName, key, options);
      if (data !== null) {
        this.metrics.cacheHits++;
        logger.debug('Advanced cache hit', { key, cacheName: this.cacheName, serviceName: this.constructor.name });
      } else {
        this.metrics.cacheMisses++;
      }
      return data;
    } else {
      // Use simple caching
      const data = this.cache.get(key);
      const timestamp = this.cacheTimestamps.get(key);

      if (data && timestamp && (Date.now() - timestamp) < this.config.cacheTimeout) {
        this.metrics.cacheHits++;
        logger.debug('Simple cache hit', { key, serviceName: this.constructor.name });
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
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {Object} options - Caching options
   */
  setCachedData(key, data, options = {}) {
    if (this.config.useAdvancedCaching && this.cachingService) {
      this.cachingService.set(this.cacheName, key, data, {
        ttl: options.ttl || this.config.cacheTimeout,
        ...options
      });
      logger.debug('Advanced cache set', { key, cacheName: this.cacheName, serviceName: this.constructor.name });
    } else {
      // Use simple caching
      this.cache.set(key, data);
      this.cacheTimestamps.set(key, Date.now());
      logger.debug('Simple cache set', { key, serviceName: this.constructor.name });
    }
  }

  /**
   * Clear cache for specific key or all keys
   * @param {string} key - Cache key (optional)
   */
  clearCache(key = null) {
    if (this.config.useAdvancedCaching && this.cachingService) {
      if (key) {
        this.cachingService.delete(this.cacheName, key);
        logger.debug('Advanced cache cleared for key', { key, cacheName: this.cacheName, serviceName: this.constructor.name });
      } else {
        this.cachingService.clear(this.cacheName);
        logger.debug('Advanced cache cleared', { cacheName: this.cacheName, serviceName: this.constructor.name });
      }
    } else {
      // Use simple caching
      if (key) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
        logger.debug('Simple cache cleared for key', { key, serviceName: this.constructor.name });
      } else {
        this.cache.clear();
        this.cacheTimestamps.clear();
        logger.debug('Simple cache cleared', { serviceName: this.constructor.name });
      }
    }
  }

  /**
   * Check rate limit for a key
   * @param {string} key - Rate limit key
   * @param {Object} options - Rate limit options
   * @returns {boolean|Object} True if within rate limit, or result object for advanced rate limiting
   */
  checkRateLimit(key, options = {}) {
    if (this.config.useAdvancedRateLimit && this.rateLimiter) {
      const result = this.rateLimiter.checkRateLimit(key, options);
      if (!result.allowed) {
        this.metrics.rateLimitExceeded++;
        logger.warn('Advanced rate limit exceeded', { 
          key, 
          reason: result.reason,
          serviceName: this.constructor.name 
        });
      }
      return result.allowed;
    } else {
      // Use simple rate limiting
      const now = Date.now();
      const windowStart = now - this.config.rateLimitWindow;

      // Get existing requests for this key
      let requests = this.rateLimitRequests.get(key) || [];

      // Remove requests outside the window
      requests = requests.filter(timestamp => timestamp > windowStart);

      // Check if we're within the limit
      if (requests.length >= this.config.rateLimitMax) {
        this.metrics.rateLimitExceeded++;
        logger.warn('Simple rate limit exceeded', { 
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
  }

  /**
   * Configure rate limiting for a specific key
   * @param {string} key - Rate limit key
   * @param {Object} config - Rate limit configuration
   */
  configureRateLimit(key, config) {
    if (this.config.useAdvancedRateLimit && this.rateLimiter) {
      this.rateLimiter.configure(key, config);
      logger.debug('Rate limit configured', { key, config, serviceName: this.constructor.name });
    } else {
      logger.warn('Advanced rate limiting not enabled, configuration ignored', { key, serviceName: this.constructor.name });
    }
  }

  /**
   * Configure provider-level rate limiting for coordination
   * @param {string} provider - Provider name
   * @param {Object} config - Provider rate limit configuration
   */
  configureProviderRateLimit(provider, config) {
    if (this.config.useAdvancedRateLimit && this.rateLimiter) {
      this.rateLimiter.configureProvider(provider, config);
      logger.debug('Provider rate limit configured', { provider, config, serviceName: this.constructor.name });
    } else {
      logger.warn('Advanced rate limiting not enabled, provider configuration ignored', { provider, serviceName: this.constructor.name });
    }
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
    const baseMetrics = {
      ...this.metrics,
      serviceName: this.constructor.name
    };

    if (this.config.useAdvancedCaching && this.cachingService) {
      const cachingStats = this.cachingService.getStats();
      baseMetrics.caching = cachingStats.caches[this.cacheName] || {};
      baseMetrics.globalCaching = cachingStats.global;
    } else {
      baseMetrics.cacheSize = this.cache.size;
    }

    if (this.config.useAdvancedRateLimit && this.rateLimiter) {
      baseMetrics.rateLimiting = this.rateLimiter.getMetrics();
    } else {
      baseMetrics.rateLimitKeys = this.rateLimitRequests.size;
    }

    return baseMetrics;
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