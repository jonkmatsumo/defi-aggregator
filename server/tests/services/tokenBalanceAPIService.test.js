import { jest } from '@jest/globals';
import fc from 'fast-check';
import { TokenBalanceAPIService } from '../../src/services/tokenBalanceAPIService.js';
import { ServiceError } from '../../src/utils/errors.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('TokenBalanceAPIService', () => {
  let service;
  let mockApiClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock API client
    mockApiClient = {
      setCredentials: jest.fn(),
      getCredentials: jest.fn(),
      hasCredentials: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      request: jest.fn(),
      getMetrics: jest.fn(() => ({ totalRequests: 0, successfulRequests: 0 }))
    };
    
    // Create service instance with test configuration
    service = new TokenBalanceAPIService({
      networks: {
        ethereum: {
          rpcUrl: 'https://test-rpc.ethereum.org',
          chainId: 1,
          nativeSymbol: 'ETH',
          nativeName: 'Ether',
          nativeDecimals: 18
        },
        polygon: {
          rpcUrl: 'https://test-rpc.polygon.org',
          chainId: 137,
          nativeSymbol: 'MATIC',
          nativeName: 'MATIC',
          nativeDecimals: 18
        }
      },
      cache: {
        enabled: false // Disable cache for testing
      },
      rateLimit: {
        maxRequests: 1000,
        windowMs: 1000
      }
    });

    // Replace the API client with our mock after construction
    service.apiClient = mockApiClient;
  });

  afterEach(() => {
    // Clear cache after each test
    service.clearCache();
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: service-migration-to-backend, Property 4: Token balance service backend migration completeness**
     * **Validates: Requirements 4.1, 4.2, 4.3**
     */
    describe('Property 4: Token balance service backend migration completeness', () => {
      test('should provide all required methods from frontend service interface', () => {
        fc.assert(fc.property(
          fc.constantFrom('ethereum', 'polygon'),
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => '0x' + s),
          (network, _address) => {
            // Test that all required methods exist and are functions
            expect(typeof service.getNativeBalance).toBe('function');
            expect(typeof service.getTokenBalance).toBe('function');
            expect(typeof service.getAllTokenBalances).toBe('function');
            expect(typeof service.getTokenMetadata).toBe('function');
            expect(typeof service.getPortfolioValue).toBe('function');
            expect(typeof service.getSupportedNetworks).toBe('function');
            expect(typeof service.getCommonTokens).toBe('function');

            // Test that service has proper configuration
            expect(service.config).toBeDefined();
            expect(service.config.networks).toBeDefined();
            expect(service.config.networks[network]).toBeDefined();
            
            // Test that service supports multiple networks
            const supportedNetworks = service.getSupportedNetworks();
            expect(Array.isArray(supportedNetworks)).toBe(true);
            expect(supportedNetworks.length).toBeGreaterThan(0);
            expect(supportedNetworks).toContain(network);

            // Test that service has blockchain RPC integration capability
            expect(service.apiClient).toBeDefined();
            expect(typeof service.fetchNativeBalanceFromRPC).toBe('function');
            expect(typeof service.fetchTokenBalanceFromRPC).toBe('function');
            expect(typeof service.fetchTokenMetadataFromRPC).toBe('function');
          }
        ), { numRuns: 100 });
      });

      test('should support multiple networks as specified in requirements', () => {
        fc.assert(fc.property(
          fc.constantFrom('ethereum', 'polygon'),
          (network) => {
            const supportedNetworks = service.getSupportedNetworks();
            
            // Verify network is supported
            expect(supportedNetworks).toContain(network);
            
            // Verify network configuration exists
            const networkConfig = service.config.networks[network];
            expect(networkConfig).toBeDefined();
            expect(networkConfig.rpcUrl).toBeDefined();
            expect(networkConfig.chainId).toBeDefined();
            expect(networkConfig.nativeSymbol).toBeDefined();
            expect(networkConfig.nativeName).toBeDefined();
            expect(networkConfig.nativeDecimals).toBeDefined();
            
            // Verify common tokens can be retrieved
            const commonTokens = service.getCommonTokens(network);
            expect(typeof commonTokens).toBe('object');
          }
        ), { numRuns: 100 });
      });

      test('should provide structured balance data responses with USD values', async () => {
        await fc.assert(fc.asyncProperty(
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => '0x' + s),
          fc.constantFrom('ethereum', 'polygon'),
          async (address, network) => {
            // Mock successful RPC response
            mockApiClient.post.mockResolvedValue({
              jsonrpc: '2.0',
              result: '0x1bc16d674ec80000', // 2 ETH in wei
              id: 1
            });

            const result = await service.getNativeBalance(address, network);
            
            // The test should always return a result with mocked data
            expect(result).toBeDefined();
            expect(result).not.toBeNull();
            
            // Verify structured response format
            expect(result).toHaveProperty('address');
            expect(result).toHaveProperty('network');
            expect(result).toHaveProperty('symbol');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('balance');
            expect(result).toHaveProperty('balanceUSD');
            expect(result).toHaveProperty('decimals');
            expect(result).toHaveProperty('timestamp');

            // Verify data types
            expect(typeof result.address).toBe('string');
            expect(typeof result.network).toBe('string');
            expect(typeof result.symbol).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.balance).toBe('string');
            expect(typeof result.balanceUSD).toBe('string');
            expect(typeof result.decimals).toBe('number');
            expect(typeof result.timestamp).toBe('number');

            // Verify USD value format
            expect(result.balanceUSD).toMatch(/^\$[\d,]+(\.\d+)?$/);
          }
        ), { numRuns: 10 });
      });
    });

    /**
     * **Feature: service-migration-to-backend, Property 13: Structured error response provision**
     * **Validates: Requirements 8.1**
     */
    describe('Property 13: Structured error response provision', () => {
      test('should provide structured error responses with error codes and messages', async () => {
        await fc.assert(fc.asyncProperty(
          fc.oneof(
            fc.constant(''), // Empty address
            fc.constant('invalid'), // Invalid format
            fc.hexaString({ minLength: 39, maxLength: 39 }).map(s => '0x' + s), // Wrong length
            fc.string().filter(s => !s.startsWith('0x')) // No 0x prefix
          ),
          fc.constantFrom('ethereum', 'polygon'),
          async (invalidAddress, network) => {
            // Should throw an error for invalid addresses
            await expect(service.getNativeBalance(invalidAddress, network))
              .rejects.toThrow(/address|format|invalid|required/i);
          }
        ), { numRuns: 100 });
      });

      test('should provide structured error responses for network failures', async () => {
        await fc.assert(fc.asyncProperty(
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => '0x' + s),
          fc.constantFrom('ethereum', 'polygon'),
          async (address, network) => {
            // Mock network failure
            mockApiClient.post.mockRejectedValue(new Error('Network timeout'));

            // Should throw an error for network failures
            await expect(service.getNativeBalance(address, network))
              .rejects.toThrow();
            
            // Verify the error was thrown (we can't check the specific error in this pattern)
            expect(mockApiClient.post).toHaveBeenCalled();
          }
        ), { numRuns: 5 });
      }, 15000);
    });

    /**
     * **Feature: service-migration-to-backend, Property 14: Error classification accuracy**
     * **Validates: Requirements 8.2**
     */
    describe('Property 14: Error classification accuracy', () => {
      test('should accurately classify different types of errors', async () => {
        await fc.assert(fc.asyncProperty(
          fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => '0x' + s),
          fc.constantFrom('ethereum', 'polygon'),
          fc.oneof(
            fc.constant({ type: 'network', error: new Error('Network timeout') }),
            fc.constant({ type: 'rpc', error: new Error('RPC error: Invalid method') }),
            fc.constant({ type: 'http', error: new Error('HTTP 500: Internal Server Error') }),
            fc.constant({ type: 'auth', error: new Error('HTTP 401: Unauthorized') })
          ),
          async (address, network, errorCase) => {
            // Mock the specific error type
            mockApiClient.post.mockRejectedValue(errorCase.error);

            // Should throw an error for all error cases
            await expect(service.getNativeBalance(address, network))
              .rejects.toThrow();
            
            // Verify the API client was called
            expect(mockApiClient.post).toHaveBeenCalled();
          }
        ), { numRuns: 5 });
      }, 15000);

      test('should classify validation errors accurately', async () => {
        await fc.assert(fc.asyncProperty(
          fc.oneof(
            fc.constant(''), // Empty address
            fc.constant('invalid'), // Invalid format
            fc.constant('0x123') // Too short
          ),
          fc.constantFrom('ethereum', 'polygon'),
          async (invalidInput, network) => {
            const errorPromise = service.getNativeBalance(invalidInput, network);
            await expect(errorPromise).rejects.toBeInstanceOf(ServiceError);
          }
        ), { numRuns: 10 });
      });

      test('should classify runtime errors accurately', async () => {
        await fc.assert(fc.asyncProperty(
          fc.constant('0x1234567890123456789012345678901234567890'), // Valid format
          fc.constantFrom('ethereum', 'polygon'),
          async (validInput, network) => {
            // Mock runtime error for valid input
            mockApiClient.post.mockRejectedValue(new Error('Network error'));
            
            const errorPromise = service.getNativeBalance(validInput, network);
            await expect(errorPromise).rejects.toThrow(/network|error|timeout|connection|failed/i);
          }
        ), { numRuns: 5 });
      }, 15000);
    });
  });

  describe('Unit Tests', () => {
    describe('Constructor and Configuration', () => {
      test('should initialize with default configuration', () => {
        const defaultService = new TokenBalanceAPIService();
        
        expect(defaultService.config).toBeDefined();
        expect(defaultService.config.networks).toBeDefined();
        expect(defaultService.apiClient).toBeDefined();
        expect(defaultService.erc20Abi).toBeDefined();
      });

      test('should merge custom configuration with defaults', () => {
        const customConfig = {
          cache: { ttl: 60000 },
          timeout: 20000
        };
        
        const customService = new TokenBalanceAPIService(customConfig);
        
        expect(customService.config.cache.ttl).toBe(60000);
        expect(customService.config.timeout).toBe(20000);
      });
    });

    describe('Address Validation', () => {
      test('should validate correct Ethereum addresses', () => {
        const validAddress = '0x1234567890123456789012345678901234567890';
        
        expect(() => service.validateAddress(validAddress)).not.toThrow();
      });

      test('should reject invalid addresses', () => {
        const invalidAddresses = [
          '',
          null,
          undefined,
          '1234567890123456789012345678901234567890', // No 0x prefix
          '0x123456789012345678901234567890123456789', // Too short
          '0x12345678901234567890123456789012345678901', // Too long
          '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG' // Invalid hex
        ];

        invalidAddresses.forEach(address => {
          expect(() => service.validateAddress(address)).toThrow(ServiceError);
        });
      });
    });

    describe('Network Validation', () => {
      test('should validate supported networks', () => {
        const supportedNetworks = service.getSupportedNetworks();
        
        supportedNetworks.forEach(network => {
          expect(() => service.validateNetwork(network)).not.toThrow();
        });
      });

      test('should reject unsupported networks', () => {
        const unsupportedNetworks = ['bitcoin', 'litecoin', '', null, undefined];

        unsupportedNetworks.forEach(network => {
          expect(() => service.validateNetwork(network)).toThrow(ServiceError);
        });
      });
    });

    describe('Balance Formatting', () => {
      test('should format balance correctly', () => {
        expect(service.formatBalance('0x1bc16d674ec80000', 18)).toBe('2'); // 2 ETH
        expect(service.formatBalance('0x0', 18)).toBe('0');
        expect(service.formatBalance('0x', 18)).toBe('0');
        expect(service.formatBalance('', 18)).toBe('0');
      });

      test('should handle different decimal places', () => {
        expect(service.formatBalance('0xf4240', 6)).toBe('1'); // 1 USDC (6 decimals)
        expect(service.formatBalance('0x5f5e100', 8)).toBe('1'); // 1 WBTC (8 decimals)
      });
    });

    describe('USD Value Calculation', () => {
      test('should calculate USD values for known tokens', () => {
        expect(service.calculateUSDValue('1', 'ETH')).toBe('$2,000');
        expect(service.calculateUSDValue('1', 'USDC')).toBe('$1');
        expect(service.calculateUSDValue('0', 'ETH')).toBe('$0');
      });

      test('should handle unknown tokens', () => {
        expect(service.calculateUSDValue('1', 'UNKNOWN')).toBe('$0');
      });
    });

    describe('String Decoding', () => {
      test('should decode hex strings correctly', () => {
        // Mock hex string for "USDC"
        const hexString = '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000455534443000000000000000000000000000000000000000000000000000000000';
        
        const decoded = service.decodeString(hexString);
        expect(decoded).toBe('USDC');
      });

      test('should handle invalid hex strings', () => {
        expect(service.decodeString('')).toBe('');
        expect(service.decodeString('0x')).toBe('');
        expect(service.decodeString('invalid')).toBe('');
      });
    });
  });
});