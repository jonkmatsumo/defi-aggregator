import priceFeedService from '../../src/services/priceFeedService';
import apiClient from '../../src/services/apiClient';

// Mock the apiClient
jest.mock('../../src/services/apiClient', () => ({
  get: jest.fn(),
  getWebSocketUrl: jest.fn().mockReturnValue('ws://localhost:3001'),
  __esModule: true,
  default: {
    get: jest.fn(),
    getWebSocketUrl: jest.fn().mockReturnValue('ws://localhost:3001')
  }
}));

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }
  
  send(data) {
    // Mock send method
  }
};

describe('PriceFeedService', () => {
  beforeEach(() => {
    // Reset service state before each test
    priceFeedService.cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    priceFeedService.cleanup();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with correct default values', () => {
      expect(priceFeedService.subscribers).toBeInstanceOf(Map);
      expect(priceFeedService.dataBuffer).toBeInstanceOf(Map);
      expect(priceFeedService.bufferSize).toBe(100);
      expect(priceFeedService.maxReconnectAttempts).toBe(5);
      expect(priceFeedService.isConnected).toBe(false);
    });

    test('should have supported token pairs', () => {
      const supportedPairs = priceFeedService.getSupportedPairs();
      expect(supportedPairs).toContain('BTC/USDT');
      expect(supportedPairs).toContain('ETH/USDT');
      expect(supportedPairs).toContain('SOL/USDT');
      expect(supportedPairs).toContain('MATIC/USDT');
    });
  });

  describe('Token Pair Support', () => {
    test('should return correct base prices for token pairs', () => {
      expect(priceFeedService.getBasePrice('BTC/USDT')).toBe(42000);
      expect(priceFeedService.getBasePrice('ETH/USDT')).toBe(2500);
      expect(priceFeedService.getBasePrice('SOL/USDT')).toBe(100);
      expect(priceFeedService.getBasePrice('MATIC/USDT')).toBe(0.8);
    });

    test('should return default price for unsupported pairs', () => {
      expect(priceFeedService.getBasePrice('UNKNOWN/PAIR')).toBe(100);
    });
  });

  describe('Data Validation', () => {
    test('should validate correct price data', () => {
      const validData = {
        p: '42000.50'
      };
      expect(priceFeedService.validatePriceData(validData)).toBe(true);
    });

    test('should reject invalid price data', () => {
      // Null data
      expect(priceFeedService.validatePriceData(null)).toBe(false);
      
      // Empty object
      expect(priceFeedService.validatePriceData({})).toBe(false);
      
      // Non-numeric price
      expect(priceFeedService.validatePriceData({ p: 'invalid' })).toBe(false);
      
      // Zero price
      expect(priceFeedService.validatePriceData({ p: '0' })).toBe(false);
      
      // Negative price
      expect(priceFeedService.validatePriceData({ p: '-100' })).toBe(false);
    });
  });

  describe('Buffer Management', () => {
    test('should add data to buffer correctly', () => {
      const tokenPair = 'BTC/USDT';
      const priceData = { time: Date.now(), price: 42000, volume: 0.1, timestamp: Date.now() };
      
      priceFeedService.addToBuffer(tokenPair, priceData);
      const buffer = priceFeedService.getBufferData(tokenPair);
      
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual(priceData);
    });

    test('should maintain buffer size limit', () => {
      const tokenPair = 'BTC/USDT';
      const bufferSize = priceFeedService.bufferSize;
      
      // Add more than buffer size
      for (let i = 0; i < bufferSize + 10; i++) {
        priceFeedService.addToBuffer(tokenPair, {
          time: Date.now() + i,
          price: 42000 + i,
          volume: 0.1,
          timestamp: Date.now() + i
        });
      }
      
      const buffer = priceFeedService.getBufferData(tokenPair);
      expect(buffer).toHaveLength(bufferSize);
      expect(buffer[0].price).toBe(42000 + 10); // Should have removed oldest items
    });
  });

  describe('Historical Data Generation', () => {
    test('should generate mock historical data', () => {
      const tokenPair = 'BTC/USDT';
      const historicalData = priceFeedService.generateMockHistoricalData(tokenPair);
      
      expect(historicalData).toHaveLength(priceFeedService.bufferSize);
      expect(historicalData[0]).toHaveProperty('time');
      expect(historicalData[0]).toHaveProperty('price');
      expect(historicalData[0]).toHaveProperty('volume');
      expect(historicalData[0]).toHaveProperty('timestamp');
    });

    test('should generate data with realistic price ranges', () => {
      const tokenPair = 'BTC/USDT';
      const historicalData = priceFeedService.generateMockHistoricalData(tokenPair);
      
      const prices = historicalData.map(d => d.price);
      const basePrice = priceFeedService.getBasePrice(tokenPair);
      
      // Prices should be within reasonable range of base price
      prices.forEach(price => {
        expect(price).toBeGreaterThan(basePrice * 0.95);
        expect(price).toBeLessThan(basePrice * 1.05);
      });
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe to token pair', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      const unsubscribe = priceFeedService.subscribe(tokenPair, callback);
      
      expect(priceFeedService.subscribers.has(tokenPair)).toBe(true);
      expect(priceFeedService.subscribers.get(tokenPair).has(callback)).toBe(true);
      expect(typeof unsubscribe).toBe('function');
    });

    test('should unsubscribe from token pair', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      const unsubscribe = priceFeedService.subscribe(tokenPair, callback);
      unsubscribe();
      
      expect(priceFeedService.subscribers.get(tokenPair).has(callback)).toBe(false);
    });

    test('should throw error for unsupported token pair', () => {
      const unsupportedPair = 'UNKNOWN/PAIR';
      const callback = jest.fn();
      
      expect(() => {
        priceFeedService.subscribe(unsupportedPair, callback);
      }).toThrow(`Unsupported token pair: ${unsupportedPair}`);
    });

    test('should handle multiple subscribers for same token pair', () => {
      const tokenPair = 'BTC/USDT';
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      priceFeedService.subscribe(tokenPair, callback1);
      priceFeedService.subscribe(tokenPair, callback2);
      
      const subscribers = priceFeedService.subscribers.get(tokenPair);
      expect(subscribers.size).toBe(2);
      expect(subscribers.has(callback1)).toBe(true);
      expect(subscribers.has(callback2)).toBe(true);
    });
  });

  describe('Connection Status', () => {
    test('should track connection status', () => {
      const tokenPair = 'BTC/USDT';
      
      // Initially not connected
      expect(priceFeedService.getConnectionStatus(tokenPair)).toBe(false);
      
      // After connection
      priceFeedService.isConnected = true;
      expect(priceFeedService.getConnectionStatus(tokenPair)).toBe(true);
      
      // Reset
      priceFeedService.isConnected = false;
    });
  });

  describe('WebSocket Message Handling', () => {
    test('should handle subscription_confirmed message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      priceFeedService.handleWebSocketMessage({
        type: 'subscription_confirmed',
        symbols: ['BTC', 'ETH']
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Subscription confirmed:', ['BTC', 'ETH']);
      consoleSpy.mockRestore();
    });

    test('should handle price_update message', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      // Subscribe first
      priceFeedService.subscribers.set(tokenPair, new Set([callback]));
      priceFeedService.dataBuffer.set(tokenPair, []);
      
      priceFeedService.handleWebSocketMessage({
        type: 'price_update',
        symbol: 'BTC',
        data: { price: 42000, volume_24h: 1000000, change_24h: 2.5 },
        timestamp: Date.now()
      });
      
      // Should add to buffer and notify subscribers
      const buffer = priceFeedService.getBufferData(tokenPair);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should handle error message', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      priceFeedService.handleWebSocketMessage({
        type: 'error',
        message: 'Test error'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error from backend:', 'Test error');
      consoleSpy.mockRestore();
    });
  });

  describe('Notify Subscribers', () => {
    test('should notify subscribers for token pair', () => {
      const tokenPair = 'BTC/USDT';
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      priceFeedService.subscribers.set(tokenPair, new Set([callback1, callback2]));
      
      const testData = { type: 'test', data: 'test data' };
      priceFeedService.notifySubscribers(tokenPair, testData);
      
      expect(callback1).toHaveBeenCalledWith(testData);
      expect(callback2).toHaveBeenCalledWith(testData);
    });

    test('should handle callback errors gracefully', () => {
      const tokenPair = 'BTC/USDT';
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      priceFeedService.subscribers.set(tokenPair, new Set([errorCallback, normalCallback]));
      
      // Should not throw
      expect(() => {
        priceFeedService.notifySubscribers(tokenPair, { type: 'test' });
      }).not.toThrow();
      
      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all connections and data', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      // Set up some state
      priceFeedService.subscribe(tokenPair, callback);
      priceFeedService.addToBuffer(tokenPair, { time: Date.now(), price: 42000, volume: 0.1, timestamp: Date.now() });
      priceFeedService.isConnected = true;
      priceFeedService.reconnectAttempts = 2;
      
      // Verify state exists
      expect(priceFeedService.subscribers.has(tokenPair)).toBe(true);
      expect(priceFeedService.dataBuffer.has(tokenPair)).toBe(true);
      expect(priceFeedService.reconnectAttempts).toBe(2);
      
      // Cleanup
      priceFeedService.cleanup();
      
      // Verify all state is cleared
      expect(priceFeedService.subscribers.size).toBe(0);
      expect(priceFeedService.dataBuffer.size).toBe(0);
      expect(priceFeedService.reconnectAttempts).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle subscriber callback errors gracefully', () => {
      const tokenPair = 'BTC/USDT';
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      
      // Should not throw when subscriber callback fails
      expect(() => {
        priceFeedService.subscribe(tokenPair, errorCallback);
        priceFeedService.notifySubscribers(tokenPair, { type: 'test', data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Symbol to Pair Mapping', () => {
    test('should correctly map symbols to token pairs', () => {
      expect(priceFeedService.pairToSymbol['BTC/USDT']).toBe('BTC');
      expect(priceFeedService.pairToSymbol['ETH/USDT']).toBe('ETH');
      expect(priceFeedService.pairToSymbol['SOL/USDT']).toBe('SOL');
      expect(priceFeedService.pairToSymbol['MATIC/USDT']).toBe('MATIC');
    });
  });
});