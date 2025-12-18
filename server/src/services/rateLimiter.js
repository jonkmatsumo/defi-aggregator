import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Advanced rate limiting infrastructure for external API calls
 * Provides intelligent coordination to avoid exceeding API limits
 */
export class RateLimiter {
  constructor(config = {}) {
    this.config = {
      defaultWindow: 60000, // 1 minute default window
      defaultMaxRequests: 100, // 100 requests per window default
      coordinationEnabled: true,
      burstAllowance: 0.2, // Allow 20% burst above limit
      ...config,
    };

    // Rate limit tracking per key
    this.requestHistory = new Map(); // key -> [timestamps]
    this.rateLimitConfigs = new Map(); // key -> { maxRequests, windowMs, burstAllowance }

    // Global coordination tracking
    this.globalRequestHistory = new Map(); // provider -> [timestamps]
    this.providerConfigs = new Map(); // provider -> { maxRequests, windowMs }

    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      burstRequests: 0,
      coordinationBlocks: 0,
    };

    logger.debug('RateLimiter initialized', {
      defaultWindow: this.config.defaultWindow,
      defaultMaxRequests: this.config.defaultMaxRequests,
      coordinationEnabled: this.config.coordinationEnabled,
    });
  }

  /**
   * Configure rate limit for a specific key
   * @param {string} key - Rate limit key
   * @param {Object} config - Rate limit configuration
   */
  configure(key, config) {
    if (!key || typeof key !== 'string') {
      throw new ServiceError('Rate limit key must be a non-empty string');
    }

    const rateLimitConfig = {
      maxRequests: config.maxRequests || this.config.defaultMaxRequests,
      windowMs: config.windowMs || this.config.defaultWindow,
      burstAllowance:
        config.burstAllowance !== undefined
          ? config.burstAllowance
          : this.config.burstAllowance,
      provider: config.provider || null, // For global coordination
      priority: config.priority || 'normal', // high, normal, low
    };

    this.rateLimitConfigs.set(key, rateLimitConfig);

    logger.debug('Rate limit configured', {
      key,
      maxRequests: rateLimitConfig.maxRequests,
      windowMs: rateLimitConfig.windowMs,
      provider: rateLimitConfig.provider,
    });
  }

  /**
   * Configure global provider rate limits for coordination
   * @param {string} provider - Provider name (e.g., 'etherscan', 'coingecko')
   * @param {Object} config - Provider rate limit configuration
   */
  configureProvider(provider, config) {
    if (!provider || typeof provider !== 'string') {
      throw new ServiceError('Provider name must be a non-empty string');
    }

    const providerConfig = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      description: config.description || provider,
    };

    this.providerConfigs.set(provider, providerConfig);

    logger.debug('Provider rate limit configured', {
      provider,
      maxRequests: providerConfig.maxRequests,
      windowMs: providerConfig.windowMs,
    });
  }

  /**
   * Check if request is allowed under rate limits
   * @param {string} key - Rate limit key
   * @param {Object} options - Additional options
   * @returns {Object} Rate limit check result
   */
  checkRateLimit(key) {
    this.metrics.totalRequests++;

    const config = this.rateLimitConfigs.get(key);
    if (!config) {
      // No rate limit configured, allow request
      this.metrics.allowedRequests++;
      return { allowed: true, reason: 'no_limit_configured' };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Check key-specific rate limit
    const keyResult = this.checkKeyRateLimit(key, config, now, windowStart);
    if (!keyResult.allowed) {
      this.metrics.blockedRequests++;
      return keyResult;
    }

    // Check global provider coordination if enabled
    if (this.config.coordinationEnabled && config.provider) {
      const coordinationResult = this.checkProviderCoordination(
        config.provider,
        now
      );
      if (!coordinationResult.allowed) {
        this.metrics.coordinationBlocks++;
        return coordinationResult;
      }
    }

    // Request is allowed, track it
    this.trackRequest(key, config.provider, now);
    this.metrics.allowedRequests++;

    return {
      allowed: true,
      reason: 'within_limits',
      remaining: this.getRemainingRequests(key, config, now),
      resetTime: windowStart + config.windowMs,
    };
  }

  /**
   * Check key-specific rate limit
   * @param {string} key - Rate limit key
   * @param {Object} config - Rate limit configuration
   * @param {number} now - Current timestamp
   * @param {number} windowStart - Window start timestamp
   * @returns {Object} Check result
   */
  checkKeyRateLimit(key, config, now, windowStart) {
    // Get existing requests for this key
    let requests = this.requestHistory.get(key) || [];

    // Remove requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Current request count (including the one we're about to make)
    const currentRequestCount = requests.length + 1;

    // Check if we're within the base limit
    if (currentRequestCount <= config.maxRequests) {
      return { allowed: true, reason: 'within_base_limit' };
    }

    // Check if we can allow burst requests (only if burst allowance > 0)
    if (config.burstAllowance > 0) {
      const burstLimit = Math.floor(
        config.maxRequests * (1 + config.burstAllowance)
      );
      if (currentRequestCount <= burstLimit) {
        this.metrics.burstRequests++;
        logger.debug('Burst request allowed', {
          key,
          currentRequests: requests.length,
          currentRequestCount,
          baseLimit: config.maxRequests,
          burstLimit,
        });
        return { allowed: true, reason: 'burst_allowed' };
      }
    }

    // Rate limit exceeded
    const oldestRequest = Math.min(...requests);
    const resetTime = oldestRequest + config.windowMs;
    const burstLimit = Math.floor(
      config.maxRequests * (1 + config.burstAllowance)
    );

    logger.warn('Rate limit exceeded', {
      key,
      currentRequests: requests.length,
      currentRequestCount,
      limit: config.maxRequests,
      burstLimit,
      resetTime: new Date(resetTime).toISOString(),
    });

    return {
      allowed: false,
      reason: 'rate_limit_exceeded',
      requests: requests.length,
      limit: config.maxRequests,
      resetTime,
    };
  }

  /**
   * Check global provider coordination
   * @param {string} provider - Provider name
   * @param {number} now - Current timestamp
   * @returns {Object} Check result
   */
  checkProviderCoordination(provider, now) {
    const providerConfig = this.providerConfigs.get(provider);
    if (!providerConfig) {
      return { allowed: true, reason: 'no_provider_config' };
    }

    const windowStart = now - providerConfig.windowMs;
    let requests = this.globalRequestHistory.get(provider) || [];

    // Remove requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    if (requests.length >= providerConfig.maxRequests) {
      const oldestRequest = Math.min(...requests);
      const resetTime = oldestRequest + providerConfig.windowMs;

      logger.warn('Provider rate limit exceeded', {
        provider,
        requests: requests.length,
        limit: providerConfig.maxRequests,
        resetTime: new Date(resetTime).toISOString(),
      });

      return {
        allowed: false,
        reason: 'provider_limit_exceeded',
        provider,
        requests: requests.length,
        limit: providerConfig.maxRequests,
        resetTime,
      };
    }

    return { allowed: true, reason: 'within_provider_limits' };
  }

  /**
   * Track a request for rate limiting
   * @param {string} key - Rate limit key
   * @param {string} provider - Provider name (optional)
   * @param {number} timestamp - Request timestamp
   */
  trackRequest(key, provider, timestamp) {
    // Track key-specific request
    const keyRequests = this.requestHistory.get(key) || [];
    keyRequests.push(timestamp);
    this.requestHistory.set(key, keyRequests);

    // Track provider-level request for coordination
    if (provider) {
      const providerRequests = this.globalRequestHistory.get(provider) || [];
      providerRequests.push(timestamp);
      this.globalRequestHistory.set(provider, providerRequests);
    }

    logger.debug('Request tracked', { key, provider, timestamp });
  }

  /**
   * Get remaining requests for a key
   * @param {string} key - Rate limit key
   * @param {Object} config - Rate limit configuration
   * @param {number} now - Current timestamp
   * @returns {number} Remaining requests
   */
  getRemainingRequests(key, config, now) {
    const windowStart = now - config.windowMs;
    let requests = this.requestHistory.get(key) || [];
    requests = requests.filter(timestamp => timestamp > windowStart);

    return Math.max(0, config.maxRequests - requests.length);
  }

  /**
   * Get time until rate limit resets for a key
   * @param {string} key - Rate limit key
   * @returns {number} Milliseconds until reset (0 if not rate limited)
   */
  getTimeUntilReset(key) {
    const config = this.rateLimitConfigs.get(key);
    if (!config) {
      return 0;
    }

    const requests = this.requestHistory.get(key) || [];
    if (requests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...requests);
    const resetTime = oldestRequest + config.windowMs;
    const now = Date.now();

    return Math.max(0, resetTime - now);
  }

  /**
   * Wait for rate limit to reset if needed
   * @param {string} key - Rate limit key
   * @param {Object} options - Wait options
   * @returns {Promise} Resolves when safe to proceed
   */
  async waitForRateLimit(key, options = {}) {
    const { maxWaitTime = 60000, checkInterval = 1000 } = options;

    let waitTime = 0;
    while (waitTime < maxWaitTime) {
      const result = this.checkRateLimit(key);
      if (result.allowed) {
        return result;
      }

      const timeUntilReset = this.getTimeUntilReset(key);
      const waitDuration = Math.min(
        checkInterval,
        timeUntilReset,
        maxWaitTime - waitTime
      );

      if (waitDuration <= 0) {
        break;
      }

      logger.debug('Waiting for rate limit reset', {
        key,
        waitDuration,
        timeUntilReset,
      });

      await this.sleep(waitDuration);
      waitTime += waitDuration;
    }

    throw new ServiceError(`Rate limit wait timeout exceeded for key: ${key}`);
  }

  /**
   * Clean up old request history to prevent memory leaks
   * @param {number} maxAge - Maximum age of requests to keep (default: 1 hour)
   */
  cleanup(maxAge = 3600000) {
    const cutoff = Date.now() - maxAge;
    let cleanedKeys = 0;
    let cleanedProviders = 0;

    // Clean key-specific history
    for (const [key, requests] of this.requestHistory.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > cutoff);
      if (filteredRequests.length === 0) {
        this.requestHistory.delete(key);
        cleanedKeys++;
      } else if (filteredRequests.length < requests.length) {
        this.requestHistory.set(key, filteredRequests);
      }
    }

    // Clean provider history
    for (const [provider, requests] of this.globalRequestHistory.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > cutoff);
      if (filteredRequests.length === 0) {
        this.globalRequestHistory.delete(provider);
        cleanedProviders++;
      } else if (filteredRequests.length < requests.length) {
        this.globalRequestHistory.set(provider, filteredRequests);
      }
    }

    if (cleanedKeys > 0 || cleanedProviders > 0) {
      logger.debug('Rate limiter cleanup completed', {
        cleanedKeys,
        cleanedProviders,
        remainingKeys: this.requestHistory.size,
        remainingProviders: this.globalRequestHistory.size,
      });
    }
  }

  /**
   * Get rate limiter metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalRequests > 0
          ? (this.metrics.allowedRequests / this.metrics.totalRequests) * 100
          : 0,
      activeKeys: this.requestHistory.size,
      activeProviders: this.globalRequestHistory.size,
      configuredKeys: this.rateLimitConfigs.size,
      configuredProviders: this.providerConfigs.size,
    };
  }

  /**
   * Reset all rate limiter state
   */
  reset() {
    this.requestHistory.clear();
    this.globalRequestHistory.clear();
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      burstRequests: 0,
      coordinationBlocks: 0,
    };

    logger.info('Rate limiter state reset');
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
