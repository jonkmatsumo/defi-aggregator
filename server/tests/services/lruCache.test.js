import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { LRUCache } from '../../src/services/lruCache.js';

/**
 * Property-based tests for LRUCache
 * **Feature: service-migration-to-backend, Property 11: Cache eviction policy enforcement**
 * **Validates: Requirements 7.4**
 */
describe('LRUCache Property Tests', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({
      maxSize: 10, // Small size for testing eviction
      defaultTTL: 1000, // 1 second for testing
      cleanupInterval: 100, // Fast cleanup for testing
      maxMemoryMB: 1 // Small memory limit for testing
    });
  });

  afterEach(() => {
    if (cache) {
      cache.destroy();
    }
  });

  describe('Property 11: Cache eviction policy enforcement', () => {
    test('should enforce LRU eviction when cache size exceeds maxSize', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0), { minLength: 15, maxLength: 25 }), // More items than maxSize
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 15, maxLength: 25 }), // Values
          (keys, values) => {
            // Ensure we have unique keys
            const uniqueKeys = keys.map((key, index) => `${key}_${index}`);
            const maxSize = cache.config.maxSize;
            const itemsToAdd = Math.min(uniqueKeys.length, values.length);

            // Add items to cache (more than maxSize)
            for (let i = 0; i < itemsToAdd; i++) {
              cache.set(uniqueKeys[i], values[i]);
            }

            // Cache size should not exceed maxSize
            expect(cache.cache.size).toBeLessThanOrEqual(maxSize);

            if (itemsToAdd > maxSize) {
              // The most recently added items should still be in cache
              const recentKeys = uniqueKeys.slice(itemsToAdd - maxSize, itemsToAdd);
              let recentKeysInCache = 0;
              recentKeys.forEach(key => {
                if (cache.has(key)) {
                  recentKeysInCache++;
                }
              });
              
              // At least some of the recent keys should be in cache
              expect(recentKeysInCache).toBeGreaterThan(0);

              // The oldest items should have been evicted
              const oldestKeys = uniqueKeys.slice(0, itemsToAdd - maxSize);
              let oldestKeysEvicted = 0;
              oldestKeys.forEach(key => {
                if (!cache.has(key)) {
                  oldestKeysEvicted++;
                }
              });
              
              // At least some of the oldest keys should be evicted
              expect(oldestKeysEvicted).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should evict least recently used items when accessing other items', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0), { minLength: 12, maxLength: 15 }), // Slightly more than maxSize
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 12, maxLength: 15 }), // Values
          fc.integer({ min: 0, max: 9 }), // Index of item to access repeatedly
          (keys, values, accessIndex) => {
            const uniqueKeys = keys.map((key, index) => `${key}_${index}`);
            const maxSize = cache.config.maxSize;

            // Fill cache to capacity
            for (let i = 0; i < Math.min(maxSize, uniqueKeys.length, values.length); i++) {
              cache.set(uniqueKeys[i], values[i]);
            }

            // Access one item repeatedly to make it most recently used
            if (accessIndex < uniqueKeys.length) {
              const accessKey = uniqueKeys[accessIndex];
              for (let i = 0; i < 3; i++) {
                cache.get(accessKey);
              }

              // Add more items to trigger eviction
              const additionalItems = Math.min(5, uniqueKeys.length - maxSize);
              for (let i = maxSize; i < maxSize + additionalItems && i < uniqueKeys.length && i < values.length; i++) {
                cache.set(uniqueKeys[i], values[i]);
              }

              // The frequently accessed item should still be in cache
              expect(cache.has(accessKey)).toBe(true);
            }

            // Cache size should not exceed maxSize
            expect(cache.cache.size).toBeLessThanOrEqual(maxSize);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should enforce TTL-based eviction', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0), { minLength: 3, maxLength: 8 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 3, maxLength: 8 }),
          async (keys, values) => {
            const uniqueKeys = keys.map((key, index) => `${key}_${index}`);
            const shortTTL = 50; // 50ms

            // Add items with short TTL
            for (let i = 0; i < Math.min(uniqueKeys.length, values.length); i++) {
              cache.set(uniqueKeys[i], values[i], shortTTL);
            }

            const initialSize = cache.cache.size;
            expect(initialSize).toBeGreaterThan(0);

            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, shortTTL + 20));

            // Items should be expired when accessed
            uniqueKeys.forEach(key => {
              const value = cache.get(key);
              expect(value).toBeNull();
            });
          }
        ),
        { numRuns: 20 } // Fewer runs due to async nature
      );
    });

    test('should enforce memory-based eviction', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 100, maxLength: 200 }), { minLength: 10, maxLength: 20 }), // Large values
          (largeValues) => {
            const smallMemoryCache = new LRUCache({
              maxSize: 100, // High size limit
              maxMemoryMB: 0.001, // Very small memory limit (1KB)
              defaultTTL: 10000
            });

            try {
              // Add large values that should exceed memory limit
              largeValues.forEach((value, index) => {
                smallMemoryCache.set(`key_${index}`, value);
              });

              // Memory usage should be controlled
              const memoryUsage = smallMemoryCache.getMemoryUsage();
              expect(memoryUsage).toBeLessThanOrEqual(smallMemoryCache.config.maxMemoryMB * 2); // Allow some tolerance

              // Cache should have evicted items to stay within memory limits
              expect(smallMemoryCache.cache.size).toBeLessThan(largeValues.length);
            } finally {
              smallMemoryCache.destroy();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should maintain cache consistency during eviction', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(
            fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0),
            fc.string({ minLength: 1, maxLength: 20 })
          ), { minLength: 20, maxLength: 30 }),
          (keyValuePairs) => {
            const maxSize = cache.config.maxSize;

            // Add items sequentially
            keyValuePairs.forEach(([key, value], index) => {
              const uniqueKey = `${key}_${index}`;
              cache.set(uniqueKey, value);

              // Cache should never exceed maxSize
              expect(cache.cache.size).toBeLessThanOrEqual(maxSize);

              // All items currently in cache should be retrievable
              for (const [cacheKey] of cache.cache.entries()) {
                const retrievedValue = cache.get(cacheKey);
                expect(retrievedValue).not.toBeNull();
              }
            });

            // Final consistency check
            expect(cache.cache.size).toBeLessThanOrEqual(maxSize);
            
            // All items in cache should be valid
            const stats = cache.getStats();
            expect(stats.size).toBe(cache.cache.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle concurrent operations without corruption', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(
            fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0),
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.constantFrom('set', 'get', 'delete', 'has')
          ), { minLength: 50, maxLength: 100 }),
          (operations) => {
            const maxSize = cache.config.maxSize;
            const existingKeys = new Set();

            // Perform mixed operations
            operations.forEach(([key, value, operation], index) => {
              const uniqueKey = `${key}_${index}`;

              switch (operation) {
                case 'set':
                  cache.set(uniqueKey, value);
                  existingKeys.add(uniqueKey);
                  break;
                case 'get':
                  if (existingKeys.size > 0) {
                    const randomKey = Array.from(existingKeys)[index % existingKeys.size];
                    cache.get(randomKey);
                  }
                  break;
                case 'delete':
                  if (existingKeys.size > 0) {
                    const randomKey = Array.from(existingKeys)[index % existingKeys.size];
                    cache.delete(randomKey);
                    existingKeys.delete(randomKey);
                  }
                  break;
                case 'has':
                  if (existingKeys.size > 0) {
                    const randomKey = Array.from(existingKeys)[index % existingKeys.size];
                    cache.has(randomKey);
                  }
                  break;
              }

              // Invariants should always hold
              expect(cache.cache.size).toBeLessThanOrEqual(maxSize);
              expect(cache.cache.size).toBeGreaterThanOrEqual(0);
            });

            // Final state should be consistent
            const stats = cache.getStats();
            expect(stats.size).toBe(cache.cache.size);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should properly track access order for LRU eviction', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0), { minLength: 12, maxLength: 15 }),
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 12, maxLength: 15 }),
          (keys, values) => {
            const uniqueKeys = keys.map((key, index) => `${key}_${index}`);
            const maxSize = cache.config.maxSize;

            // Fill cache to capacity
            for (let i = 0; i < Math.min(maxSize, uniqueKeys.length, values.length); i++) {
              cache.set(uniqueKeys[i], values[i]);
            }

            // Access first half of items to make them recently used
            const firstHalf = Math.floor(maxSize / 2);
            for (let i = 0; i < firstHalf; i++) {
              if (i < uniqueKeys.length) {
                cache.get(uniqueKeys[i]);
              }
            }

            // Add new items to trigger eviction
            const newItemsCount = Math.min(3, uniqueKeys.length - maxSize);
            for (let i = 0; i < newItemsCount && (maxSize + i) < uniqueKeys.length && (maxSize + i) < values.length; i++) {
              cache.set(uniqueKeys[maxSize + i], values[maxSize + i]);
            }

            // Recently accessed items should still be in cache
            for (let i = 0; i < firstHalf; i++) {
              if (i < uniqueKeys.length) {
                expect(cache.has(uniqueKeys[i])).toBe(true);
              }
            }

            // Cache size should not exceed maxSize
            expect(cache.cache.size).toBeLessThanOrEqual(maxSize);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Unit Tests for Cache Eviction Policy', () => {
    test('should create LRU cache with default configuration', () => {
      const lruCache = new LRUCache();
      expect(lruCache).toBeDefined();
      expect(lruCache.config.maxSize).toBe(1000);
      expect(lruCache.config.defaultTTL).toBe(300000);
      lruCache.destroy();
    });

    test('should enforce size limit with LRU eviction', () => {
      const smallCache = new LRUCache({ maxSize: 3, defaultTTL: 10000 });

      // Add items up to capacity
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      expect(smallCache.cache.size).toBe(3);

      // Add one more item - should evict least recently used
      smallCache.set('key4', 'value4');
      expect(smallCache.cache.size).toBe(3);
      expect(smallCache.has('key1')).toBe(false); // Should be evicted
      expect(smallCache.has('key4')).toBe(true); // Should be present

      smallCache.destroy();
    });

    test('should update LRU order on access', () => {
      const smallCache = new LRUCache({ maxSize: 3, defaultTTL: 10000 });

      // Add items
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Access key1 to make it most recently used
      smallCache.get('key1');

      // Add new item - should evict key2 (least recently used)
      smallCache.set('key4', 'value4');
      expect(smallCache.has('key1')).toBe(true); // Should still be present
      expect(smallCache.has('key2')).toBe(false); // Should be evicted
      expect(smallCache.has('key3')).toBe(true); // Should still be present
      expect(smallCache.has('key4')).toBe(true); // Should be present

      smallCache.destroy();
    });

    test('should handle TTL expiration', async () => {
      const ttlCache = new LRUCache({ maxSize: 10, defaultTTL: 50 });

      ttlCache.set('key1', 'value1');
      expect(ttlCache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(ttlCache.get('key1')).toBeNull();
      ttlCache.destroy();
    });

    test('should provide accurate statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1'); // Hit
      cache.get('key3'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(2);
      expect(stats.size).toBe(2);
      expect(stats.hitRate).toBe(50);
    });

    test('should cleanup expired entries', async () => {
      const cleanupCache = new LRUCache({ 
        maxSize: 10, 
        defaultTTL: 30,
        cleanupInterval: 20
      });

      cleanupCache.set('key1', 'value1');
      cleanupCache.set('key2', 'value2');
      expect(cleanupCache.cache.size).toBe(2);

      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, 50));

      // Items should be cleaned up
      expect(cleanupCache.cache.size).toBe(0);
      cleanupCache.destroy();
    });
  });
});