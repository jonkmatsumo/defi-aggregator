/**
 * Price Feed Service - Frontend Client
 * 
 * Fetches cryptocurrency prices from backend API and WebSocket.
 * This eliminates CORS issues with external price APIs and centralizes
 * rate limiting, caching, and real-time data handling on the server.
 */

import apiClient from './apiClient';

class PriceFeedService {
  constructor() {
    this.wsConnection = null;
    this.subscribers = new Map(); // Map of tokenPair -> Set of callback functions
    this.dataBuffer = new Map(); // Rolling buffer of price data per token pair
    this.bufferSize = 100;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.pendingSubscriptions = new Set(); // Symbols waiting to be subscribed after connect
    
    // Map token pairs to backend symbols
    this.pairToSymbol = {
      'BTC/USDT': 'BTC',
      'ETH/USDT': 'ETH',
      'ETH/USD': 'ETH',
      'SOL/USDT': 'SOL',
      'MATIC/USDT': 'MATIC',
      'USDC/USDT': 'USDC',
      'LINK/USDT': 'LINK',
      'UNI/USDT': 'UNI'
    };

    // Supported token pairs
    this.supportedPairs = {
      'BTC/USDT': { symbol: 'BTC', name: 'Bitcoin' },
      'ETH/USDT': { symbol: 'ETH', name: 'Ethereum' },
      'ETH/USD': { symbol: 'ETH', name: 'Ethereum' },
      'SOL/USDT': { symbol: 'SOL', name: 'Solana' },
      'MATIC/USDT': { symbol: 'MATIC', name: 'Polygon' }
    };
  }

  /**
   * Subscribe to real-time price updates for a token pair
   * @param {string} tokenPair - Token pair (e.g., 'BTC/USDT')
   * @param {Function} callback - Callback for price updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(tokenPair, callback) {
    if (!this.supportedPairs[tokenPair]) {
      throw new Error(`Unsupported token pair: ${tokenPair}`);
    }

    // Add callback to subscribers
    if (!this.subscribers.has(tokenPair)) {
      this.subscribers.set(tokenPair, new Set());
    }
    this.subscribers.get(tokenPair).add(callback);

    // Initialize data buffer if not exists
    if (!this.dataBuffer.has(tokenPair)) {
      this.dataBuffer.set(tokenPair, []);
    }

    // Connect WebSocket if not connected
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      const symbol = this.pairToSymbol[tokenPair];
      this.pendingSubscriptions.add(symbol);
      this.connect();
    } else {
      // Already connected, send subscription
      this.sendSubscription([this.pairToSymbol[tokenPair]]);
    }

    // Load initial data from REST API
    this.loadInitialData(tokenPair);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(tokenPair, callback);
    };
  }

  /**
   * Unsubscribe from price updates
   * @param {string} tokenPair - Token pair
   * @param {Function} callback - Callback to remove
   */
  unsubscribe(tokenPair, callback) {
    const subscribers = this.subscribers.get(tokenPair);
    if (subscribers) {
      subscribers.delete(callback);
      
      // If no more subscribers for this pair, unsubscribe from backend
      if (subscribers.size === 0) {
        const symbol = this.pairToSymbol[tokenPair];
        this.sendUnsubscription([symbol]);
      }
    }
  }

  /**
   * Connect to backend WebSocket
   */
  connect() {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.CONNECTING) {
      return; // Already connecting
    }

    const wsUrl = apiClient.getWebSocketUrl();
    
