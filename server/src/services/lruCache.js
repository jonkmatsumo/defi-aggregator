import { logger } from '../utils/logger.js';


/**
 * LRU (Least Recently Used) Cache implementation with TTL support
 * Provides intelligent cache eviction policies for memory management
 */
export class LRUCache {
  constructor(config = {}) {
    this.config = {
      maxSize: 1000, // Maximum number of entries
      defaultTTL: 300000, // 5 minutes default TTL
      cleanupInterval: 60000, // 1 minute cleanup interval
      maxMemoryMB: 100, // Maximum memory usage in MB
      ...config
    };

    // Cache storage
    this.cache = new Map(); // key -> { value, timestamp, ttl, accessCount, lastAccess }
    this.accessOrder = new Map(); // key -> linkedListNode for LRU tracking

    // Doubly linked list for LRU tracking
    this.head = { key: null, prev: null, next: null };
    this.tail = { key: null, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;

    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      ttlEvictions: 0,
      sizeEvictions: 0,
      memoryEvictions: 0,
      cleanups: 0
    };

    // Start cleanup interval
    this.startCleanupInterval();

    logger.debug('LRUCache initialized', {
      maxSize: this.config.maxSize,
      defaultTTL: this.config.defaultTTL,
      maxMemoryMB: this.config.maxMemoryMB
    });
  }

  /**
   * Start the cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Unref the timer so it doesn't prevent process exit if it's the only thing running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check TTL expiration
    const now = Date.now();
    if (entry.ttl > 0 && (now - entry.timestamp) > entry.ttl) {
      this.delete(key);
      this.metrics.misses++;
      this.metrics.ttlEvictions++;
      logger.debug('Cache entry expired', { key, age: now - entry.timestamp, ttl: entry.ttl });
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = now;
    this.moveToHead(key);

    this.metrics.hits++;
    logger.debug('Cache hit', { key, accessCount: entry.accessCount });

    return entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    const now = Date.now();
    const effectiveTTL = ttl !== null ? ttl : this.config.defaultTTL;

    // Check if key already exists
    if (this.cache.has(key)) {
      // Update existing entry
      const entry = this.cache.get(key);
      entry.value = value;
      entry.timestamp = now;
      entry.ttl = effectiveTTL;
      entry.lastAccess = now;
      this.moveToHead(key);
    } else {
      // Add new entry
      const entry = {
        value,
        timestamp: now,
        ttl: effectiveTTL,
        accessCount: 1,
        lastAccess: now,
        size: this.estimateSize(value)
      };

      this.cache.set(key, entry);
      this.addToHead(key);

      // Check if we need to evict entries
      this.enforceConstraints();
    }

    this.metrics.sets++;
    logger.debug('Cache set', { key, ttl: effectiveTTL, cacheSize: this.cache.size });
  }

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was deleted
   */
  delete(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.removeFromList(key);

    logger.debug('Cache entry deleted', { key });
    return true;
  }

  /**
   * Check if key exists in cache (without updating access)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check TTL expiration
    const now = Date.now();
    if (entry.ttl > 0 && (now - entry.timestamp) > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();

    // Reset linked list
    this.head.next = this.tail;
    this.tail.prev = this.head;

    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
      : 0;

    return {
      ...this.metrics,
      hitRate,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsageMB: this.getMemoryUsage(),
      maxMemoryMB: this.config.maxMemoryMB
    };
  }

  /**
   * Enforce cache size and memory constraints
   */
  enforceConstraints() {
    // Enforce size constraint
    while (this.cache.size > this.config.maxSize) {
      this.evictLRU('size_limit');
    }

    // Enforce memory constraint
    const memoryUsage = this.getMemoryUsage();
    while (memoryUsage > this.config.maxMemoryMB && this.cache.size > 0) {
      this.evictLRU('memory_limit');
    }
  }

  /**
   * Evict least recently used entry
   * @param {string} reason - Reason for eviction
   */
  evictLRU(reason = 'lru') {
    const lruKey = this.tail.prev?.key;
    if (!lruKey || lruKey === null) {
      return;
    }

    this.delete(lruKey);
    this.metrics.evictions++;

    if (reason === 'size_limit') {
      this.metrics.sizeEvictions++;
    } else if (reason === 'memory_limit') {
      this.metrics.memoryEvictions++;
    }

    logger.debug('LRU eviction', { key: lruKey, reason, remainingSize: this.cache.size });
  }

  /**
   * Move key to head of access list (most recently used)
   * @param {string} key - Cache key
   */
  moveToHead(key) {
    const node = this.accessOrder.get(key);
    if (!node) {
      return;
    }

    // Remove from current position
    this.removeNodeFromList(node);

    // Add to head
    this.addNodeToHead(node);
  }

  /**
   * Add key to head of access list
   * @param {string} key - Cache key
   */
  addToHead(key) {
    const node = { key, prev: null, next: null };
    this.accessOrder.set(key, node);
    this.addNodeToHead(node);
  }

  /**
   * Remove key from access list
   * @param {string} key - Cache key
   */
  removeFromList(key) {
    const node = this.accessOrder.get(key);
    if (node) {
      this.removeNodeFromList(node);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Add node to head of linked list
   * @param {Object} node - List node
   */
  addNodeToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Remove node from linked list
   * @param {Object} node - List node
   */
  removeNodeFromList(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl > 0 && (now - entry.timestamp) > entry.ttl) {
        this.delete(key);
        expiredCount++;
        this.metrics.ttlEvictions++;
      }
    }

    if (expiredCount > 0) {
      this.metrics.cleanups++;
      logger.debug('Cache cleanup completed', {
        expiredEntries: expiredCount,
        remainingEntries: this.cache.size
      });
    }
  }

  /**
   * Estimate memory usage of cache
   * @returns {number} Estimated memory usage in MB
   */
  getMemoryUsage() {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.size || 0;
    }

    // Add overhead for Map structures and metadata
    const overhead = this.cache.size * 200; // Estimated 200 bytes overhead per entry

    return (totalSize + overhead) / (1024 * 1024); // Convert to MB
  }

  /**
   * Estimate size of a value in bytes
   * @param {*} value - Value to estimate
   * @returns {number} Estimated size in bytes
   */
  estimateSize(value) {
    if (value === null || value === undefined) {
      return 8;
    }

    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 encoding
    }

    if (typeof value === 'number') {
      return 8;
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 24); // Array overhead
    }

    if (typeof value === 'object') {
      try {
        const jsonString = JSON.stringify(value);
        return jsonString.length * 2 + 24; // Object overhead
      } catch (error) {
        return 100; // Fallback estimate
      }
    }

    return 50; // Default estimate for unknown types
  }

  /**
   * Get keys sorted by access frequency (most accessed first)
   * @param {number} limit - Maximum number of keys to return
   * @returns {Array} Array of {key, accessCount, lastAccess}
   */
  getMostAccessedKeys(limit = 10) {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccess: entry.lastAccess
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return entries;
  }

  /**
   * Get keys that will expire soon
   * @param {number} withinMs - Time window in milliseconds
   * @returns {Array} Array of {key, expiresIn}
   */
  getExpiringKeys(withinMs = 60000) {
    const now = Date.now();
    const entries = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl > 0) {
        const expiresIn = entry.ttl - (now - entry.timestamp);
        if (expiresIn > 0 && expiresIn <= withinMs) {
          entries.push({ key, expiresIn });
        }
      }
    }

    return entries.sort((a, b) => a.expiresIn - b.expiresIn);
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clear();
    logger.info('LRUCache destroyed');
  }
}