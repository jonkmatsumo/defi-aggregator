import priceFeedService from '../../src/services/priceFeedService';

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  close(code = 1000, reason = '') {
    this.readyState = 3; // CLOSED
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
  });

  afterEach(() => {
    // Cleanup after each test
    priceFeedService.cleanup();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with correct default values', () => {
      expect(priceFeedService.connections).toBeInstanceOf(Map);
      expect(priceFeedService.subscribers).toBeInstanceOf(Map);
      expect(priceFeedService.dataBuffer).toBeInstanceOf(Map);
      expect(priceFeedService.bufferSize).toBe(100);
      expect(priceFeedService.maxReconnectAttempts).toBe(5);
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
        p: '42000.50',
        q: '0.1',
        T: 1640995200000
      };
      expect(priceFeedService.validatePriceData(validData)).toBe(true);
    });

    test('should reject invalid price data', () => {
      const invalidData = [
        null,
        {},
        { p: 'invalid' },
        { p: '42000.50' }, // missing timestamp
        { p: '42000.50', T: 'invalid' }, // invalid timestamp
        { p: '-100', T: 1640995200000 }, // negative price
        { p: '0', T: 1640995200000 } // zero price
      ];

      invalidData.forEach(data => {
        expect(priceFeedService.validatePriceData(data)).toBe(false);
      });
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
      
      // After connection attempt (mocked)
      priceFeedService.isConnected.set(tokenPair, true);
      expect(priceFeedService.getConnectionStatus(tokenPair)).toBe(true);
    });
  });

  describe('Data Processing', () => {
    test('should process valid price data', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      priceFeedService.subscribe(tokenPair, callback);
      
      const validData = {
        p: '42000.50',
        q: '0.1',
        T: Date.now()
      };
      
      priceFeedService.processPriceData(tokenPair, validData);
      
      expect(callback).toHaveBeenCalledWith({
        type: 'price',
        data: {
          time: validData.T,
          price: 42000.50,
          volume: 0.1,
          timestamp: validData.T
        },
        buffer: expect.any(Array),
        timestamp: expect.any(Number)
      });
    });

    test('should ignore invalid price data', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      priceFeedService.subscribe(tokenPair, callback);
      
      // Clear the callback calls from historical data loading
      callback.mockClear();
      
      const invalidData = { p: 'invalid' };
      
      priceFeedService.processPriceData(tokenPair, invalidData);
      
      // Should not call callback for invalid data
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all connections and data', () => {
      const tokenPair = 'BTC/USDT';
      const callback = jest.fn();
      
      // Set up some state
      priceFeedService.subscribe(tokenPair, callback);
      priceFeedService.addToBuffer(tokenPair, { time: Date.now(), price: 42000, volume: 0.1, timestamp: Date.now() });
      priceFeedService.isConnected.set(tokenPair, true);
      priceFeedService.reconnectAttempts.set(tokenPair, 2);
      
      // Verify state exists
      expect(priceFeedService.subscribers.has(tokenPair)).toBe(true);
      expect(priceFeedService.dataBuffer.has(tokenPair)).toBe(true);
      expect(priceFeedService.isConnected.has(tokenPair)).toBe(true);
      expect(priceFeedService.reconnectAttempts.has(tokenPair)).toBe(true);
      
      // Cleanup
      priceFeedService.cleanup();
      
      // Verify all state is cleared
      expect(priceFeedService.subscribers.size).toBe(0);
      expect(priceFeedService.dataBuffer.size).toBe(0);
      expect(priceFeedService.isConnected.size).toBe(0);
      expect(priceFeedService.reconnectAttempts.size).toBe(0);
      expect(priceFeedService.connections.size).toBe(0);
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
}); 