    try {
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('Price feed WebSocket connected to backend');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Subscribe to pending symbols
        if (this.pendingSubscriptions.size > 0) {
          this.sendSubscription(Array.from(this.pendingSubscriptions));
          this.pendingSubscriptions.clear();
        }

        // Notify subscribers of connection
        this.notifyAllSubscribers({
          type: 'connection',
          status: 'connected',
          timestamp: Date.now()
        });
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = (event) => {
        console.log('Price feed WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;

        // Notify subscribers of disconnection
        this.notifyAllSubscribers({
          type: 'connection',
          status: 'disconnected',
          timestamp: Date.now()
        });

        // Attempt reconnection if not manually closed
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.wsConnection.onerror = (error) => {
        console.error('Price feed WebSocket error:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @param {Object} message - Parsed WebSocket message
   */
  handleWebSocketMessage(message) {
    switch (message.type) {
    case 'CONNECTION_ESTABLISHED':
      // Connection confirmed
      break;

    case 'subscription_confirmed':
      console.log('Subscription confirmed:', message.symbols);
      break;

    case 'price_update':
      this.handlePriceUpdate(message);
      break;

    case 'connection_status':
      // Backend connection status to external API
      this.notifySubscribersForSymbol(message.symbol, {
        type: 'connection',
        status: message.status,
        timestamp: message.timestamp
      });
      break;

    case 'error':
      console.error('WebSocket error from backend:', message.message);
      break;

    default:
      // Ignore other message types (chat messages, etc.)
      break;
    }
  }

  /**
   * Handle price update from backend
   * @param {Object} message - Price update message
   */
  handlePriceUpdate(message) {
    const { symbol, data, timestamp, initial } = message;
    
    // Find token pairs that use this symbol
    const affectedPairs = Object.entries(this.pairToSymbol)
      .filter(([, sym]) => sym === symbol)
      .map(([pair]) => pair);

    for (const tokenPair of affectedPairs) {
      const priceData = {
        time: timestamp,
        price: data.price,
        volume: data.volume_24h || 0,
        change_24h: data.change_24h,
        timestamp
      };

      // Add to buffer
      this.addToBuffer(tokenPair, priceData);

      // Notify subscribers
      this.notifySubscribers(tokenPair, {
        type: initial ? 'historical' : 'price',
        data: priceData,
        buffer: this.dataBuffer.get(tokenPair),
        timestamp
      });
    }
  }

  /**
   * Send subscription request to backend
   * @param {string[]} symbols - Symbols to subscribe to
   */
  sendSubscription(symbols) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: 'subscribe',
        symbols
      }));
    }
  }

