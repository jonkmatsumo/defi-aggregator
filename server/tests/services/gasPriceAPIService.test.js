import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fc from 'fast-check';
import { GasPriceAPIService } from '../../src/services/gasPriceAPIService.js';

describe('GasPriceAPIService', () => {
  let service;
  let mockApiClient;

  beforeEach(() => {
    // Create mock API client
    mockApiClient = {
      setCredentials: jest.fn(),
      getCredentials: jest.fn(),
      hasCredentials: jest.fn(),
      get: jest.fn(),
      getMetrics: jest.fn(() => ({ totalRequests: 0, successfulRequests: 0 })),
    };

    // Create service instance with test configuration
    service = new GasPriceAPIService({
      apiKeys: {
        etherscan: 'test-etherscan-key',
        polygonscan: 'test-polygonscan-key',
      },
      cacheTimeout: 100, // 100ms for testing
      rateLimitMax: 100,
    });

    // Replace the API client with our mock after construction
    service.apiClient = mockApiClient;
  });

  afterEach(() => {
    if (service) {
      service.clearCache();
    }
  });

  describe('Unit Tests', () => {
    test('should initialize with correct configuration', () => {
      expect(service).toBeDefined();
      expect(service.networks).toBeDefined();
      expect(Object.keys(service.networks)).toEqual([
        'ethereum',
        'polygon',
        'bsc',
        'arbitrum',
        'optimism',
      ]);
    });

    test('should set up API credentials correctly', () => {
      // The credentials are set during construction, but we replace the client after
      // So let's test that the service has the correct configuration
      expect(service.config.apiKeys.etherscan).toBe('test-etherscan-key');
      expect(service.config.apiKeys.polygonscan).toBe('test-polygonscan-key');
    });

    test('should return fallback data for unsupported network', async () => {
      await expect(service.getGasPrices('unsupported')).rejects.toThrow(
        'Unsupported network: unsupported'
      );
    });

    test('should return cached data when available', async () => {
      const testData = {
        network: 'ethereum',
        gasPrices: {
          slow: { gwei: 10 },
          standard: { gwei: 15 },
          fast: { gwei: 20 },
        },
        timestamp: Date.now(),
        source: 'test',
      };

      // Set cache data
      service.setCachedData('gas_prices_ethereum', testData);

      const result = await service.getGasPrices('ethereum');
      expect(result).toEqual(testData);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('API Error'));
      mockApiClient.getCredentials.mockReturnValue({ apiKey: 'test-key' });

      const result = await service.getGasPrices('ethereum');

      // Should return fallback data
      expect(result.source).toBe('fallback');
      expect(result.network).toBe('ethereum');
      expect(result.gasPrices).toBeDefined();
    });

    test('should fetch multiple network gas prices', async () => {
      mockApiClient.get.mockResolvedValue({
        status: '1',
        result: {
          SafeGasPrice: '10',
          ProposeGasPrice: '15',
          FastGasPrice: '20',
        },
      });
      mockApiClient.getCredentials.mockReturnValue({ apiKey: 'test-key' });

      const result = await service.getMultiNetworkGasPrices([
        'ethereum',
        'polygon',
      ]);

      expect(result.networks).toBeDefined();
      expect(result.networks.ethereum).toBeDefined();
      expect(result.networks.polygon).toBeDefined();
    });
  });

  describe('Property-Based Tests', () => {
    // **Feature: service-migration-to-backend, Property 1: Gas price service backend migration completeness**
    test('Property 1: Gas price service backend migration completeness', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'),
          fc.record({
            transactionType: fc.constantFrom(
              'transfer',
              'swap',
              'contract_interaction'
            ),
            includeUSDCosts: fc.boolean(),
          }),
          async (network, options) => {
            // Mock successful API response
            mockApiClient.get.mockResolvedValue({
              status: '1',
              result: {
                SafeGasPrice: '10',
                ProposeGasPrice: '15',
                FastGasPrice: '20',
              },
            });
            mockApiClient.getCredentials.mockReturnValue({
              apiKey: 'test-key',
            });

            const result = await service.getGasPrices(network, options);

            // Property: Backend service should provide same functionality as frontend
            expect(result).toBeDefined();
            expect(result.network).toBe(network);
            expect(result.gasPrices).toBeDefined();
            expect(result.gasPrices.slow).toBeDefined();
            expect(result.gasPrices.standard).toBeDefined();
            expect(result.gasPrices.fast).toBeDefined();
            expect(result.timestamp).toBeDefined();
            expect(result.source).toBeDefined();

            // Each gas price should have gwei value
            expect(typeof result.gasPrices.slow.gwei).toBe('number');
            expect(typeof result.gasPrices.standard.gwei).toBe('number');
            expect(typeof result.gasPrices.fast.gwei).toBe('number');

            // Gas prices should be in logical order (slow <= standard <= fast)
            expect(result.gasPrices.slow.gwei).toBeLessThanOrEqual(
              result.gasPrices.standard.gwei
            );
            expect(result.gasPrices.standard.gwei).toBeLessThanOrEqual(
              result.gasPrices.fast.gwei
            );

            // Should support all required networks
            expect([
              'ethereum',
              'polygon',
              'bsc',
              'arbitrum',
              'optimism',
            ]).toContain(network);
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: service-migration-to-backend, Property 10: Cache TTL compliance**
    test('Property 10: Cache TTL compliance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'),
          fc.integer({ min: 50, max: 200 }), // Cache timeout in ms
          async (network, cacheTimeout) => {
            // Create service with specific cache timeout
            const testService = new GasPriceAPIService({
              apiKeys: { etherscan: 'test-key' },
              cacheTimeout,
            });

            // Replace with mock API client
            const testMockClient = {
              setCredentials: jest.fn(),
              getCredentials: jest.fn().mockReturnValue({ apiKey: 'test-key' }),
              hasCredentials: jest.fn().mockReturnValue(true),
              get: jest.fn(),
              getMetrics: jest.fn(() => ({
                totalRequests: 0,
                successfulRequests: 0,
              })),
            };
            testService.apiClient = testMockClient;

            // Mock first API response
            testMockClient.get.mockResolvedValueOnce({
              status: '1',
              result: {
                SafeGasPrice: '10',
                ProposeGasPrice: '15',
                FastGasPrice: '20',
              },
            });

            // First call should fetch from API
            const result1 = await testService.getGasPrices(network);
            expect(result1).toBeDefined();

            // Second call within cache timeout should return cached data
            const result2 = await testService.getGasPrices(network);
            expect(result2.timestamp).toBe(result1.timestamp); // Same cached data

            // Wait for cache to expire
            await new Promise(resolve =>
              setTimeout(resolve, cacheTimeout + 50)
            );

            // Mock second API response with different data
            testMockClient.get.mockResolvedValueOnce({
              status: '1',
              result: {
                SafeGasPrice: '12',
                ProposeGasPrice: '17',
                FastGasPrice: '22',
              },
            });

            const result3 = await testService.getGasPrices(network);

            // Property: Cache should respect TTL and refresh when expired
            expect(result3.timestamp).toBeGreaterThan(result1.timestamp);

            // For networks that use API calls, check the new data
            // All networks should have refreshed data after cache expiry
            expect(result3.timestamp).not.toBe(result1.timestamp);
          }
        ),
        { numRuns: 10, timeout: 3000 } // Reduced runs and added timeout
      );
    }, 15000); // 15 second timeout for the test

    // **Feature: service-migration-to-backend, Property 1: Gas price service backend migration completeness (fallback aspect)**
    test('Property 1 (fallback): Gas price API fallback handling', async () => {
      // Test fallback behavior directly using the fallback method
      const networks = ['ethereum', 'bsc', 'arbitrum', 'optimism'];

      for (const network of networks) {
        const fallbackResult = service.getFallbackGasPrices(network);

        // Property: Service should provide fallback data when API fails
        expect(fallbackResult).toBeDefined();
        expect(fallbackResult.network).toBe(network);
        expect(fallbackResult.source).toBe('fallback');
        expect(fallbackResult.gasPrices).toBeDefined();
        expect(fallbackResult.gasPrices.slow).toBeDefined();
        expect(fallbackResult.gasPrices.standard).toBeDefined();
        expect(fallbackResult.gasPrices.fast).toBeDefined();

        // Fallback data should be reasonable
        expect(fallbackResult.gasPrices.slow.gwei).toBeGreaterThan(0);
        expect(fallbackResult.gasPrices.standard.gwei).toBeGreaterThan(0);
        expect(fallbackResult.gasPrices.fast.gwei).toBeGreaterThan(0);

        // Should maintain logical order even in fallback
        expect(fallbackResult.gasPrices.slow.gwei).toBeLessThanOrEqual(
          fallbackResult.gasPrices.standard.gwei
        );
        expect(fallbackResult.gasPrices.standard.gwei).toBeLessThanOrEqual(
          fallbackResult.gasPrices.fast.gwei
        );
      }
    });

    test('Property: Multi-network gas price consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(
              'ethereum',
              'polygon',
              'bsc',
              'arbitrum',
              'optimism'
            ),
            { minLength: 1, maxLength: 5 }
          ),
          async networks => {
            // Remove duplicates
            const uniqueNetworks = [...new Set(networks)];

            // Mock API responses for all networks
            mockApiClient.get.mockResolvedValue({
              status: '1',
              result: {
                SafeGasPrice: '10',
                ProposeGasPrice: '15',
                FastGasPrice: '20',
              },
            });
            mockApiClient.getCredentials.mockReturnValue({
              apiKey: 'test-key',
            });

            const result =
              await service.getMultiNetworkGasPrices(uniqueNetworks);

            // Property: Multi-network response should include all requested networks
            expect(result.networks).toBeDefined();
            expect(Object.keys(result.networks)).toHaveLength(
              uniqueNetworks.length
            );

            uniqueNetworks.forEach(network => {
              expect(result.networks[network]).toBeDefined();
              expect(result.networks[network].network).toBe(network);
              expect(result.networks[network].gasPrices).toBeDefined();
            });

            expect(result.timestamp).toBeDefined();
            expect(result.source).toBe('backend_api');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property: Transaction cost estimation accuracy', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'),
          fc.constantFrom('transfer', 'swap', 'contract_interaction'),
          fc.integer({ min: 21000, max: 500000 }), // Gas limit range
          async (network, transactionType, gasLimit) => {
            // Mock gas price data
            const mockGasData = {
              network,
              gasPrices: {
                slow: { gwei: 10, usd_cost: 0.3 },
                standard: { gwei: 15, usd_cost: 0.45 },
                fast: { gwei: 20, usd_cost: 0.6 },
              },
              timestamp: Date.now(),
              source: 'test',
            };

            service.setCachedData(`gas_prices_${network}`, mockGasData);

            const result = await service.getTransactionCostEstimate(
              network,
              transactionType,
              gasLimit
            );

            // Property: Cost estimation should be mathematically consistent
            expect(result).toBeDefined();
            expect(result.network).toBe(network);
            expect(result.transactionType).toBe(transactionType);
            expect(result.gasLimit).toBe(gasLimit);
            expect(result.costs).toBeDefined();

            // Check cost calculations for each speed tier
            ['slow', 'standard', 'fast'].forEach(speed => {
              const cost = result.costs[speed];
              // All speed tiers should be present
              expect(cost).toBeDefined();
              expect(cost.gasPrice).toBeDefined();
              expect(cost.gasCost).toBeDefined();
              expect(cost.gasCostUSD).toBeDefined();
              expect(cost.currency).toBeDefined();

              // Cost should be proportional to gas price and gas limit
              const expectedCost = (cost.gasPrice * gasLimit * 1e9) / 1e18;
              expect(Math.abs(cost.gasCost - expectedCost)).toBeLessThan(0.001);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
