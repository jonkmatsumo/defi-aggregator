// Real-Time Price Feed Service using WebSocket
// Supports multiple token pairs with automatic reconnection and data validation

class PriceFeedService {
  constructor() {
    this.connections = new Map(); // Map of tokenPair -> WebSocket connection
    this.subscribers = new Map(); // Map of tokenPair -> Set of callback functions
    this.reconnectAttempts = new Map(); // Track reconnect attempts per token pair
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.dataBuffer = new Map(); // Rolling buffer of last 100 data points per token pair
    this.bufferSize = 100;
    this.isConnected = new Map(); // Track connection status per token pair
    
    // Supported token pairs and their WebSocket endpoints
    this.supportedPairs = {
      'BTC/USDT': {
        wsUrl: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
        restUrl: 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT',
        symbol: 'BTCUSDT'
      },
      'ETH/USDT': {
        wsUrl: 'wss://stream.binance.com:9443/ws/ethusdt@trade',
        restUrl: 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT',
        symbol: 'ETHUSDT'
      },
      'ETH/USD': {
        wsUrl: 'wss://stream.binance.com:9443/ws/ethusdt@trade', // Using USDT as proxy
        restUrl: 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT',
        symbol: 'ETHUSDT'
      },
      'SOL/USDT': {
        wsUrl: 'wss://stream.binance.com:9443/ws/solusdt@trade',
        restUrl: 'https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT',
        symbol: 'SOLUSDT'
      },
      'MATIC/USDT': {
        wsUrl: 'wss://stream.binance.com:9443/ws/maticusdt@trade',
        restUrl: 'https://api.binance.com/api/v3/ticker/24hr?symbol=MATICUSDT',
        symbol: 'MATICUSDT'
      }
    };
  }

  // Subscribe to real-time price updates for a token pair
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