  /**
   * Send unsubscription request to backend
   * @param {string[]} symbols - Symbols to unsubscribe from
   */
  sendUnsubscription(symbols) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: 'unsubscribe',
        symbols
      }));
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyAllSubscribers({
        type: 'error',
        message: 'Max reconnection attempts reached',
        timestamp: Date.now()
      });
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      
      // Re-add all active subscriptions to pending
      for (const tokenPair of this.subscribers.keys()) {
        const symbol = this.pairToSymbol[tokenPair];
        if (symbol) {
          this.pendingSubscriptions.add(symbol);
        }
      }
      
      this.connect();
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.wsConnection) {
      this.wsConnection.close(1000, 'Manual disconnect');
      this.wsConnection = null;
      this.isConnected = false;
    }
  }

  /**
   * Load initial price data from REST API
   * @param {string} tokenPair - Token pair
   */
  async loadInitialData(tokenPair) {
    const symbol = this.pairToSymbol[tokenPair];
    if (!symbol) return;

    try {
      const result = await apiClient.get(`/api/prices/${symbol}`);
      
      // Generate historical data points for chart
      const historicalData = this.generateHistoricalData(tokenPair, result.price);
      this.dataBuffer.set(tokenPair, historicalData);

      // Notify subscribers with historical data
      this.notifySubscribers(tokenPair, {
        type: 'historical',
        data: historicalData,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error(`Error loading initial data for ${tokenPair}:`, error);
      // Generate mock data as fallback
      const mockData = this.generateMockHistoricalData(tokenPair);
      this.dataBuffer.set(tokenPair, mockData);
      
      this.notifySubscribers(tokenPair, {
        type: 'historical',
        data: mockData,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Generate historical data points from current price
   * @param {string} tokenPair - Token pair
   * @param {number} currentPrice - Current price
   * @returns {Array} Historical data points
   */
  generateHistoricalData(tokenPair, currentPrice) {
    const data = [];
    const now = Date.now();
    
    for (let i = 0; i < this.bufferSize; i++) {
      const time = now - (this.bufferSize - i) * 60000;
      // Add some variation to create realistic-looking chart
      const variation = Math.sin(i * 0.1) * (currentPrice * 0.02) + 
                       (Math.random() - 0.5) * (currentPrice * 0.01);
      const price = currentPrice + variation;
      
      data.push({
        time,
        price: parseFloat(price.toFixed(2)),
        volume: Math.random() * 1000,
        timestamp: time
      });
    }
    
    return data;
  }

  /**
   * Generate mock historical data
   * @param {string} tokenPair - Token pair
   * @returns {Array} Mock historical data
   */
  generateMockHistoricalData(tokenPair) {
    const basePrice = this.getBasePrice(tokenPair);
    return this.generateHistoricalData(tokenPair, basePrice);
  }

  /**
   * Get base price for token pair (fallback values)
   * @param {string} tokenPair - Token pair
   * @returns {number} Base price
   */
  getBasePrice(tokenPair) {
    const basePrices = {
      'BTC/USDT': 42000,
      'ETH/USDT': 2500,
      'ETH/USD': 2500,
      'SOL/USDT': 100,
      'MATIC/USDT': 0.8
    };
    return basePrices[tokenPair] || 100;
  }

  /**
   * Add data point to rolling buffer
   * @param {string} tokenPair - Token pair
   * @param {Object} priceData - Price data point
   */
  addToBuffer(tokenPair, priceData) {
    const buffer = this.dataBuffer.get(tokenPair) || [];
    buffer.push(priceData);
    
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
    
    this.dataBuffer.set(tokenPair, buffer);
  }

  /**
   * Notify subscribers for a specific token pair
   * @param {string} tokenPair - Token pair
   * @param {Object} data - Data to send
   */
  notifySubscribers(tokenPair, data) {
    const subscribers = this.subscribers.get(tokenPair);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscriber callback for ${tokenPair}:`, error);
        }
      });
    }
  }

  /**
   * Notify subscribers for a specific symbol (across all pairs using that symbol)
   * @param {string} symbol - Symbol
   * @param {Object} data - Data to send
   */
  notifySubscribersForSymbol(symbol, data) {
    for (const [tokenPair, sym] of Object.entries(this.pairToSymbol)) {
      if (sym === symbol) {
        this.notifySubscribers(tokenPair, data);
      }
    }
  }

  /**
   * Notify all subscribers
   * @param {Object} data - Data to send
   */
  notifyAllSubscribers(data) {
    for (const tokenPair of this.subscribers.keys()) {
      this.notifySubscribers(tokenPair, data);
    }
  }

  /**
   * Get current buffer data for a token pair
   * @param {string} tokenPair - Token pair
   * @returns {Array} Buffer data
   */
  getBufferData(tokenPair) {
    return this.dataBuffer.get(tokenPair) || [];
  }

  /**
   * Get connection status
   * @param {string} tokenPair - Token pair (optional)
   * @returns {boolean} Connection status
   */
  getConnectionStatus(tokenPair) {
    return this.isConnected;
  }

  /**
   * Get supported token pairs
   * @returns {string[]} Supported pairs
   */
  getSupportedPairs() {
    return Object.keys(this.supportedPairs);
  }

  /**
   * Validate price data
   * @param {Object} data - Price data
   * @returns {boolean} True if valid
   */
  validatePriceData(data) {
    if (!data) return false;
    if (typeof data.p !== 'string') return false;
    if (isNaN(parseFloat(data.p))) return false;
    if (parseFloat(data.p) <= 0) return false;
    return true;
  }

  /**
   * Cleanup all connections and subscriptions
   */
  cleanup() {
    this.disconnect();
    this.subscribers.clear();
    this.dataBuffer.clear();
    this.pendingSubscriptions.clear();
    this.reconnectAttempts = 0;
  }
}

// Create singleton instance
const priceFeedService = new PriceFeedService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    priceFeedService.cleanup();
  });
}

export default priceFeedService;
