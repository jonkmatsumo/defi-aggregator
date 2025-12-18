import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fc from 'fast-check';

// Mock WebSocket
class MockWebSocket {
  constructor() {
    this.readyState = 1; // OPEN
    this.sentMessages = [];
    this.eventHandlers = {};
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
  }

  on(event, handler) {
    this.eventHandlers[event] = handler;
  }

  ping() {
    if (this.eventHandlers['pong']) {
      this.eventHandlers['pong']();
    }
  }

  terminate() {
    this.readyState = 3; // CLOSED
  }

  close() {
    this.readyState = 3; // CLOSED
  }

  // Helper to simulate pong response
  simulatePong() {
    if (this.eventHandlers['pong']) {
      this.eventHandlers['pong']();
    }
  }

  // Get last sent message
  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  // Clear sent messages
  clearMessages() {
    this.sentMessages = [];
  }
}

// Mock price feed service
const mockPriceFeedService = {
  getSupportedSymbols: jest.fn(() => ({
    BTC: { name: 'Bitcoin', coinGeckoId: 'bitcoin', binanceSymbol: 'BTCUSDT' },
    ETH: {
      name: 'Ethereum',
      coinGeckoId: 'ethereum',
      binanceSymbol: 'ETHUSDT',
    },
    USDC: {
      name: 'USD Coin',
      coinGeckoId: 'usd-coin',
      binanceSymbol: 'USDCUSDT',
    },
    SOL: { name: 'Solana', coinGeckoId: 'solana', binanceSymbol: 'SOLUSDT' },
    MATIC: {
      name: 'Polygon',
      coinGeckoId: 'matic-network',
      binanceSymbol: 'MATICUSDT',
    },
  })),
  getCryptocurrencyPrice: jest.fn().mockResolvedValue({
    symbol: 'BTC',
    price: 42000,
    change_24h: 2.5,
    volume_24h: 15000000000,
    market_cap: 820000000000,
    source: 'coingecko',
  }),
  subscribeToRealTimePrices: jest.fn().mockReturnValue(() => {}),
};

// Mock the service container before importing the handler
jest.unstable_mockModule('../../src/services/container.js', () => ({
  serviceContainer: {
    get: jest.fn(name => {
      if (name === 'PriceFeedAPIService') {
        return mockPriceFeedService;
      }
      throw new Error(`Unknown service: ${name}`);
    }),
  },
}));

// Now import the handler (after mocking)
const { PriceWebSocketHandler } =
  await import('../../src/websocket/priceHandler.js');

