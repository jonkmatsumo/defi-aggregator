import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fc from 'fast-check';
import { APIClient } from '../../src/services/apiClient.js';
import { ServiceError } from '../../src/utils/errors.js';

describe('APIClient', () => {
  let apiClient;

  beforeEach(() => {
    apiClient = new APIClient({
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Credential Management', () => {
    test('should store and retrieve credentials securely', () => {
      const provider = 'testProvider';
      const credentials = { apiKey: 'test-key', secret: 'test-secret' };

      apiClient.setCredentials(provider, credentials);
      const retrieved = apiClient.getCredentials(provider);

      expect(retrieved).toEqual(credentials);
      expect(retrieved).not.toBe(credentials); // Should be a copy
    });

    test('should throw error for invalid provider name', () => {
      expect(() => {
        apiClient.setCredentials('', { apiKey: 'test' });
      }).toThrow(ServiceError);

      expect(() => {
        apiClient.setCredentials(null, { apiKey: 'test' });
      }).toThrow(ServiceError);
    });

    test('should throw error for invalid credentials', () => {
      expect(() => {
        apiClient.setCredentials('provider', null);
      }).toThrow(ServiceError);

      expect(() => {
        apiClient.setCredentials('provider', 'invalid');
      }).toThrow(ServiceError);
    });

    test('should check credential existence', () => {
      const provider = 'testProvider';

      expect(apiClient.hasCredentials(provider)).toBe(false);

      apiClient.setCredentials(provider, { apiKey: 'test' });
      expect(apiClient.hasCredentials(provider)).toBe(true);
    });

    test('should remove credentials', () => {
      const provider = 'testProvider';
      apiClient.setCredentials(provider, { apiKey: 'test' });

      expect(apiClient.hasCredentials(provider)).toBe(true);

      const removed = apiClient.removeCredentials(provider);
      expect(removed).toBe(true);
      expect(apiClient.hasCredentials(provider)).toBe(false);
    });

    test('should clear all credentials', () => {
      apiClient.setCredentials('provider1', { apiKey: 'test1' });
      apiClient.setCredentials('provider2', { apiKey: 'test2' });

      expect(apiClient.hasCredentials('provider1')).toBe(true);
      expect(apiClient.hasCredentials('provider2')).toBe(true);

      apiClient.clearCredentials();

      expect(apiClient.hasCredentials('provider1')).toBe(false);
      expect(apiClient.hasCredentials('provider2')).toBe(false);
    });

    // **Feature: service-migration-to-backend, Property 5: API credential security management**
    test('Property 5: API credential security management', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // provider name
          fc.record({
            apiKey: fc.string({ minLength: 1, maxLength: 100 }),
            secret: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            token: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            endpoint: fc.option(fc.webUrl()),
          }), // credentials object
          (provider, credentials) => {
            const client = new APIClient();

            // Store credentials
            client.setCredentials(provider, credentials);

            // Verify credentials are stored
            expect(client.hasCredentials(provider)).toBe(true);

            // Retrieve credentials
            const retrieved = client.getCredentials(provider);

            // Verify credentials match but are not the same object (security copy)
            expect(retrieved).toEqual(credentials);
            expect(retrieved).not.toBe(credentials);

            // Verify credentials are isolated per provider
            const otherProvider = provider + '_other';
            expect(client.hasCredentials(otherProvider)).toBe(false);

            // Verify credentials can be removed
            client.removeCredentials(provider);
            expect(client.hasCredentials(provider)).toBe(false);

            // Verify accessing removed credentials throws error
            expect(() => client.getCredentials(provider)).toThrow(ServiceError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 5: Credential isolation between providers', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.record({
                apiKey: fc.string({ minLength: 1, maxLength: 50 }),
                secret: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              })
            ),
            {
              minLength: 1,
              maxLength: 10,
              selector: ([provider]) => provider,
            }
          ),
          providerCredentialPairs => {
            const client = new APIClient();

            // Store all credentials
            providerCredentialPairs.forEach(([provider, credentials]) => {
              client.setCredentials(provider, credentials);
            });

            // Verify each provider's credentials are isolated
            providerCredentialPairs.forEach(
              ([provider, expectedCredentials]) => {
                const retrieved = client.getCredentials(provider);
                expect(retrieved).toEqual(expectedCredentials);

                // Verify modifying retrieved credentials doesn't affect stored ones
                retrieved.apiKey = 'modified';
                const retrievedAgain = client.getCredentials(provider);
                expect(retrievedAgain.apiKey).toBe(expectedCredentials.apiKey);
              }
            );

            // Verify clearing credentials affects all providers
            client.clearCredentials();
            providerCredentialPairs.forEach(([provider]) => {
              expect(client.hasCredentials(provider)).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', () => {
      const rateLimit = { maxRequests: 2, windowMs: 1000 };

      expect(apiClient.checkRateLimit('test-key', rateLimit)).toBe(true);
      apiClient.trackRequest('test-key');

      expect(apiClient.checkRateLimit('test-key', rateLimit)).toBe(true);
      apiClient.trackRequest('test-key');

      expect(apiClient.checkRateLimit('test-key', rateLimit)).toBe(false);
    });

    test('should allow requests after rate limit window expires', async () => {
      const rateLimit = { maxRequests: 1, windowMs: 50 };

      expect(apiClient.checkRateLimit('test-key', rateLimit)).toBe(true);
      apiClient.trackRequest('test-key');

      expect(apiClient.checkRateLimit('test-key', rateLimit)).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(apiClient.checkRateLimit('test-key', rateLimit)).toBe(true);
    });
  });

  describe('Metrics', () => {
    test('should track request metrics', () => {
      const initialMetrics = apiClient.getMetrics();

      expect(initialMetrics.totalRequests).toBe(0);
      expect(initialMetrics.successfulRequests).toBe(0);
      expect(initialMetrics.failedRequests).toBe(0);
      expect(initialMetrics.successRate).toBe(0);
    });

    test('should update metrics on successful requests', () => {
      apiClient.updateMetrics(true, 100);

      const metrics = apiClient.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageResponseTime).toBe(100);
    });

    test('should update metrics on failed requests', () => {
      apiClient.updateMetrics(false, 200);

      const metrics = apiClient.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageResponseTime).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should identify non-retryable errors', () => {
      const authError = new Error('HTTP 401: Unauthorized');
      const forbiddenError = new Error('HTTP 403: Forbidden');
      const badRequestError = new Error('HTTP 400: Bad Request');
      const serverError = new Error('HTTP 500: Internal Server Error');

      expect(apiClient.isNonRetryableError(authError)).toBe(true);
      expect(apiClient.isNonRetryableError(forbiddenError)).toBe(true);
      expect(apiClient.isNonRetryableError(badRequestError)).toBe(true);
      expect(apiClient.isNonRetryableError(serverError)).toBe(false);
    });
  });
});
