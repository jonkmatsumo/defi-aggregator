import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fc from 'fast-check';
import { LendingAPIService } from '../../src/services/lendingAPIService.js';

describe('LendingAPIService', () => {
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
    service = new LendingAPIService({
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
      expect(service.protocols).toBeDefined();
      expect(Object.keys(service.protocols)).toEqual(['aave', 'compound']);
      expect(service.supportedTokens).toBeDefined();
      expect(service.supportedTokens.length).toBeGreaterThan(0);
    });

    test('should return cached data when available', async () => {
      const testData = {
        token: 'ETH',
        protocols: [
          {
            protocol: 'aave',
            symbol: 'ETH',
            supplyAPY: 0.025,
            borrowAPY: 0.045,
          },
        ],
        timestamp: Date.now(),
        source: 'test',
      };

      // Set cache data
      service.setCachedData('lending_rates_ETH_aave', testData);

      const result = await service.getLendingRates('ETH', ['aave']);
      expect(result).toEqual(testData);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('API Error'));

      const result = await service.getLendingRates('ETH', ['aave']);

      // Should return fallback data
      expect(result.source).toBe('fallback');
      expect(result.token).toBe('ETH');
      expect(result.protocols).toBeDefined();
      expect(result.protocols.length).toBeGreaterThan(0);
    });

    test('should throw error for invalid token', async () => {
      await expect(service.getLendingRates('')).rejects.toThrow(
        'Token symbol is required'
      );
    });

    test('should throw error for no valid protocols', async () => {
      await expect(service.getLendingRates('ETH', ['invalid'])).rejects.toThrow(
        'No valid protocols specified'
      );
    });

    test('should return supported protocols', () => {
      const protocols = service.getSupportedProtocols();
      expect(protocols).toBeDefined();
      expect(protocols.aave).toBeDefined();
      expect(protocols.compound).toBeDefined();
    });

    test('should return supported tokens', () => {
      const tokens = service.getSupportedTokens();
      expect(tokens).toBeDefined();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Property-Based Tests', () => {
    // **Feature: service-migration-to-backend, Property 2: Lending service backend migration completeness**
    test('Property 2: Lending service backend migration completeness', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'ETH',
            'DAI',
            'USDC',
            'USDT',
            'WBTC',
            'UNI',
            'LINK',
            'AAVE',
            'COMP'
          ),
          fc.array(fc.constantFrom('aave', 'compound'), {
            minLength: 1,
            maxLength: 2,
          }),
          fc.record({
            includeUtilization: fc.boolean(),
          }),
          async (token, protocols, options) => {
            // Remove duplicates from protocols
            const uniqueProtocols = [...new Set(protocols)];

            // Mock successful API responses for both protocols
            mockApiClient.get.mockImplementation(url => {
              if (url.includes('aave')) {
                return Promise.resolve([
                  {
                    symbol: token,
                    name: `${token} Token`,
                    reserveAddress: '0x123...',
                    decimals: 18,
                    liquidityRate: '25000000000000000000000000', // 2.5% in ray format
                    variableBorrowRate: '45000000000000000000000000', // 4.5% in ray format
                    totalLiquidity: '1000000',
                    totalVariableDebt: '500000',
                    utilizationRate: '500000000000000000000000000', // 50% in ray format
                    availableLiquidity: '500000',
                  },
                ]);
              } else if (url.includes('compound')) {
                return Promise.resolve({
                  cToken: [
                    {
                      symbol: token,
                      name: `${token} Token`,
                      token_address: '0x456...',
                      cToken_address: '0x789...',
                      decimals: 18,
                      supply_rate: { value: 0.025 },
                      borrow_rate: { value: 0.045 },
                      total_supply: { value: 1000000 },
                      total_borrow: { value: 500000 },
                      exchange_rate: { value: 1.02 },
                    },
                  ],
                });
              }
              return Promise.reject(new Error('Unknown API'));
            });

            const result = await service.getLendingRates(
              token,
              uniqueProtocols,
              options
            );

            // Property: Backend service should provide same functionality as frontend
            expect(result).toBeDefined();
            expect(result.token).toBe(token);
            expect(result.protocols).toBeDefined();
            expect(Array.isArray(result.protocols)).toBe(true);
            expect(result.protocols.length).toBe(uniqueProtocols.length);
            expect(result.timestamp).toBeDefined();
            expect(result.source).toBeDefined();

            // Each protocol should have required data structure
            result.protocols.forEach(protocolData => {
              expect(protocolData.protocol).toBeDefined();
              expect(uniqueProtocols).toContain(protocolData.protocol);
              expect(protocolData.symbol).toBe(token);
              expect(protocolData.platform).toBeDefined();
              expect(typeof protocolData.supplyAPY).toBe('number');
              expect(typeof protocolData.borrowAPY).toBe('number');
              expect(protocolData.supplyAPY).toBeGreaterThanOrEqual(0);
              expect(protocolData.borrowAPY).toBeGreaterThanOrEqual(0);

              // Borrow rate should typically be higher than supply rate
              expect(protocolData.borrowAPY).toBeGreaterThanOrEqual(
                protocolData.supplyAPY
              );
            });

            // Should support all major DeFi tokens
            expect([
              'ETH',
              'DAI',
              'USDC',
              'USDT',
              'WBTC',
              'UNI',
              'LINK',
              'AAVE',
              'COMP',
            ]).toContain(token);

            // Should support both major protocols
            uniqueProtocols.forEach(protocol => {
              expect(['aave', 'compound']).toContain(protocol);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: service-migration-to-backend, Property 12: Cache corruption detection**
    test('Property 12: Cache corruption detection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ETH', 'DAI', 'USDC'),
          fc.constantFrom('aave', 'compound'),
          fc.integer({ min: 50, max: 200 }), // Cache timeout in ms
          async (token, protocol, cacheTimeout) => {
            // Create service with specific cache timeout
            const testService = new LendingAPIService({
              cacheTimeout,
            });

            // Replace with mock API client
            const testMockClient = {
              setCredentials: jest.fn(),
              getCredentials: jest.fn(),
              hasCredentials: jest.fn(),
              get: jest.fn(),
              getMetrics: jest.fn(() => ({
                totalRequests: 0,
                successfulRequests: 0,
              })),
            };
            testService.apiClient = testMockClient;

            // Mock API response
            const mockResponse =
              protocol === 'aave'
                ? [
                    {
                      symbol: token,
                      name: `${token} Token`,
                      reserveAddress: '0x123...',
                      decimals: 18,
                      liquidityRate: '25000000000000000000000000',
                      variableBorrowRate: '45000000000000000000000000',
                      totalLiquidity: '1000000',
                      totalVariableDebt: '500000',
                      utilizationRate: '500000000000000000000000000',
                      availableLiquidity: '500000',
                    },
                  ]
                : {
                    cToken: [
                      {
                        symbol: token,
                        name: `${token} Token`,
                        token_address: '0x456...',
                        cToken_address: '0x789...',
                        decimals: 18,
                        supply_rate: { value: 0.025 },
                        borrow_rate: { value: 0.045 },
                        total_supply: { value: 1000000 },
                        total_borrow: { value: 500000 },
                        exchange_rate: { value: 1.02 },
                      },
                    ],
                  };

            testMockClient.get.mockResolvedValue(mockResponse);

            // First call should fetch from API and cache
            const result1 = await testService.getLendingRates(token, [
              protocol,
            ]);
            expect(result1).toBeDefined();

            // Simulate cache corruption by setting invalid data
            const cacheKey = `lending_rates_${token}_${protocol}`;
            testService.setCachedData(cacheKey, null);

            // Second call should detect corruption and fetch fresh data
            testMockClient.get.mockResolvedValue(mockResponse);
            const result2 = await testService.getLendingRates(token, [
              protocol,
            ]);

            // Property: Service should detect and handle cache corruption
            expect(result2).toBeDefined();
            expect(result2.token).toBe(token);
            expect(result2.protocols).toBeDefined();
            expect(result2.protocols.length).toBeGreaterThan(0);

            // Should have valid data structure even after corruption
            result2.protocols.forEach(protocolData => {
              expect(protocolData.protocol).toBe(protocol);
              expect(protocolData.symbol).toBe(token);
              expect(typeof protocolData.supplyAPY).toBe('number');
              expect(typeof protocolData.borrowAPY).toBe('number');
            });

            // Simulate cache corruption with malformed data
            testService.setCachedData(cacheKey, { invalid: 'data' });

            const result3 = await testService.getLendingRates(token, [
              protocol,
            ]);
            expect(result3).toBeDefined();
            expect(result3.token).toBe(token);
          }
        ),
        { numRuns: 10, timeout: 3000 }
      );
    }, 15000);

    // **Feature: service-migration-to-backend, Property 2: Lending service backend migration completeness (error handling aspect)**
    test('Property 2 (error handling): DeFi protocol error handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ETH', 'DAI', 'USDC'),
          fc.constantFrom('aave', 'compound'),
          fc.constantFrom(
            'Network Error',
            'API Rate Limited',
            'Invalid Response',
            'Timeout Error',
            'Authentication Failed'
          ),
          async (token, protocol, errorType) => {
            // Create service with reduced retry attempts for testing
            const testService = new LendingAPIService({
              cacheTimeout: 100,
              retryAttempts: 1, // Reduce retry attempts for faster testing
              retryDelay: 100,
            });

            // Replace with mock API client
            const testMockClient = {
              setCredentials: jest.fn(),
              getCredentials: jest.fn(),
              hasCredentials: jest.fn(),
              get: jest.fn(),
              getMetrics: jest.fn(() => ({
                totalRequests: 0,
                successfulRequests: 0,
              })),
            };
            testService.apiClient = testMockClient;

            // Mock different types of API errors
            const mockError = new Error(errorType);
            testMockClient.get.mockRejectedValue(mockError);

            const result = await testService.getLendingRates(token, [protocol]);

            // Property: Service should handle all DeFi protocol errors gracefully
            expect(result).toBeDefined();
            expect(result.token).toBe(token);
            expect(result.protocols).toBeDefined();
            expect(Array.isArray(result.protocols)).toBe(true);
            expect(result.protocols.length).toBeGreaterThan(0);

            // Should provide fallback data when API fails
            const protocolData = result.protocols[0];
            expect(protocolData.protocol).toBe(protocol);
            expect(protocolData.symbol).toBe(token);
            expect(typeof protocolData.supplyAPY).toBe('number');
            expect(typeof protocolData.borrowAPY).toBe('number');
            expect(protocolData.supplyAPY).toBeGreaterThanOrEqual(0);
            expect(protocolData.borrowAPY).toBeGreaterThanOrEqual(0);

            // Fallback data should be reasonable
            expect(protocolData.supplyAPY).toBeLessThan(1); // Less than 100%
            expect(protocolData.borrowAPY).toBeLessThan(1); // Less than 100%
            expect(protocolData.borrowAPY).toBeGreaterThanOrEqual(
              protocolData.supplyAPY
            );

            // Should indicate fallback source
            expect(result.source).toBe('fallback');
          }
        ),
        { numRuns: 20, timeout: 2000 } // Reduced runs and timeout
      );
    }, 15000);

    test('Property: Protocol data consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('aave', 'compound'),
          fc.array(fc.constantFrom('ETH', 'DAI', 'USDC', 'USDT'), {
            minLength: 1,
            maxLength: 4,
          }),
          async (protocol, tokens) => {
            // Remove duplicates
            const uniqueTokens = [...new Set(tokens)];

            // Mock protocol-specific responses
            if (protocol === 'aave') {
              mockApiClient.get.mockResolvedValue(
                uniqueTokens.map(token => ({
                  symbol: token,
                  name: `${token} Token`,
                  reserveAddress: `0x${token.toLowerCase()}123...`,
                  decimals: 18,
                  liquidityRate: '25000000000000000000000000',
                  variableBorrowRate: '45000000000000000000000000',
                  totalLiquidity: '1000000',
                  totalVariableDebt: '500000',
                  utilizationRate: '500000000000000000000000000',
                  availableLiquidity: '500000',
                }))
              );
            } else {
              mockApiClient.get.mockResolvedValue({
                cToken: uniqueTokens.map(token => ({
                  symbol: token,
                  name: `${token} Token`,
                  token_address: `0x${token.toLowerCase()}456...`,
                  cToken_address: `0x${token.toLowerCase()}789...`,
                  decimals: 18,
                  supply_rate: { value: 0.025 },
                  borrow_rate: { value: 0.045 },
                  total_supply: { value: 1000000 },
                  total_borrow: { value: 500000 },
                  exchange_rate: { value: 1.02 },
                })),
              });
            }

            const result = await service.getProtocolData(
              protocol,
              uniqueTokens
            );

            // Property: Protocol data should be consistent and complete
            expect(result).toBeDefined();
            expect(result.protocol).toBe(protocol);
            expect(result.tokens).toBeDefined();
            expect(Array.isArray(result.tokens)).toBe(true);
            expect(result.tokens.length).toBe(uniqueTokens.length);

            // Each token should have consistent data structure
            result.tokens.forEach((tokenData, index) => {
              expect(tokenData.symbol).toBe(uniqueTokens[index]);
              expect(tokenData.platform).toBe(
                protocol.charAt(0).toUpperCase() + protocol.slice(1)
              );
              expect(typeof tokenData.supplyAPY).toBe('number');
              expect(typeof tokenData.borrowAPY).toBe('number');
              expect(tokenData.supplyAPY).toBeGreaterThanOrEqual(0);
              expect(tokenData.borrowAPY).toBeGreaterThanOrEqual(0);
              expect(tokenData.borrowAPY).toBeGreaterThanOrEqual(
                tokenData.supplyAPY
              );
            });

            expect(result.timestamp).toBeDefined();
            expect(result.source).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property: All protocol rates completeness', async () => {
      // Mock responses for both protocols
      mockApiClient.get.mockImplementation(url => {
        if (url.includes('aave')) {
          return Promise.resolve([
            {
              symbol: 'ETH',
              name: 'Ethereum',
              reserveAddress: '0x123...',
              decimals: 18,
              liquidityRate: '25000000000000000000000000',
              variableBorrowRate: '45000000000000000000000000',
              totalLiquidity: '1000000',
              totalVariableDebt: '500000',
              utilizationRate: '500000000000000000000000000',
              availableLiquidity: '500000',
            },
          ]);
        } else if (url.includes('compound')) {
          return Promise.resolve({
            cToken: [
              {
                symbol: 'ETH',
                name: 'Ethereum',
                token_address: '0x456...',
                cToken_address: '0x789...',
                decimals: 18,
                supply_rate: { value: 0.025 },
                borrow_rate: { value: 0.045 },
                total_supply: { value: 1000000 },
                total_borrow: { value: 500000 },
                exchange_rate: { value: 1.02 },
              },
            ],
          });
        }
        return Promise.reject(new Error('Unknown API'));
      });

      const result = await service.getAllProtocolRates();

      // Property: All protocol rates should include data for all supported protocols
      expect(result).toBeDefined();
      expect(result.protocols).toBeDefined();
      expect(typeof result.protocols).toBe('object');

      // Should include both major protocols
      expect(result.protocols.aave).toBeDefined();
      expect(result.protocols.compound).toBeDefined();

      // Each protocol should have token data
      Object.values(result.protocols).forEach(protocolData => {
        expect(protocolData.protocol).toBeDefined();
        expect(protocolData.tokens).toBeDefined();
        expect(Array.isArray(protocolData.tokens)).toBe(true);
        expect(protocolData.timestamp).toBeDefined();
        expect(protocolData.source).toBeDefined();
      });

      expect(result.timestamp).toBeDefined();
      expect(result.source).toBeDefined();
    });
  });
});