describe('PriceWebSocketHandler', () => {
  let handler;
  let mockWss;

  beforeEach(() => {
    mockWss = {
      on: jest.fn(),
      clients: new Set(),
    };

    handler = new PriceWebSocketHandler(mockWss, {
      maxSubscriptionsPerClient: 10,
      heartbeatInterval: 5000,
    });

    // Reset all mocks before each test
    mockPriceFeedService.getSupportedSymbols.mockClear();
    mockPriceFeedService.getCryptocurrencyPrice.mockClear();
    mockPriceFeedService.subscribeToRealTimePrices.mockClear();

    // Reset mock implementations
    mockPriceFeedService.getSupportedSymbols.mockReturnValue({
      BTC: {
        name: 'Bitcoin',
        coinGeckoId: 'bitcoin',
        binanceSymbol: 'BTCUSDT',
      },
      ETH: {
        name: 'Ethereum',
        coinGeckoId: 'ethereum',
        binanceSymbol: 'ETHUSDT',
      },
      USDC: {
        name: 'USD Coin',
        coinGeckoId: 'usd-coin',
        binanceSymbol: 'USDCUSDT',
      },
      SOL: { name: 'Solana', coinGeckoId: 'solana', binanceSymbol: 'SOLUSDT' },
      MATIC: {
        name: 'Polygon',
        coinGeckoId: 'matic-network',
        binanceSymbol: 'MATICUSDT',
      },
    });

    mockPriceFeedService.getCryptocurrencyPrice.mockResolvedValue({
      symbol: 'BTC',
      price: 42000,
      change_24h: 2.5,
      volume_24h: 15000000000,
      market_cap: 820000000000,
      source: 'coingecko',
    });

    mockPriceFeedService.subscribeToRealTimePrices.mockReturnValue(() => {});
  });

  afterEach(() => {
    if (handler) {
      handler.cleanup();
    }
  });

  describe('Unit Tests', () => {
    test('should initialize with correct configuration', () => {
      expect(handler.config.maxSubscriptionsPerClient).toBe(10);
      expect(handler.config.heartbeatInterval).toBe(5000);
      expect(handler.clients.size).toBe(0);
      expect(handler.clientSubscriptions.size).toBe(0);
    });

    test('should handle client connection', () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      expect(handler.clients.has(clientId)).toBe(true);
      expect(handler.clientSubscriptions.has(clientId)).toBe(true);
      expect(handler.clientSubscriptions.get(clientId).size).toBe(0);
    });

    test('should handle client disconnection', () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);
      expect(handler.clients.has(clientId)).toBe(true);

      handler.handleDisconnection(clientId);
      expect(handler.clients.has(clientId)).toBe(false);
      expect(handler.clientSubscriptions.has(clientId)).toBe(false);
    });

    test('should send error for invalid subscription symbols', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      // Subscribe to invalid symbols only
      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['INVALID1', 'INVALID2'],
      });

      const lastMessage = mockWs.getLastMessage();
      expect(lastMessage.type).toBe('error');
      expect(lastMessage.message).toContain('No valid symbols');
    });

    test('should subscribe to valid symbols', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC', 'ETH'],
      });

      // Find confirmation message
      const confirmMessage = mockWs.sentMessages.find(
        m => m.type === 'subscription_confirmed'
      );
      expect(confirmMessage).toBeDefined();
      expect(confirmMessage.symbols).toContain('BTC');
      expect(confirmMessage.symbols).toContain('ETH');
      expect(confirmMessage.added).toContain('BTC');
      expect(confirmMessage.added).toContain('ETH');
    });

    test('should unsubscribe from symbols', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      // Subscribe first
      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC', 'ETH'],
      });

      mockWs.clearMessages();

      // Unsubscribe
      await handler.handleMessage(clientId, {
        type: 'unsubscribe',
        symbols: ['BTC'],
      });

      const confirmMessage = mockWs.getLastMessage();
      expect(confirmMessage.type).toBe('unsubscription_confirmed');
      expect(confirmMessage.symbols).toContain('ETH');
      expect(confirmMessage.symbols).not.toContain('BTC');
      expect(confirmMessage.removed).toContain('BTC');
    });

    test('should enforce subscription limit', async () => {
      // Create handler with small limit
      const limitedHandler = new PriceWebSocketHandler(mockWss, {
        maxSubscriptionsPerClient: 3,
      });

      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      limitedHandler.handleConnection(clientId, mockWs);

      // Try to subscribe to more than limit
      await limitedHandler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC', 'ETH', 'USDC', 'SOL', 'MATIC'],
      });

      const lastMessage = mockWs.getLastMessage();
      expect(lastMessage.type).toBe('error');
      expect(lastMessage.message).toContain('Subscription limit exceeded');

      limitedHandler.cleanup();
    });

    test('should return current subscriptions', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      // Subscribe first
      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC', 'ETH'],
      });

      mockWs.clearMessages();

      // Request subscriptions
      await handler.handleMessage(clientId, {
        type: 'get_subscriptions',
      });

      const lastMessage = mockWs.getLastMessage();
      expect(lastMessage.type).toBe('subscriptions');
      expect(lastMessage.symbols).toContain('BTC');
      expect(lastMessage.symbols).toContain('ETH');
    });

    test('should send error message correctly', () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);
      handler.sendError(clientId, 'Test error message');

      const lastMessage = mockWs.getLastMessage();
      expect(lastMessage.type).toBe('error');
      expect(lastMessage.message).toBe('Test error message');
      expect(lastMessage.timestamp).toBeDefined();
    });

    test('should get correct metrics', async () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();

      handler.handleConnection('client-1', mockWs1);
      handler.handleConnection('client-2', mockWs2);

      await handler.handleMessage('client-1', {
        type: 'subscribe',
        symbols: ['BTC', 'ETH'],
      });

      await handler.handleMessage('client-2', {
        type: 'subscribe',
        symbols: ['BTC'],
      });

      const metrics = handler.getMetrics();

      expect(metrics.connectedClients).toBe(2);
      expect(metrics.activeSubscriptions).toBe(2); // BTC and ETH
      expect(metrics.totalClientSubscriptions).toBe(3); // client-1 has 2, client-2 has 1
      expect(metrics.symbolSubscriberCounts.BTC).toBe(2);
      expect(metrics.symbolSubscriberCounts.ETH).toBe(1);
    });

    test('should handle price update from service', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC'],
      });

      mockWs.clearMessages();

      // Simulate price update
      handler.handlePriceUpdate('BTC', {
        type: 'price_update',
        data: {
          symbol: 'BTC',
          price: 43000,
          change_24h: 3.5,
        },
        timestamp: Date.now(),
      });

      const lastMessage = mockWs.getLastMessage();
      expect(lastMessage.type).toBe('price_update');
      expect(lastMessage.symbol).toBe('BTC');
      expect(lastMessage.data.price).toBe(43000);
    });

    test('should handle connection status update', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC'],
      });

      mockWs.clearMessages();

      // Simulate connection status update
      handler.handlePriceUpdate('BTC', {
        type: 'connection',
        status: 'disconnected',
        timestamp: Date.now(),
      });

      const lastMessage = mockWs.getLastMessage();
      expect(lastMessage.type).toBe('connection_status');
      expect(lastMessage.symbol).toBe('BTC');
      expect(lastMessage.status).toBe('disconnected');
    });

    test('should broadcast to all clients', () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();

      handler.handleConnection('client-1', mockWs1);
      handler.handleConnection('client-2', mockWs2);

      const broadcastMessage = { type: 'test', data: 'broadcast test' };
      handler.broadcast(broadcastMessage);

      expect(mockWs1.getLastMessage()).toEqual(broadcastMessage);
      expect(mockWs2.getLastMessage()).toEqual(broadcastMessage);
    });

    test('should cleanup properly', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.initialize();
      handler.handleConnection(clientId, mockWs);

      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC'],
      });

      expect(handler.clients.size).toBe(1);
      expect(handler.symbolSubscribers.size).toBeGreaterThan(0);

      handler.cleanup();

      expect(handler.clients.size).toBe(0);
      expect(handler.clientSubscriptions.size).toBe(0);
      expect(handler.symbolSubscribers.size).toBe(0);
      expect(handler.priceServiceUnsubscribers.size).toBe(0);
    });

    test('should cleanup subscriptions when client disconnects', async () => {
      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      handler.handleConnection(clientId, mockWs);

      await handler.handleMessage(clientId, {
        type: 'subscribe',
        symbols: ['BTC'],
      });

      expect(handler.symbolSubscribers.get('BTC')?.size).toBe(1);

      handler.handleDisconnection(clientId);

      // Symbol should be cleaned up when no subscribers
      expect(handler.symbolSubscribers.has('BTC')).toBe(false);
    });

    test('should not fail when sending to disconnected client', () => {
      const mockWs = new MockWebSocket();
      mockWs.readyState = 3; // CLOSED

      handler.handleConnection('client-1', mockWs);

      // Should not throw
      expect(() => {
        handler.sendToClient('client-1', { type: 'test' });
      }).not.toThrow();

      // Should not have sent message
      expect(mockWs.sentMessages.length).toBe(0);
    });
  });

  describe('Property-Based Tests', () => {
    // Property: WebSocket subscription/unsubscription consistency
    test('Property: subscription state remains consistent across operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              action: fc.constantFrom('subscribe', 'unsubscribe'),
              symbols: fc.array(
                fc.constantFrom('BTC', 'ETH', 'USDC', 'SOL', 'MATIC'),
                { minLength: 1, maxLength: 3 }
              ),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async operations => {
            const testHandler = new PriceWebSocketHandler(mockWss, {
              maxSubscriptionsPerClient: 20,
            });

            const mockWs = new MockWebSocket();
            const clientId = 'test-client';

            testHandler.handleConnection(clientId, mockWs);

            const expectedSubs = new Set();

            for (const op of operations) {
              if (op.action === 'subscribe') {
                await testHandler.handleMessage(clientId, {
                  type: 'subscribe',
                  symbols: op.symbols,
                });
                op.symbols.forEach(s => expectedSubs.add(s.toUpperCase()));
              } else {
                await testHandler.handleMessage(clientId, {
                  type: 'unsubscribe',
                  symbols: op.symbols,
                });
                op.symbols.forEach(s => expectedSubs.delete(s.toUpperCase()));
              }
            }

            // Property: Final subscription state should match expected
            const actualSubs = testHandler.clientSubscriptions.get(clientId);
            expect(actualSubs.size).toBe(expectedSubs.size);

            for (const symbol of expectedSubs) {
              expect(actualSubs.has(symbol)).toBe(true);
            }

            testHandler.cleanup();
          }
        ),
        { numRuns: 50 }
      );
    });

    // Property: Multiple clients can subscribe to same symbols
    test('Property: multiple clients subscribing to same symbols are all notified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          fc.array(fc.constantFrom('BTC', 'ETH', 'USDC'), {
            minLength: 1,
            maxLength: 3,
          }),
          async (numClients, symbols) => {
            const testHandler = new PriceWebSocketHandler(mockWss, {
              maxSubscriptionsPerClient: 10,
            });

            const clients = [];

            // Connect multiple clients and subscribe to same symbols
            for (let i = 0; i < numClients; i++) {
              const mockWs = new MockWebSocket();
              const clientId = `client-${i}`;
              testHandler.handleConnection(clientId, mockWs);

              await testHandler.handleMessage(clientId, {
                type: 'subscribe',
                symbols,
              });

              clients.push({ id: clientId, ws: mockWs });
            }

            // Clear all messages
            clients.forEach(c => c.ws.clearMessages());

            // Simulate price update for first symbol
            const testSymbol = symbols[0].toUpperCase();
            testHandler.handlePriceUpdate(testSymbol, {
              type: 'price_update',
              data: { symbol: testSymbol, price: 50000 },
              timestamp: Date.now(),
            });

            // Property: All clients should receive the price update
            for (const client of clients) {
              const lastMessage = client.ws.getLastMessage();
              expect(lastMessage).toBeDefined();
              expect(lastMessage.type).toBe('price_update');
              expect(lastMessage.symbol).toBe(testSymbol);
            }

            // Property: Metrics should show correct subscriber counts
            const metrics = testHandler.getMetrics();
            expect(metrics.symbolSubscriberCounts[testSymbol]).toBe(numClients);

            testHandler.cleanup();
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property: Unsubscribing one client doesn't affect others
    test('Property: unsubscribing one client does not affect other subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('BTC', 'ETH', 'USDC'),
          async symbol => {
            const testHandler = new PriceWebSocketHandler(mockWss, {
              maxSubscriptionsPerClient: 10,
            });

            const mockWs1 = new MockWebSocket();
            const mockWs2 = new MockWebSocket();

            testHandler.handleConnection('client-1', mockWs1);
            testHandler.handleConnection('client-2', mockWs2);

            // Both subscribe
            await testHandler.handleMessage('client-1', {
              type: 'subscribe',
              symbols: [symbol],
            });
            await testHandler.handleMessage('client-2', {
              type: 'subscribe',
              symbols: [symbol],
            });

            // Client 1 unsubscribes
            await testHandler.handleMessage('client-1', {
              type: 'unsubscribe',
              symbols: [symbol],
            });

            mockWs1.clearMessages();
            mockWs2.clearMessages();

            // Send price update
            const upperSymbol = symbol.toUpperCase();
            testHandler.handlePriceUpdate(upperSymbol, {
              type: 'price_update',
              data: { symbol: upperSymbol, price: 50000 },
              timestamp: Date.now(),
            });

            // Property: Client 1 should NOT receive update
            expect(mockWs1.sentMessages.length).toBe(0);

            // Property: Client 2 should still receive update
            const client2Message = mockWs2.getLastMessage();
            expect(client2Message).toBeDefined();
            expect(client2Message.type).toBe('price_update');

            testHandler.cleanup();
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property: Message format consistency
    test('Property: all messages have required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('subscribe', 'unsubscribe', 'get_subscriptions'),
          fc.array(fc.constantFrom('BTC', 'ETH', 'USDC'), {
            minLength: 1,
            maxLength: 3,
          }),
          async (messageType, symbols) => {
            const testHandler = new PriceWebSocketHandler(mockWss, {
              maxSubscriptionsPerClient: 10,
            });

            const mockWs = new MockWebSocket();
            testHandler.handleConnection('test-client', mockWs);

            // First subscribe if testing unsubscribe
            if (messageType === 'unsubscribe') {
              await testHandler.handleMessage('test-client', {
                type: 'subscribe',
                symbols,
              });
              mockWs.clearMessages();
            }

            await testHandler.handleMessage('test-client', {
              type: messageType,
              symbols,
            });

            // Property: All sent messages should have type and timestamp
            for (const message of mockWs.sentMessages) {
              expect(message.type).toBeDefined();
              expect(typeof message.type).toBe('string');
              expect(message.timestamp).toBeDefined();
              expect(typeof message.timestamp).toBe('number');
            }

            testHandler.cleanup();
          }
        ),
        { numRuns: 30 }
      );
    });

    // Property: Cleanup removes all state
    test('Property: cleanup completely removes all handler state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.array(fc.constantFrom('BTC', 'ETH', 'USDC', 'SOL'), {
            minLength: 1,
            maxLength: 4,
          }),
          async (numClients, symbols) => {
            const testHandler = new PriceWebSocketHandler(mockWss, {
              maxSubscriptionsPerClient: 20,
            });

            testHandler.initialize();

            // Connect clients and subscribe
            for (let i = 0; i < numClients; i++) {
              const mockWs = new MockWebSocket();
              testHandler.handleConnection(`client-${i}`, mockWs);
              await testHandler.handleMessage(`client-${i}`, {
                type: 'subscribe',
                symbols,
              });
            }

            // Verify state exists
            expect(testHandler.clients.size).toBe(numClients);
            expect(testHandler.clientSubscriptions.size).toBe(numClients);

            // Cleanup
            testHandler.cleanup();

            // Property: All state should be cleared
            expect(testHandler.clients.size).toBe(0);
            expect(testHandler.clientSubscriptions.size).toBe(0);
            expect(testHandler.symbolSubscribers.size).toBe(0);
            expect(testHandler.priceServiceUnsubscribers.size).toBe(0);
            expect(testHandler.heartbeatIntervalId).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property: Metrics accuracy
    test('Property: metrics accurately reflect current state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              clientId: fc.integer({ min: 1, max: 10 }).map(n => `client-${n}`),
              symbols: fc.array(fc.constantFrom('BTC', 'ETH', 'USDC', 'SOL'), {
                minLength: 1,
                maxLength: 4,
              }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async clientConfigs => {
            const testHandler = new PriceWebSocketHandler(mockWss, {
              maxSubscriptionsPerClient: 20,
            });

            const connectedClients = new Set();
            const symbolToClients = new Map();

            for (const config of clientConfigs) {
              if (!connectedClients.has(config.clientId)) {
                const mockWs = new MockWebSocket();
                testHandler.handleConnection(config.clientId, mockWs);
                connectedClients.add(config.clientId);
              }

              await testHandler.handleMessage(config.clientId, {
                type: 'subscribe',
                symbols: config.symbols,
              });

              // Track expected subscriptions
              config.symbols.forEach(s => {
                const upperS = s.toUpperCase();
                if (!symbolToClients.has(upperS)) {
                  symbolToClients.set(upperS, new Set());
                }
                symbolToClients.get(upperS).add(config.clientId);
              });
            }

            const metrics = testHandler.getMetrics();

            // Property: Connected clients count is accurate
            expect(metrics.connectedClients).toBe(connectedClients.size);

            // Property: Active subscriptions count matches unique symbols
            expect(metrics.activeSubscriptions).toBe(symbolToClients.size);

            // Property: Symbol subscriber counts are accurate
            for (const [symbol, clients] of symbolToClients) {
              expect(metrics.symbolSubscriberCounts[symbol]).toBe(clients.size);
            }

            testHandler.cleanup();
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('WebSocket Integration Properties', () => {
    // Property: Real-time price updates reach all subscribers
    test('Property: price updates are delivered to all appropriate subscribers', async () => {
      const testHandler = new PriceWebSocketHandler(mockWss, {
        maxSubscriptionsPerClient: 10,
      });

      // Set up multiple clients with different subscriptions
      const client1Ws = new MockWebSocket();
      const client2Ws = new MockWebSocket();
      const client3Ws = new MockWebSocket();

      testHandler.handleConnection('client-1', client1Ws);
      testHandler.handleConnection('client-2', client2Ws);
      testHandler.handleConnection('client-3', client3Ws);

      // Different subscription patterns
      await testHandler.handleMessage('client-1', {
        type: 'subscribe',
        symbols: ['BTC', 'ETH'],
      });
      await testHandler.handleMessage('client-2', {
        type: 'subscribe',
        symbols: ['BTC', 'USDC'],
      });
      await testHandler.handleMessage('client-3', {
        type: 'subscribe',
        symbols: ['ETH', 'USDC'],
      });

      // Clear setup messages
      client1Ws.clearMessages();
      client2Ws.clearMessages();
      client3Ws.clearMessages();

      // Send BTC update - should reach client-1 and client-2
      testHandler.handlePriceUpdate('BTC', {
        type: 'price_update',
        data: { symbol: 'BTC', price: 50000 },
        timestamp: Date.now(),
      });

      expect(
        client1Ws.sentMessages.some(
          m => m.type === 'price_update' && m.symbol === 'BTC'
        )
      ).toBe(true);
      expect(
        client2Ws.sentMessages.some(
          m => m.type === 'price_update' && m.symbol === 'BTC'
        )
      ).toBe(true);
      expect(
        client3Ws.sentMessages.some(
          m => m.type === 'price_update' && m.symbol === 'BTC'
        )
      ).toBe(false);

      // Clear and send ETH update - should reach client-1 and client-3
      client1Ws.clearMessages();
      client2Ws.clearMessages();
      client3Ws.clearMessages();

      testHandler.handlePriceUpdate('ETH', {
        type: 'price_update',
        data: { symbol: 'ETH', price: 3000 },
        timestamp: Date.now(),
      });

      expect(
        client1Ws.sentMessages.some(
          m => m.type === 'price_update' && m.symbol === 'ETH'
        )
      ).toBe(true);
      expect(
        client2Ws.sentMessages.some(
          m => m.type === 'price_update' && m.symbol === 'ETH'
        )
      ).toBe(false);
      expect(
        client3Ws.sentMessages.some(
          m => m.type === 'price_update' && m.symbol === 'ETH'
        )
      ).toBe(true);

      testHandler.cleanup();
    });

    // Property: Initial prices are sent on subscription
    test('Property: initial prices are sent when subscribing', async () => {
      const testHandler = new PriceWebSocketHandler(mockWss, {
        maxSubscriptionsPerClient: 10,
      });

      const mockWs = new MockWebSocket();
      testHandler.handleConnection('test-client', mockWs);

      await testHandler.handleMessage('test-client', {
        type: 'subscribe',
        symbols: ['BTC'],
      });

      // Should have subscription confirmation AND initial price
      const hasConfirmation = mockWs.sentMessages.some(
        m => m.type === 'subscription_confirmed'
      );
      const hasInitialPrice = mockWs.sentMessages.some(
        m => m.type === 'price_update' && m.initial === true
      );

      expect(hasConfirmation).toBe(true);
      expect(hasInitialPrice).toBe(true);

      // Verify getCryptocurrencyPrice was called for initial price
      expect(mockPriceFeedService.getCryptocurrencyPrice).toHaveBeenCalledWith(
        'BTC',
        'USD',
        true
      );

      testHandler.cleanup();
    });
  });
});