    // Connect if not already connected
    if (!this.connections.has(tokenPair)) {
      this.connect(tokenPair);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(tokenPair, callback);
    };
  }

  // Unsubscribe from price updates
  unsubscribe(tokenPair, callback) {
    const subscribers = this.subscribers.get(tokenPair);
    if (subscribers) {
      subscribers.delete(callback);
      
      // If no more subscribers, close connection
      if (subscribers.size === 0) {
        this.disconnect(tokenPair);
      }
    }
  }

  // Connect to WebSocket for a specific token pair
  async connect(tokenPair) {
    const pairConfig = this.supportedPairs[tokenPair];
    if (!pairConfig) {
      throw new Error(`Unsupported token pair: ${tokenPair}`);
    }

    // Don't connect if already connected
    if (this.connections.has(tokenPair) && this.isConnected.get(tokenPair)) {
      return;
    }

    try {
      // Load historical data first
      await this.loadHistoricalData(tokenPair);

      // Create WebSocket connection
      const ws = new WebSocket(pairConfig.wsUrl);
      
      ws.onopen = () => {
        console.log(`WebSocket connected for ${tokenPair}`);
        this.isConnected.set(tokenPair, true);
        this.reconnectAttempts.set(tokenPair, 0);
        
        // Notify subscribers of connection status
        this.notifySubscribers(tokenPair, {
          type: 'connection',
          status: 'connected',
          timestamp: Date.now()
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.processPriceData(tokenPair, data);
        } catch (error) {
          console.error(`Error parsing WebSocket data for ${tokenPair}:`, error);
        }
      };

      ws.onclose = (event) => {
        console.log(`WebSocket disconnected for ${tokenPair}:`, event.code, event.reason);
        this.isConnected.set(tokenPair, false);
        
        // Notify subscribers of disconnection
        this.notifySubscribers(tokenPair, {
          type: 'connection',
          status: 'disconnected',
          timestamp: Date.now()
        });

        // Attempt reconnection if not manually closed
        if (event.code !== 1000) {
          this.attemptReconnect(tokenPair);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${tokenPair}:`, error);
        this.isConnected.set(tokenPair, false);
      };

      this.connections.set(tokenPair, ws);
    } catch (error) {
      console.error(`Error connecting to WebSocket for ${tokenPair}:`, error);
      this.attemptReconnect(tokenPair);
    }
  }

  // Disconnect WebSocket for a token pair
  disconnect(tokenPair) {
    const ws = this.connections.get(tokenPair);
    if (ws) {
      ws.close(1000, 'Manual disconnect');
      this.connections.delete(tokenPair);
      this.isConnected.set(tokenPair, false);
      console.log(`WebSocket disconnected for ${tokenPair}`);
    }
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect(tokenPair) {
    const attempts = this.reconnectAttempts.get(tokenPair) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${tokenPair}`);
      this.notifySubscribers(tokenPair, {
        type: 'error',
        message: 'Max reconnection attempts reached',
        timestamp: Date.now()
      });
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), this.maxReconnectDelay);
    
    console.log(`Attempting to reconnect to ${tokenPair} in ${delay}ms (attempt ${attempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts.set(tokenPair, attempts + 1);
      this.connect(tokenPair);
    }, delay);
  }

  // Load historical data for initial chart display
  async loadHistoricalData(tokenPair) {
    const pairConfig = this.supportedPairs[tokenPair];
    if (!pairConfig) return;

    try {
      // For demo purposes, generate mock historical data
      // In production, you would fetch from a REST API
      const historicalData = this.generateMockHistoricalData(tokenPair);
      this.dataBuffer.set(tokenPair, historicalData);
      
      // Notify subscribers with historical data
      this.notifySubscribers(tokenPair, {
        type: 'historical',
        data: historicalData,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`Error loading historical data for ${tokenPair}:`, error);
    }
  }

  // Generate mock historical data for initial chart
  generateMockHistoricalData(tokenPair) {
    const data = [];
    const basePrice = this.getBasePrice(tokenPair);
    const now = Date.now();
    
    for (let i = 0; i < this.bufferSize; i++) {
      const time = now - (this.bufferSize - i) * 60000; // 1 minute intervals
      const price = basePrice + Math.sin(i * 0.1) * (basePrice * 0.02) + Math.random() * (basePrice * 0.01);
      data.push({
        time,
        price: parseFloat(price.toFixed(2)),
        volume: Math.random() * 1000,
        timestamp: time
      });
    }
    
    return data;
  }

  // Get base price for token pair
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

  // Process incoming price data
  processPriceData(tokenPair, data) {
    // Validate incoming data
    if (!this.validatePriceData(data)) {
      console.warn(`Invalid price data received for ${tokenPair}:`, data);
      return;
    }

    // Extract price from Binance trade data
    const price = parseFloat(data.p);
    const volume = parseFloat(data.q);
    const timestamp = data.T || Date.now();

    // Create price data point
    const priceData = {
      time: timestamp,
      price,
      volume,
      timestamp
    };

    // Add to rolling buffer
    this.addToBuffer(tokenPair, priceData);

    // Notify subscribers
    this.notifySubscribers(tokenPair, {
      type: 'price',
      data: priceData,
      buffer: this.dataBuffer.get(tokenPair),
      timestamp: Date.now()
    });
  }

  // Validate incoming price data
  validatePriceData(data) {
    if (!data) return false;
    if (typeof data.p !== 'string') return false;
    if (isNaN(parseFloat(data.p))) return false;
    if (parseFloat(data.p) <= 0) return false;
    if (!data.T) return false;
    if (typeof data.T !== 'number') return false;
    if (data.T <= 0) return false;
    return true;
  }

  // Add data point to rolling buffer
  addToBuffer(tokenPair, priceData) {
    const buffer = this.dataBuffer.get(tokenPair) || [];
    buffer.push(priceData);
    
    // Keep only the last bufferSize items
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }
    
    this.dataBuffer.set(tokenPair, buffer);
  }

  // Notify all subscribers for a token pair
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

  // Get current buffer data for a token pair
  getBufferData(tokenPair) {
    return this.dataBuffer.get(tokenPair) || [];
  }

  // Get connection status for a token pair
  getConnectionStatus(tokenPair) {
    return this.isConnected.get(tokenPair) || false;
  }

  // Get all supported token pairs
  getSupportedPairs() {
    return Object.keys(this.supportedPairs);
  }

  // Cleanup all connections
  cleanup() {
    this.connections.forEach((ws, tokenPair) => {
      this.disconnect(tokenPair);
    });
    this.connections.clear();
    this.subscribers.clear();
    this.dataBuffer.clear();
    this.isConnected.clear();
    this.reconnectAttempts.clear();
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