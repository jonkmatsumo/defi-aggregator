import { describe, test, expect, beforeAll, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock the service container before importing the routes
jest.unstable_mockModule('../../src/services/container.js', () => ({
  serviceContainer: {
    get: jest.fn().mockImplementation((serviceName) => {
      if (serviceName === 'GasPriceAPIService') {
        return {
          getGasPrices: jest.fn().mockResolvedValue({
            network: 'ethereum',
            gasPrices: {
              slow: { gwei: 10, usd_cost: 0.30 },
              standard: { gwei: 15, usd_cost: 0.45 },
              fast: { gwei: 20, usd_cost: 0.60 }
            },
            timestamp: Date.now(),
            source: 'test'
          }),
          getMultiNetworkGasPrices: jest.fn().mockResolvedValue({
            networks: {
              ethereum: {
                network: 'ethereum',
                gasPrices: { slow: { gwei: 10 }, standard: { gwei: 15 }, fast: { gwei: 20 } }
              },
              polygon: {
                network: 'polygon',
                gasPrices: { slow: { gwei: 2 }, standard: { gwei: 3 }, fast: { gwei: 4 } }
              }
            },
            timestamp: Date.now(),
            source: 'test'
          })
        };
      }
      if (serviceName === 'PriceFeedAPIService') {
        return {
          getCryptocurrencyPrice: jest.fn().mockResolvedValue({
            symbol: 'BTC',
            price: 42000,
            currency: 'USD',
            change_24h: 2.5,
            volume_24h: 15000000000,
            market_cap: 820000000000,
            timestamp: Date.now(),
            source: 'test'
          }),
          getMultiplePrices: jest.fn().mockResolvedValue({
            prices: {
              BTC: { price: 42000, currency: 'USD' },
              ETH: { price: 2500, currency: 'USD' }
            },
            timestamp: Date.now(),
            source: 'test'
          })
        };
      }
      if (serviceName === 'LendingAPIService') {
        return {
          getLendingRates: jest.fn().mockResolvedValue({
            token: 'USDC',
            protocols: [
              { protocol: 'aave', supplyAPY: 0.032, borrowAPY: 0.052 },
              { protocol: 'compound', supplyAPY: 0.030, borrowAPY: 0.050 }
            ],
            timestamp: Date.now(),
            source: 'test'
          }),
          getAllProtocolRates: jest.fn().mockResolvedValue({
            protocols: {
              aave: { tokens: [{ symbol: 'USDC', supplyAPY: 0.032 }] },
              compound: { tokens: [{ symbol: 'USDC', supplyAPY: 0.030 }] }
            },
            timestamp: Date.now(),
            source: 'test'
          })
        };
      }
      if (serviceName === 'TokenBalanceAPIService') {
        return {
          getTokenBalance: jest.fn().mockResolvedValue({
            address: '0x1234567890123456789012345678901234567890',
            network: 'ethereum',
            symbol: 'USDC',
            balance: '1000.50',
            balanceUSD: '$1,000.50',
            timestamp: Date.now()
          }),
          getAllTokenBalances: jest.fn().mockResolvedValue({
            address: '0x1234567890123456789012345678901234567890',
            network: 'ethereum',
            tokens: [
              { symbol: 'ETH', balance: '1.5', balanceUSD: '$3,000' },
              { symbol: 'USDC', balance: '1000.50', balanceUSD: '$1,000.50' }
            ],
            totalUSD: '4000.50',
            timestamp: Date.now()
          }),
          getPortfolioValue: jest.fn().mockResolvedValue({
            address: '0x1234567890123456789012345678901234567890',
            networks: ['ethereum'],
            totalUSD: '4000.50',
            breakdown: [{ network: 'ethereum', valueUSD: 4000.50 }],
            timestamp: Date.now()
          })
        };
      }
      throw new Error(`Service not found: ${serviceName}`);
    })
  }
}));

// Import after mock is set up
const { createServiceRoutes } = await import('../../src/routes/serviceRoutes.js');

describe('Service Routes', () => {
  let app;
  let serviceRoutes;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    serviceRoutes = createServiceRoutes();
    app.use('/api', serviceRoutes);
  });

  // ============================================
  // Gas Price Endpoints Tests
  // ============================================
  describe('Gas Price Endpoints', () => {
    describe('GET /api/gas-prices/:network', () => {
      test('should return gas prices for valid network', async () => {
        const response = await request(app)
          .get('/api/gas-prices/ethereum')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.network).toBe('ethereum');
        expect(response.body.data.gasPrices).toBeDefined();
        expect(response.body.metadata.executionTime).toBeDefined();
      });

      test('should return 400 for invalid network', async () => {
        const response = await request(app)
          .get('/api/gas-prices/invalid-network')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.type).toBe('validation');
        expect(response.body.error.code).toBe('INVALID_NETWORK');
      });

      /**
       * Feature: service-migration-to-backend, Property 7: Frontend service stub delegation
       * Validates: Requirements 1.4
       */
      test('Property 7: should accept all valid networks', async () => {
        const validNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];

        for (const network of validNetworks) {
          const response = await request(app)
            .get(`/api/gas-prices/${network}`)
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });
    });

    describe('GET /api/gas-prices', () => {
      test('should return gas prices for multiple networks', async () => {
        const response = await request(app)
          .get('/api/gas-prices?networks=ethereum,polygon')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.metadata.networksRequested).toBe(2);
      });

      test('should default to ethereum when no networks specified', async () => {
        const response = await request(app)
          .get('/api/gas-prices')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return 400 for invalid networks in list', async () => {
        const response = await request(app)
          .get('/api/gas-prices?networks=ethereum,invalid')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_NETWORK');
      });
    });
  });

  // ============================================
  // Price Feed Endpoints Tests
  // ============================================
  describe('Price Feed Endpoints', () => {
    describe('GET /api/prices/:symbol', () => {
      test('should return price for valid symbol', async () => {
        const response = await request(app)
          .get('/api/prices/BTC')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.symbol).toBe('BTC');
        expect(response.body.data.price).toBeDefined();
      });

      test('should handle lowercase symbols', async () => {
        const response = await request(app)
          .get('/api/prices/btc')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return 400 for invalid symbol', async () => {
        const response = await request(app)
          .get('/api/prices/INVALID')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_SYMBOL');
      });

      /**
       * Feature: service-migration-to-backend, Property 7: Frontend service stub delegation
       * Validates: Requirements 3.4
       */
      test('Property 7: should accept all valid crypto symbols', async () => {
        const validSymbols = ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'MATIC', 'LINK', 'UNI'];

        for (const symbol of validSymbols) {
          const response = await request(app)
            .get(`/api/prices/${symbol}`)
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });
    });

    describe('GET /api/prices', () => {
      test('should return prices for multiple symbols', async () => {
        const response = await request(app)
          .get('/api/prices?symbols=BTC,ETH')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.prices).toBeDefined();
        expect(response.body.metadata.symbolsRequested).toBe(2);
      });

      test('should support currency parameter', async () => {
        const response = await request(app)
          .get('/api/prices?symbols=BTC&currency=EUR')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  // ============================================
  // Lending Rate Endpoints Tests
  // ============================================
  describe('Lending Rate Endpoints', () => {
    describe('GET /api/lending-rates/:token', () => {
      test('should return lending rates for valid token', async () => {
        const response = await request(app)
          .get('/api/lending-rates/USDC')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.token).toBe('USDC');
        expect(response.body.data.protocols).toBeDefined();
      });

      test('should handle lowercase tokens', async () => {
        const response = await request(app)
          .get('/api/lending-rates/usdc')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return 400 for invalid token', async () => {
        const response = await request(app)
          .get('/api/lending-rates/INVALID')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_TOKEN');
      });

      test('should filter by protocols', async () => {
        const response = await request(app)
          .get('/api/lending-rates/USDC?protocols=aave')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return 400 for invalid protocol', async () => {
        const response = await request(app)
          .get('/api/lending-rates/USDC?protocols=invalid')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_PROTOCOL');
      });

      /**
       * Feature: service-migration-to-backend, Property 7: Frontend service stub delegation
       * Validates: Requirements 2.4
       */
      test('Property 7: should accept all valid lending tokens', async () => {
        const validTokens = ['ETH', 'DAI', 'USDC', 'USDT', 'WBTC'];

        for (const token of validTokens) {
          const response = await request(app)
            .get(`/api/lending-rates/${token}`)
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });
    });

    describe('GET /api/lending-rates', () => {
      test('should return all protocol rates', async () => {
        const response = await request(app)
          .get('/api/lending-rates')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.protocols).toBeDefined();
      });
    });
  });

  // ============================================
  // Token Balance Endpoints Tests
  // ============================================
  describe('Token Balance Endpoints', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';

    describe('GET /api/balances/:address', () => {
      test('should return balances for valid address', async () => {
        const response = await request(app)
          .get(`/api/balances/${validAddress}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.address).toBe(validAddress);
      });

      test('should return 400 for invalid address format', async () => {
        const response = await request(app)
          .get('/api/balances/invalid-address')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_ADDRESS');
      });

      test('should support network parameter', async () => {
        const response = await request(app)
          .get(`/api/balances/${validAddress}?network=polygon`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return 400 for invalid network', async () => {
        const response = await request(app)
          .get(`/api/balances/${validAddress}?network=invalid`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_NETWORK');
      });

      test('should support token address parameter', async () => {
        const tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const response = await request(app)
          .get(`/api/balances/${validAddress}?tokenAddress=${tokenAddress}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      /**
       * Feature: service-migration-to-backend, Property 7: Frontend service stub delegation
       * Validates: Requirements 4.4
       */
      test('Property 7: should validate address format correctly', async () => {
        // Valid addresses
        const validAddresses = [
          '0x1234567890123456789012345678901234567890',
          '0xabcdef1234567890abcdef1234567890abcdef12',
          '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
        ];

        for (const address of validAddresses) {
          const response = await request(app)
            .get(`/api/balances/${address}`)
            .expect(200);

          expect(response.body.success).toBe(true);
        }

        // Invalid addresses
        const invalidAddresses = [
          '1234567890123456789012345678901234567890', // missing 0x
          '0x123456789012345678901234567890123456789', // too short
          '0x12345678901234567890123456789012345678901', // too long
          '0xGHIJKL1234567890123456789012345678901234' // invalid hex
        ];

        for (const address of invalidAddresses) {
          const response = await request(app)
            .get(`/api/balances/${address}`)
            .expect(400);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('INVALID_ADDRESS');
        }
      });
    });

    describe('GET /api/portfolio/:address', () => {
      test('should return portfolio value for valid address', async () => {
        const response = await request(app)
          .get(`/api/portfolio/${validAddress}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.totalUSD).toBeDefined();
      });

      test('should support multiple networks', async () => {
        const response = await request(app)
          .get(`/api/portfolio/${validAddress}?networks=ethereum,polygon`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.metadata.networksQueried).toBe(2);
      });

      test('should return 400 for invalid address', async () => {
        const response = await request(app)
          .get('/api/portfolio/invalid')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_ADDRESS');
      });
    });
  });

  // ============================================
  // Utility Endpoints Tests
  // ============================================
  describe('Utility Endpoints', () => {
    describe('GET /api/supported', () => {
      test('should return all supported options', async () => {
        const response = await request(app)
          .get('/api/supported')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.networks).toBeDefined();
        expect(response.body.data.cryptocurrencies).toBeDefined();
        expect(response.body.data.lendingTokens).toBeDefined();
        expect(response.body.data.protocols).toBeDefined();
        expect(response.body.data.currencies).toBeDefined();
      });
    });
  });

  // ============================================
  // Property-Based Tests
  // ============================================
  describe('Property-Based Tests', () => {
    /**
     * Feature: service-migration-to-backend, Property 19: Service performance maintenance
     * Validates: Requirements 10.1
     */
    describe('Property 19: Service performance maintenance', () => {
      test('all endpoints should include execution timing metadata', async () => {
        const testAddress = '0x1234567890123456789012345678901234567890';
        const endpoints = [
          '/api/gas-prices/ethereum',
          '/api/prices/BTC',
          '/api/lending-rates/USDC',
          `/api/balances/${testAddress}`
        ];

        for (const endpoint of endpoints) {
          const response = await request(app).get(endpoint);

          if (response.status === 200) {
            expect(response.body.metadata).toBeDefined();
            expect(response.body.metadata.executionTime).toBeDefined();
            expect(typeof response.body.metadata.executionTime).toBe('number');
            expect(response.body.metadata.timestamp).toBeDefined();
          }
        }
      });
    });

    /**
     * Feature: service-migration-to-backend, Property 20: Concurrent request handling
     * Validates: Requirements 10.2
     */
    describe('Property 20: Concurrent request handling', () => {
      test('should handle multiple concurrent requests', async () => {
        const validAddress = '0x1234567890123456789012345678901234567890';

        const requests = [
          request(app).get('/api/gas-prices/ethereum'),
          request(app).get('/api/gas-prices/polygon'),
          request(app).get('/api/prices/BTC'),
          request(app).get('/api/prices/ETH'),
          request(app).get('/api/lending-rates/USDC'),
          request(app).get(`/api/balances/${validAddress}`)
        ];

        const responses = await Promise.all(requests);

        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
      });
    });

    /**
     * Feature: service-migration-to-backend, Property 13: Structured error response provision
     * Validates: Requirements 8.1
     */
    describe('Property 13: Structured error response provision', () => {
      test('all error responses should have consistent structure', async () => {
        const invalidRequests = [
          '/api/gas-prices/invalid-network',
          '/api/prices/INVALID',
          '/api/lending-rates/INVALID',
          '/api/balances/invalid-address'
        ];

        for (const endpoint of invalidRequests) {
          const response = await request(app).get(endpoint);

          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBeDefined();
          expect(response.body.error.type).toBeDefined();
          expect(response.body.error.message).toBeDefined();
          expect(response.body.error.code).toBeDefined();
          expect(response.body.metadata).toBeDefined();
          expect(response.body.metadata.timestamp).toBeDefined();
        }
      });
    });
  });
});

