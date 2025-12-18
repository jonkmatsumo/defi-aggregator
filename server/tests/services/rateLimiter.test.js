import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { RateLimiter } from '../../src/services/rateLimiter.js';

/**
 * Property-based tests for RateLimiter
 * **Feature: service-migration-to-backend, Property 6: Rate limiting coordination**
 * **Validates: Requirements 5.2, 5.3**
 */
describe('RateLimiter Property Tests', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      defaultWindow: 1000, // 1 second for faster tests
      defaultMaxRequests: 10,
      coordinationEnabled: true,
      burstAllowance: 0, // No burst by default for predictable tests
    });
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.reset();
    }
  });

  describe('Property 6: Rate limiting coordination', () => {
    test('should coordinate rate limits across multiple keys for the same provider', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 5 }
          ), // Multiple keys
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0), // Provider name
          fc.integer({ min: 1, max: 5 }), // Provider max requests
          fc.integer({ min: 100, max: 1000 }), // Window size
          (keys, provider, providerMaxRequests, windowMs) => {
            // Configure provider-level rate limiting
            rateLimiter.configureProvider(provider, {
              maxRequests: providerMaxRequests,
              windowMs: windowMs,
            });

            // Ensure unique keys and configure each key to use the same provider
            const uniqueKeys = keys.map((key, index) => `${key}_${index}`);
            uniqueKeys.forEach(key => {
              rateLimiter.configure(key, {
                maxRequests: 100, // High individual limit
                windowMs: windowMs,
                provider: provider,
              });
            });

            let totalAllowedRequests = 0;
            let totalBlockedRequests = 0;

            // Make requests across all keys
            for (let i = 0; i < providerMaxRequests + 5; i++) {
              const keyIndex = i % uniqueKeys.length;
              const key = uniqueKeys[keyIndex];

              const result = rateLimiter.checkRateLimit(key);
              if (result && result.allowed) {
                totalAllowedRequests++;
              } else {
                totalBlockedRequests++;
              }
            }

            // The total allowed requests should not exceed the provider limit
            // even though individual keys have higher limits
            expect(totalAllowedRequests).toBeLessThanOrEqual(
              providerMaxRequests
            );

            // There should be some blocked requests if we exceeded the provider limit
            if (providerMaxRequests + 5 > providerMaxRequests) {
              expect(totalBlockedRequests).toBeGreaterThan(0);
            }

            // Verify that provider coordination is working
            const metrics = rateLimiter.getMetrics();
            if (totalBlockedRequests > 0) {
              expect(metrics.coordinationBlocks).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should allow burst requests up to the configured allowance', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0), // Key
          fc.integer({ min: 5, max: 20 }), // Base max requests
          fc
            .float({ min: Math.fround(0.2), max: Math.fround(0.5) })
            .filter(n => !isNaN(n)), // Burst allowance (minimum 20% to ensure at least 1 extra request)
          (key, maxRequests, burstAllowance) => {
            // Create a fresh rate limiter for each test to avoid state pollution
            const testRateLimiter = new RateLimiter({
              defaultWindow: 1000,
              defaultMaxRequests: 10,
              coordinationEnabled: true,
              burstAllowance: 0,
            });

            testRateLimiter.configure(key, {
              maxRequests: maxRequests,
              windowMs: 1000,
              burstAllowance: burstAllowance,
            });

            const expectedBurstLimit = Math.floor(
              maxRequests * (1 + burstAllowance)
            );
            let allowedRequests = 0;

            // Make requests up to burst limit
            for (let i = 0; i < expectedBurstLimit + 2; i++) {
              const result = testRateLimiter.checkRateLimit(key);
              if (result && result.allowed) {
                allowedRequests++;
              }
            }

            // Should allow requests up to burst limit
            expect(allowedRequests).toBeLessThanOrEqual(expectedBurstLimit);
            expect(allowedRequests).toBeGreaterThanOrEqual(maxRequests);

            // Verify burst requests were tracked
            const metrics = testRateLimiter.getMetrics();
            if (allowedRequests > maxRequests) {
              expect(metrics.burstRequests).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should properly reset rate limits after window expires', async () => {
      fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0), // Key
          fc.integer({ min: 2, max: 10 }), // Max requests
          async (key, maxRequests) => {
            const windowMs = 100; // Short window for testing

            rateLimiter.configure(key, {
              maxRequests: maxRequests,
              windowMs: windowMs,
            });

            // Fill up the rate limit
            let initialAllowed = 0;
            for (let i = 0; i < maxRequests + 2; i++) {
              const result = rateLimiter.checkRateLimit(key);
              if (result && result.allowed) {
                initialAllowed++;
              }
            }

            expect(initialAllowed).toBe(maxRequests);

            // Wait for window to expire
            await new Promise(resolve => setTimeout(resolve, windowMs + 10));

            // Should be able to make requests again
            let afterResetAllowed = 0;
            for (let i = 0; i < maxRequests; i++) {
              const result = rateLimiter.checkRateLimit(key);
              if (result && result.allowed) {
                afterResetAllowed++;
              }
            }

            expect(afterResetAllowed).toBe(maxRequests);
          }
        ),
        { numRuns: 50 } // Fewer runs due to async nature
      );
    });

    test('should handle concurrent requests correctly', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0), // Key
          fc.integer({ min: 5, max: 15 }), // Max requests
          fc.integer({ min: 2, max: 5 }), // Number of concurrent batches
          (key, maxRequests, concurrentBatches) => {
            rateLimiter.configure(key, {
              maxRequests: maxRequests,
              windowMs: 1000,
            });

            let totalAllowed = 0;
            const results = [];

            // Simulate concurrent requests
            for (let batch = 0; batch < concurrentBatches; batch++) {
              for (
                let i = 0;
                i < Math.ceil(maxRequests / concurrentBatches) + 1;
                i++
              ) {
                const result = rateLimiter.checkRateLimit(key);
                results.push(result);
                if (result && result.allowed) {
                  totalAllowed++;
                }
              }
            }

            // Total allowed should not exceed max requests
            expect(totalAllowed).toBeLessThanOrEqual(maxRequests);

            // Should have some blocked requests if we made more than max
            const totalRequests = results.length;
            if (totalRequests > maxRequests) {
              const blockedRequests = results.filter(
                r => !r || !r.allowed
              ).length;
              expect(blockedRequests).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain separate rate limits for different keys', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 5 }
          ), // Multiple keys (non-empty after trim)
          fc.integer({ min: 3, max: 10 }), // Max requests per key
          (keys, maxRequests) => {
            // Create a fresh rate limiter for each test to avoid state pollution
            const testRateLimiter = new RateLimiter({
              defaultWindow: 1000,
              defaultMaxRequests: 10,
              coordinationEnabled: true,
              burstAllowance: 0,
            });

            // Ensure unique keys by adding index suffix
            const uniqueKeys = keys.map((key, index) => `${key}_${index}`);

            // Configure rate limits for each key
            uniqueKeys.forEach(key => {
              testRateLimiter.configure(key, {
                maxRequests: maxRequests,
                windowMs: 1000,
              });
            });

            const keyResults = new Map();

            // Make requests for each key
            uniqueKeys.forEach(key => {
              let allowedForKey = 0;
              for (let i = 0; i < maxRequests + 2; i++) {
                const result = testRateLimiter.checkRateLimit(key);
                if (result && result.allowed) {
                  allowedForKey++;
                }
              }
              keyResults.set(key, allowedForKey);
            });

            // Each key should be able to make up to maxRequests
            uniqueKeys.forEach(key => {
              expect(keyResults.get(key)).toBe(maxRequests);
            });

            // Verify that keys are tracked separately
            const metrics = testRateLimiter.getMetrics();
            expect(metrics.activeKeys).toBeGreaterThanOrEqual(
              uniqueKeys.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle invalid configurations gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.integer(),
            fc.object()
          ), // Invalid key
          invalidKey => {
            // Should throw error for invalid key
            expect(() => {
              rateLimiter.configure(invalidKey, {
                maxRequests: 10,
                windowMs: 1000,
              });
            }).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should cleanup old request history to prevent memory leaks', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(s => s.trim().length > 0),
            { minLength: 5, maxLength: 20 }
          ), // Multiple keys
          fc.integer({ min: 1, max: 5 }), // Requests per key
          (keys, requestsPerKey) => {
            // Configure keys and make requests
            keys.forEach(key => {
              rateLimiter.configure(key, {
                maxRequests: requestsPerKey + 10, // High limit to allow all requests
                windowMs: 1000,
              });

              // Make requests
              for (let i = 0; i < requestsPerKey; i++) {
                rateLimiter.checkRateLimit(key);
              }
            });

            const initialMetrics = rateLimiter.getMetrics();
            const initialActiveKeys = initialMetrics.activeKeys;

            // Cleanup with very short max age (should remove all history)
            rateLimiter.cleanup(1); // 1ms max age

            const afterCleanupMetrics = rateLimiter.getMetrics();
            const afterCleanupActiveKeys = afterCleanupMetrics.activeKeys;

            // Should have fewer or equal active keys after cleanup
            expect(afterCleanupActiveKeys).toBeLessThanOrEqual(
              initialActiveKeys
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Unit Tests for Rate Limiting Coordination', () => {
    test('should create rate limiter with default configuration', () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeDefined();
      expect(limiter.config.defaultWindow).toBe(60000);
      expect(limiter.config.defaultMaxRequests).toBe(100);
    });

    test('should configure rate limit for specific key', () => {
      rateLimiter.configure('test-key', {
        maxRequests: 5,
        windowMs: 1000,
        provider: 'test-provider',
      });

      // Should allow up to 5 requests
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkRateLimit('test-key');
        expect(result.allowed).toBe(true);
      }

      // 6th request should be blocked
      const result = rateLimiter.checkRateLimit('test-key');
      expect(result.allowed).toBe(false);
    });

    test('should configure provider-level rate limiting', () => {
      rateLimiter.configureProvider('test-provider', {
        maxRequests: 3,
        windowMs: 1000,
      });

      rateLimiter.configure('key1', {
        maxRequests: 10,
        windowMs: 1000,
        provider: 'test-provider',
      });

      rateLimiter.configure('key2', {
        maxRequests: 10,
        windowMs: 1000,
        provider: 'test-provider',
      });

      // Should allow only 3 requests total across both keys
      expect(rateLimiter.checkRateLimit('key1').allowed).toBe(true);
      expect(rateLimiter.checkRateLimit('key2').allowed).toBe(true);
      expect(rateLimiter.checkRateLimit('key1').allowed).toBe(true);
      expect(rateLimiter.checkRateLimit('key2').allowed).toBe(false); // Provider limit exceeded
    });

    test('should return detailed metrics', () => {
      rateLimiter.configure('test-key', { maxRequests: 5, windowMs: 1000 });

      // Make some requests
      rateLimiter.checkRateLimit('test-key');
      rateLimiter.checkRateLimit('test-key');

      const metrics = rateLimiter.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.allowedRequests).toBe(2);
      expect(metrics.blockedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
    });

    test('should handle burst allowance correctly', () => {
      rateLimiter.configure('burst-key', {
        maxRequests: 5,
        windowMs: 1000,
        burstAllowance: 0.4, // 40% burst = 2 extra requests
      });

      // Should allow 5 base + 2 burst = 7 requests
      for (let i = 0; i < 7; i++) {
        const result = rateLimiter.checkRateLimit('burst-key');
        expect(result.allowed).toBe(true);
      }

      // 8th request should be blocked
      const result = rateLimiter.checkRateLimit('burst-key');
      expect(result.allowed).toBe(false);

      const metrics = rateLimiter.getMetrics();
      expect(metrics.burstRequests).toBe(2);
    });
  });
});
