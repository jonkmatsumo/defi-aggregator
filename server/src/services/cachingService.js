import { LRUCache } from './lruCache.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Intelligent caching service with multiple strategies
 * Provides advanced caching capabilities to minimize API usage
 */
export class CachingService {
  constructor(config = {}) {
    this.config = {
      defaultStrategy: 'lru',
      maxCaches: 10,
      globalMaxSize: 5000,
      globalMaxMemoryMB: 500,
      compressionEnabled: false,
      persistenceEnabled: false,
      ...config
    };

    // Multiple cache instances for different data types
    this.caches = new Map(); // cacheName -> LRUCache instance
    this.strategies = new Map(); // cacheName -> strategy config
    
    // Global metrics
    this.globalMetrics = {
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      totalEvictions: 0,
      cacheCount: 0
    };

    // Predefined cache configurations for different data types
    this.predefinedConfigs = {
      gas_prices: {
        maxSize: 100,
        defaultTTL: 300000, // 5 minutes
        strategy: 'time_based',
        priority: 'high'
      },
      lending_rates: {
        maxSize: 200,
        defaultTTL: 300000, // 5 minutes
        strategy: 'time_based',
        priority: 'high'
      },
      crypto_prices: {
        maxSize: 500,
        defaultTTL: 60000, // 1 minute
        strategy: 'frequency_based',
        priority: 'high'
      },
      token_balances: {
        maxSize: 1000,
        defaultTTL: 30000, // 30 seconds
        strategy: 'user_based',
        priority: 'medium'
      },
      api_responses: {
        maxSize: 2000,
        defaultTTL: 600000, // 10 minutes
        strategy: 'lru',
        priority: 'low'
      }
    };

    logger.info('CachingService initialized', { 
      defaultStrategy: this.config.defaultStrategy,
      maxCaches: this.config.maxCaches,
      predefinedConfigs: Object.keys(this.predefinedConfigs).length
    });
  }

  /**
   * Get or create cache instance
   * @param {string} cacheName - Name of the cache
   * @param {Object} config - Cache configuration (optional)
   * @returns {LRUCache} Cache instance
   */
  getCache(cacheName, config = {}) {
    if (this.caches.has(cacheName)) {
      return this.caches.get(cacheName);
    }

    if (this.caches.size >= this.config.maxCaches) {
      throw new ServiceError(`Maximum number of caches (${this.config.maxCaches}) exceeded`);
    }

    // Use predefined config if available
    const predefinedConfig = this.predefinedConfigs[cacheName] || {};
    const finalConfig = { ...predefinedConfig, ...config };

    // Create new cache instance
    const cache = new LRUCache({
      maxSize: finalConfig.maxSize || 1000,
      defaultTTL: finalConfig.defaultTTL || 300000,
      maxMemoryMB: finalConfig.maxMemoryMB || 50,
      ...finalConfig
    });

    this.caches.set(cacheName, cache);
    this.strategies.set(cacheName, {
      strategy: finalConfig.strategy || this.config.defaultStrategy,
      priority: finalConfig.priority || 'medium',
      ...finalConfig
    });

    this.globalMetrics.cacheCount++;

    logger.debug('Cache created', { 
      cacheName, 
      strategy: finalConfig.strategy,
      maxSize: finalConfig.maxSize,
      defaultTTL: finalConfig.defaultTTL
    });

    return cache;
  }

  /**
   * Get value from cache with intelligent strategy
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key
   * @param {Object} options - Additional options
   * @returns {*} Cached value or null
   */
  get(cacheName, key, options = {}) {
    const cache = this.getCache(cacheName);
    const strategy = this.strategies.get(cacheName);

    // Apply strategy-specific logic before getting
    this.applyGetStrategy(cacheName, key, strategy, options);

    const value = cache.get(key);
    
    // Update global metrics
    if (value !== null) {
      this.globalMetrics.totalHits++;
    } else {
      this.globalMetrics.totalMisses++;
    }

    return value;
  }

  /**
   * Set value in cache with intelligent strategy
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Additional options
   */
  set(cacheName, key, value, options = {}) {
    const cache = this.getCache(cacheName);
    const strategy = this.strategies.get(cacheName);

    // Apply strategy-specific logic before setting
    const { ttl, shouldCache } = this.applySetStrategy(cacheName, key, value, strategy, options);

    if (!shouldCache) {
      logger.debug('Caching skipped by strategy', { cacheName, key, strategy: strategy.strategy });
      return;
    }

    cache.set(key, value, ttl);
    this.globalMetrics.totalSets++;

    // Check global memory constraints
    this.enforceGlobalConstraints();
  }

  /**
   * Delete value from cache
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(cacheName, key) {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return false;
    }

    return cache.delete(key);
  }

  /**
   * Check if key exists in cache
   * @param {string} cacheName - Name of the cache
   * @param {string} key - Cache key
   * @returns {boolean} True if exists
   */
  has(cacheName, key) {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return false;
    }

