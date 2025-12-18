import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * External API client management with credential security and rate limiting
 */
export class APIClient {
  constructor(config = {}) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      userAgent: 'DeFi-Aggregator-Backend/1.0.0',
      ...config,
    };

    // Secure credential storage
    this.credentials = new Map();

    // Request tracking for rate limiting
    this.requestHistory = new Map(); // endpoint -> [timestamps]

    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    logger.debug('API Client initialized', {
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts,
    });
  }

  /**
   * Securely store API credentials
   * @param {string} provider - API provider name
   * @param {Object} credentials - Credential object
   */
  setCredentials(provider, credentials) {
    if (!provider || typeof provider !== 'string') {
      throw new ServiceError('Provider name must be a non-empty string');
    }

    if (!credentials || typeof credentials !== 'object') {
      throw new ServiceError('Credentials must be an object');
    }

    // Store credentials securely (in production, consider encryption)
    this.credentials.set(provider, { ...credentials });

    logger.debug('Credentials stored for provider', { provider });
  }

  /**
   * Get credentials for a provider
   * @param {string} provider - API provider name
   * @returns {Object} Credentials object
   */
  getCredentials(provider) {
    const credentials = this.credentials.get(provider);
    if (!credentials) {
      throw new ServiceError(`No credentials found for provider: ${provider}`);
    }
    return { ...credentials }; // Return copy to prevent modification
  }

  /**
   * Check if credentials exist for provider
   * @param {string} provider - API provider name
   * @returns {boolean}
   */
  hasCredentials(provider) {
    return this.credentials.has(provider);
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Object} Response data
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.config.timeout,
      retryAttempts = this.config.retryAttempts,
      rateLimitKey = null,
    } = options;

    // Check rate limiting if key provided
    if (rateLimitKey && !this.checkRateLimit(rateLimitKey, options.rateLimit)) {
      throw new ServiceError(`Rate limit exceeded for ${rateLimitKey}`);
    }

    const requestOptions = {
      method,
      headers: {
        'User-Agent': this.config.userAgent,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      timeout,
    };

    let lastError;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        logger.debug('Making API request', {
          url,
          method,
          attempt,
          maxAttempts: retryAttempts,
        });

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          throw new ServiceError(
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();

        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateMetrics(true, responseTime);

        // Track request for rate limiting
        if (rateLimitKey) {
          this.trackRequest(rateLimitKey);
        }

        logger.debug('API request successful', {
          url,
          responseTime,
          attempt,
        });

        return data;
      } catch (error) {
        lastError = error;

        logger.warn('API request failed', {
          url,
          attempt,
          maxAttempts: retryAttempts,
          error: error.message,
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < retryAttempts) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // Update failure metrics
    this.updateMetrics(false, Date.now() - startTime);

    logger.error('API request failed after all attempts', {
      url,
      attempts: retryAttempts,
      error: lastError.message,
    });

    throw lastError;
  }

  /**
   * Make GET request
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Object} Response data
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * Make POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request body data
   * @param {Object} options - Request options
   * @returns {Object} Response data
   */
  async post(url, data, options = {}) {
    return this.request(url, { ...options, method: 'POST', body: data });
  }

  /**
   * Check rate limit for endpoint
   * @param {string} key - Rate limit key
   * @param {Object} rateLimit - Rate limit configuration
   * @returns {boolean} True if within rate limit
   */
  checkRateLimit(key, rateLimit = {}) {
    if (!rateLimit.maxRequests || !rateLimit.windowMs) {
      return true; // No rate limiting configured
    }

    const now = Date.now();
    const windowStart = now - rateLimit.windowMs;

    // Get request history for this key
    let requests = this.requestHistory.get(key) || [];

    // Remove requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if we're within the limit
    if (requests.length >= rateLimit.maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        requests: requests.length,
        limit: rateLimit.maxRequests,
        windowMs: rateLimit.windowMs,
      });
      return false;
    }

    return true;
  }

  /**
   * Track request for rate limiting
   * @param {string} key - Rate limit key
   */
  trackRequest(key) {
    const requests = this.requestHistory.get(key) || [];
    requests.push(Date.now());
    this.requestHistory.set(key, requests);
  }

  /**
   * Check if error is non-retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error should not be retried
   */
  isNonRetryableError(error) {
    // Don't retry on authentication errors, bad requests, etc.
    if (error.message.includes('401') || error.message.includes('403')) {
      return true;
    }
    if (error.message.includes('400') || error.message.includes('422')) {
      return true;
    }
    return false;
  }

  /**
   * Update request metrics
   * @param {boolean} success - Whether request was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  updateMetrics(success, responseTime) {
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime =
      this.metrics.totalResponseTime / this.metrics.totalRequests;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get API client metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
          : 0,
      activeRateLimitKeys: this.requestHistory.size,
      storedCredentials: this.credentials.size,
    };
  }

  /**
   * Clear stored credentials (for security)
   */
  clearCredentials() {
    this.credentials.clear();
    logger.info('All API credentials cleared');
  }

  /**
   * Remove credentials for specific provider
   * @param {string} provider - Provider name
   */
  removeCredentials(provider) {
    const removed = this.credentials.delete(provider);
    if (removed) {
      logger.info('Credentials removed for provider', { provider });
    }
    return removed;
  }
}