    return cache.has(key);
  }

  /**
   * Clear specific cache or all caches
   * @param {string} cacheName - Name of the cache (optional)
   */
  clear(cacheName = null) {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (cache) {
        cache.clear();
        logger.info('Cache cleared', { cacheName });
      }
    } else {
      for (const [name, cache] of this.caches.entries()) {
        cache.clear();
      }
      logger.info('All caches cleared');
    }
  }

  /**
   * Apply get strategy logic
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {Object} strategy - Strategy configuration
   * @param {Object} options - Additional options
   */
  applyGetStrategy(cacheName, key, strategy, options) {
    switch (strategy.strategy) {
    case 'frequency_based':
      // Track access frequency for popular items
      this.trackAccess(cacheName, key);
      break;
    
    case 'time_based':
      // Check if we should refresh based on time patterns
      this.checkTimeBasedRefresh(cacheName, key, options);
      break;
    
    case 'user_based':
      // Apply user-specific caching logic
      this.applyUserBasedLogic(cacheName, key, options);
      break;
    
    default:
      // Default LRU strategy - no additional logic needed
      break;
    }
  }

  /**
   * Apply set strategy logic
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} strategy - Strategy configuration
   * @param {Object} options - Additional options
   * @returns {Object} Strategy result with ttl and shouldCache
   */
  applySetStrategy(cacheName, key, value, strategy, options) {
    let ttl = options.ttl || strategy.defaultTTL;
    let shouldCache = true;

    switch (strategy.strategy) {
    case 'frequency_based':
      // Adjust TTL based on access frequency
      const accessCount = this.getAccessCount(cacheName, key);
      if (accessCount > 10) {
        ttl = ttl * 2; // Cache popular items longer
      } else if (accessCount === 0) {
        ttl = ttl * 0.5; // Cache new items for shorter time
      }
      break;
    
    case 'time_based':
      // Adjust TTL based on time of day or data volatility
      ttl = this.calculateTimeBasedTTL(cacheName, key, value, strategy);
      break;
    
    case 'user_based':
      // Apply user-specific caching rules
      const userResult = this.applyUserCachingRules(cacheName, key, value, options);
      ttl = userResult.ttl;
      shouldCache = userResult.shouldCache;
      break;
    
    case 'conditional':
      // Only cache if certain conditions are met
      shouldCache = this.evaluateCachingConditions(cacheName, key, value, options);
      break;
    
    default:
      // Default strategy - use provided or default TTL
      break;
    }

    return { ttl, shouldCache };
  }

  /**
   * Track access frequency for frequency-based strategy
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   */
  trackAccess(cacheName, key) {
    const accessKey = `${cacheName}:${key}:access`;
    const accessCache = this.getCache('access_tracking', { maxSize: 10000, defaultTTL: 3600000 });
    
    const currentCount = accessCache.get(accessKey) || 0;
    accessCache.set(accessKey, currentCount + 1);
  }

  /**
   * Get access count for a key
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @returns {number} Access count
   */
  getAccessCount(cacheName, key) {
    const accessKey = `${cacheName}:${key}:access`;
    const accessCache = this.caches.get('access_tracking');
    
    if (!accessCache) {
      return 0;
    }

    return accessCache.get(accessKey) || 0;
  }

  /**
   * Check if time-based refresh is needed
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {Object} options - Options
   */
  checkTimeBasedRefresh(cacheName, key, options) {
    // Implementation for time-based refresh logic
    // This could check market hours, volatility periods, etc.
    const now = new Date();
    const hour = now.getHours();
    
    // Example: Refresh crypto prices more frequently during market hours
    if (cacheName === 'crypto_prices' && (hour >= 9 && hour <= 16)) {
      // Market hours - might want to refresh more frequently
      logger.debug('Market hours detected for crypto prices', { hour });
    }
  }

  /**
   * Apply user-based caching logic
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {Object} options - Options
   */
  applyUserBasedLogic(cacheName, key, options) {
    // Implementation for user-specific caching
    // This could consider user preferences, subscription level, etc.
    if (options.userId) {
      logger.debug('User-based caching applied', { cacheName, key, userId: options.userId });
    }
  }

  /**
   * Calculate time-based TTL
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {*} value - Value being cached
   * @param {Object} strategy - Strategy configuration
   * @returns {number} Calculated TTL
   */
  calculateTimeBasedTTL(cacheName, key, value, strategy) {
    let baseTTL = strategy.defaultTTL;
    
    // Adjust based on data type and current time
    const now = new Date();
    const hour = now.getHours();
    
    if (cacheName === 'crypto_prices') {
      // Shorter TTL during volatile periods
      if (hour >= 9 && hour <= 16) {
        baseTTL = baseTTL * 0.5; // 50% shorter during market hours
      }
    } else if (cacheName === 'gas_prices') {
      // Shorter TTL during network congestion (simplified logic)
      if (value && value.gasPrices && value.gasPrices.fast && value.gasPrices.fast.gwei > 50) {
        baseTTL = baseTTL * 0.3; // Much shorter during high gas periods
      }
    }
    
    return baseTTL;
  }

  /**
   * Apply user-specific caching rules
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {*} value - Value being cached
   * @param {Object} options - Options
   * @returns {Object} User caching result
   */
  applyUserCachingRules(cacheName, key, value, options) {
    let ttl = options.ttl || 300000; // Default 5 minutes
    let shouldCache = true;
    
    // Example user-based rules
    if (options.userTier === 'premium') {
      ttl = ttl * 0.5; // Premium users get fresher data
    } else if (options.userTier === 'free') {
      ttl = ttl * 2; // Free users get longer cached data
    }
    
    // Don't cache sensitive user data for too long
    if (cacheName === 'token_balances' && options.userId) {
      ttl = Math.min(ttl, 30000); // Max 30 seconds for balance data
    }
    
    return { ttl, shouldCache };
  }

  /**
   * Evaluate caching conditions
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {*} value - Value being cached
   * @param {Object} options - Options
   * @returns {boolean} Whether to cache
   */
  evaluateCachingConditions(cacheName, key, value, options) {
    // Example conditions
    if (!value || value === null) {
      return false; // Don't cache null values
    }
    
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return false; // Don't cache empty objects
    }
    
    if (options.skipCache) {
      return false; // Explicit skip cache flag
    }
    
    return true;
  }

  /**
   * Enforce global memory and size constraints
   */
  enforceGlobalConstraints() {
    const totalMemory = this.getTotalMemoryUsage();
    const totalSize = this.getTotalSize();
    
    if (totalMemory > this.config.globalMaxMemoryMB || totalSize > this.config.globalMaxSize) {
      this.performGlobalEviction();
    }
  }

  /**
   * Perform global eviction across all caches
   */
  performGlobalEviction() {
    // Sort caches by priority (low priority evicted first)
    const cachesByPriority = Array.from(this.caches.entries())
      .map(([name, cache]) => ({
        name,
        cache,
        priority: this.strategies.get(name)?.priority || 'medium',
        size: cache.cache.size
      }))
      .sort((a, b) => {
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    // Evict from low priority caches first
    for (const { name, cache } of cachesByPriority) {
      if (cache.cache.size > 0) {
        // Evict 10% of entries from this cache
        const evictCount = Math.max(1, Math.floor(cache.cache.size * 0.1));
        for (let i = 0; i < evictCount; i++) {
          cache.evictLRU('global_constraint');
          this.globalMetrics.totalEvictions++;
        }
        
        logger.debug('Global eviction performed', { 
          cacheName: name, 
          evictedCount: evictCount 
        });
        
        // Check if we've freed enough space
        if (this.getTotalMemoryUsage() <= this.config.globalMaxMemoryMB && 
            this.getTotalSize() <= this.config.globalMaxSize) {
          break;
        }
      }
    }
  }

  /**
   * Get total memory usage across all caches
   * @returns {number} Total memory usage in MB
   */
  getTotalMemoryUsage() {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.getMemoryUsage();
    }
    return total;
  }

  /**
   * Get total size across all caches
   * @returns {number} Total number of cached entries
   */
  getTotalSize() {
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.cache.size;
    }
    return total;
  }

  /**
   * Get comprehensive caching statistics
   * @returns {Object} Caching statistics
   */
  getStats() {
    const cacheStats = {};
    let totalHitRate = 0;
    let totalMemory = 0;
    let totalEntries = 0;

    for (const [name, cache] of this.caches.entries()) {
      const stats = cache.getStats();
      cacheStats[name] = {
        ...stats,
        strategy: this.strategies.get(name)?.strategy || 'unknown'
      };
      totalMemory += stats.memoryUsageMB;
      totalEntries += stats.size;
    }

    const globalHitRate = this.globalMetrics.totalHits + this.globalMetrics.totalMisses > 0
      ? (this.globalMetrics.totalHits / (this.globalMetrics.totalHits + this.globalMetrics.totalMisses)) * 100
      : 0;

    return {
      global: {
        ...this.globalMetrics,
        hitRate: globalHitRate,
        totalMemoryMB: totalMemory,
        totalEntries,
        cacheCount: this.caches.size
      },
      caches: cacheStats
    };
  }

  /**
   * Cleanup all caches and remove expired entries
   */
  cleanup() {
    for (const [name, cache] of this.caches.entries()) {
      cache.cleanup();
    }
    
    logger.debug('Global cache cleanup completed');
  }

  /**
   * Destroy caching service and cleanup resources
   */
  destroy() {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    
    this.caches.clear();
    this.strategies.clear();
    
    logger.info('CachingService destroyed');
  }
}