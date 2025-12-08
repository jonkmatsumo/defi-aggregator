import { BaseService } from './base.js';
import { APIClient } from './apiClient.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';
import WebSocket from 'ws';

/**
 * Backend service for real-time cryptocurrency price data
 * Migrated from frontend priceFeedService with enhanced API integration and WebSocket support
 */
export class PriceFeedAPIService extends BaseService {
  constructor(config = {}) {
    super({
      cacheTimeout: 60000, // 1 minute for price data
      rateLimitWindow: 60000, // 1 minute window
      rateLimitMax: 120, // 120 requests per minute
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    });

    // Initialize API client
    this.apiClient = new APIClient({
      timeout: 10000,
      retryAttempts: 2,
      userAgent: 'DeFi-Backend-PriceFeed/1.0.0'
    });

    // Supported cryptocurrencies configuration
    this.supportedSymbols = {
      'BTC': {
        name: 'Bitcoin',
        coinGeckoId: 'bitcoin',
        binanceSymbol: 'BTCUSDT',
        decimals: 8
      },
      'ETH': {
        name: 'Ethereum',
        coinGeckoId: 'ethereum',
        binanceSymbol: 'ETHUSDT',
        decimals: 18
      },
      'USDC': {
        name: 'USD Coin',
        coinGeckoId: 'usd-coin',
        binanceSymbol: 'USDCUSDT',
        decimals: 6
      },
      'USDT': {
        name: 'Tether',
        coinGeckoId: 'tether',
        binanceSymbol: 'USDTUSDT',
        decimals: 6
      },
      'SOL': {
        name: 'Solana',
        coinGeckoId: 'solana',
        binanceSymbol: 'SOLUSDT',
        decimals: 9
      },
      'MATIC': {
        name: 'Polygon',
        coinGeckoId: 'matic-network',
        binanceSymbol: 'MATICUSDT',
        decimals: 18
      },
      'LINK': {
        name: 'Chainlink',
        coinGeckoId: 'chainlink',
        binanceSymbol: 'LINKUSDT',
        decimals: 18
      },
      'UNI': {
        name: 'Uniswap',
        coinGeckoId: 'uniswap',
        binanceSymbol: 'UNIUSDT',
        decimals: 18
      }
    };

    // API endpoints configuration
    this.apiEndpoints = {
      coinGecko: {
        baseURL: 'https://api.coingecko.com/api/v3',
        simplePrice: '/simple/price',
        coins: '/coins',
        ping: '/ping'
      },
      binance: {
        baseURL: 'https://api.binance.com/api/v3',
        ticker24hr: '/ticker/24hr',
        klines: '/klines',
        websocket: 'wss://stream.binance.com:9443/ws'
      },
      coinMarketCap: {
        baseURL: 'https://pro-api.coinmarketcap.com/v1',
        quotes: '/cryptocurrency/quotes/latest'
      }
    };

    // WebSocket management
    this.wsConnections = new Map(); // symbol -> WebSocket connection
    this.wsSubscribers = new Map(); // symbol -> Set of callback functions
    this.wsReconnectAttempts = new Map(); // symbol -> attempt count
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Fallback price data for error cases
    this.fallbackPrices = {
      'BTC': { price: 42000, change_24h: 2.5, volume_24h: 15000000000 },
      'ETH': { price: 2500, change_24h: 3.2, volume_24h: 8000000000 },
      'USDC': { price: 1.00, change_24h: 0.01, volume_24h: 2000000000 },
      'USDT': { price: 1.00, change_24h: -0.01, volume_24h: 25000000000 },
      'SOL': { price: 100, change_24h: 5.1, volume_24h: 1500000000 },
      'MATIC': { price: 0.8, change_24h: 1.8, volume_24h: 400000000 },
      'LINK': { price: 15, change_24h: 2.1, volume_24h: 300000000 },
      'UNI': { price: 8, change_24h: 1.5, volume_24h: 200000000 }
    };

    // Set up API credentials
    this.setupAPICredentials();

    logger.info('PriceFeedAPIService initialized', { 
      supportedSymbols: Object.keys(this.supportedSymbols),
      cacheTimeout: this.config.cacheTimeout 
    });
  }

  /**
   * Set up API credentials for external services
   */
  setupAPICredentials() {
    const apiKeys = this.config.apiKeys || {};

    if (apiKeys.coinGecko) {
      this.apiClient.setCredentials('coinGecko', { apiKey: apiKeys.coinGecko });
    }
    if (apiKeys.coinMarketCap) {
      this.apiClient.setCredentials('coinMarketCap', { apiKey: apiKeys.coinMarketCap });
    }
  }

  /**
   * Get current price for specific cryptocurrency
   * @param {string} symbol - Cryptocurrency symbol (e.g., BTC, ETH)
   * @param {string} currency - Fiat currency for price conversion (default: USD)
   * @param {boolean} includeMarketData - Include additional market data
   * @returns {Object} Price data with market information
   */
  async getCryptocurrencyPrice(symbol, currency = 'USD', includeMarketData = true) {
    if (!this.supportedSymbols[symbol]) {
      throw new ServiceError(`Unsupported cryptocurrency symbol: ${symbol}`);
    }

    const cacheKey = `price_${symbol}_${currency}`;

    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Check rate limiting
    if (!this.checkRateLimit(`price_${symbol}`)) {
      logger.warn('Rate limit exceeded for price request', { symbol, currency });
      return this.getFallbackPrice(symbol, currency);
    }

    try {
      const priceData = await this.executeWithRetry(async () => {
        return await this.fetchPriceFromAPI(symbol, currency, includeMarketData);
      });

      // Cache the result
      this.setCachedData(cacheKey, priceData);

      logger.info('Cryptocurrency price fetched successfully', { 
        symbol, 
        currency,
        price: priceData.price 
      });

      return priceData;

    } catch (error) {
      logger.error('Failed to fetch cryptocurrency price', { 
        symbol, 
        currency,
        error: error.message 
      });

      // Return fallback data on error
      const fallbackData = this.getFallbackPrice(symbol, currency);
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Fetch prices for multiple cryptocurrencies
   * @param {Array<string>} symbols - Array of cryptocurrency symbols
   * @param {string} currency - Fiat currency for price conversion
   * @returns {Object} Prices for each symbol
   */
  async getMultiplePrices(symbols, currency = 'USD') {
    const validSymbols = symbols.filter(symbol => this.supportedSymbols[symbol]);
    
    if (validSymbols.length === 0) {
      throw new ServiceError('No valid cryptocurrency symbols specified');
    }

    const pricePromises = validSymbols.map(async (symbol) => {
      try {
        const priceData = await this.getCryptocurrencyPrice(symbol, currency);
        return { symbol, data: priceData, success: true };
      } catch (error) {
        logger.warn('Failed to fetch price for symbol', { 
          symbol, 
          error: error.message 
        });
        return { 
          symbol, 
          data: this.getFallbackPrice(symbol, currency), 
          success: false 
        };
      }
    });

    const results = await Promise.allSettled(pricePromises);
    const prices = {};

    results.forEach((result, index) => {
      const symbol = validSymbols[index];
      if (result.status === 'fulfilled') {
        prices[symbol] = result.value.data;
      } else {
        prices[symbol] = this.getFallbackPrice(symbol, currency);
      }
    });

    return {
      prices,
      timestamp: Date.now(),
      source: 'backend_api'
    };
  }

  /**
   * Get historical price data for charting
   * @param {string} symbol - Cryptocurrency symbol
   * @param {string} timeframe - Time period (24h, 7d, 30d)
   * @param {string} interval - Data interval (1h, 4h, 1d)
   * @returns {Object} Historical price data
   */
  async getPriceHistory(symbol, timeframe = '24h', interval = '1h') {
    if (!this.supportedSymbols[symbol]) {
      throw new ServiceError(`Unsupported cryptocurrency symbol: ${symbol}`);
    }

    const cacheKey = `history_${symbol}_${timeframe}_${interval}`;

    // Check cache first (longer cache for historical data)
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const historyData = await this.executeWithRetry(async () => {
        return await this.fetchHistoryFromAPI(symbol, timeframe, interval);
      });

      // Cache with longer TTL for historical data
      this.setCachedData(cacheKey, historyData);

      logger.info('Price history fetched successfully', { 
        symbol, 
        timeframe,
        interval,
        dataPoints: historyData.data.length 
      });

      return historyData;

    } catch (error) {
      logger.error('Failed to fetch price history', { 
        symbol, 
        timeframe,
        interval,
        error: error.message 
      });

      // Generate mock historical data as fallback
      const fallbackData = this.generateMockHistoricalData(symbol, timeframe, interval);
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Get comprehensive market data for a cryptocurrency
   * @param {string} symbol - Cryptocurrency symbol
   * @returns {Object} Market data including market cap, volume, supply
   */
  async getMarketData(symbol) {
    if (!this.supportedSymbols[symbol]) {
      throw new ServiceError(`Unsupported cryptocurrency symbol: ${symbol}`);
    }

    const cacheKey = `market_${symbol}`;

    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const marketData = await this.executeWithRetry(async () => {
        return await this.fetchMarketDataFromAPI(symbol);
      });

      // Cache the result
      this.setCachedData(cacheKey, marketData);

      logger.info('Market data fetched successfully', { 
        symbol,
        marketCap: marketData.market_cap 
      });

      return marketData;

    } catch (error) {
      logger.error('Failed to fetch market data', { 
        symbol,
        error: error.message 
      });

      // Return fallback market data
      const fallbackData = this.getFallbackMarketData(symbol);
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Subscribe to real-time price updates via WebSocket
   * @param {Array<string>} symbols - Symbols to subscribe to
   * @param {Function} callback - Callback function for price updates
   * @returns {Function} Unsubscribe function
   */
  subscribeToRealTimePrices(symbols, callback) {
    const validSymbols = symbols.filter(symbol => this.supportedSymbols[symbol]);
    
    if (validSymbols.length === 0) {
      throw new ServiceError('No valid cryptocurrency symbols specified for subscription');
    }

    // Add callback to subscribers for each symbol
    validSymbols.forEach(symbol => {
      if (!this.wsSubscribers.has(symbol)) {
        this.wsSubscribers.set(symbol, new Set());
      }
      this.wsSubscribers.get(symbol).add(callback);

      // Connect WebSocket if not already connected
      if (!this.wsConnections.has(symbol)) {
        this.connectWebSocket(symbol);
      }
    });

    // Return unsubscribe function
    return () => {
      validSymbols.forEach(symbol => {
        const subscribers = this.wsSubscribers.get(symbol);
        if (subscribers) {
          subscribers.delete(callback);
          
          // Close WebSocket if no more subscribers
          if (subscribers.size === 0) {
            this.disconnectWebSocket(symbol);
          }
        }
      });
    };
  }

  /**
   * Connect WebSocket for real-time price updates
   * @param {string} symbol - Cryptocurrency symbol
   */
  async connectWebSocket(symbol) {
    const symbolConfig = this.supportedSymbols[symbol];
    if (!symbolConfig) {
      throw new ServiceError(`Unsupported symbol for WebSocket: ${symbol}`);
    }

    try {
      const wsUrl = `${this.apiEndpoints.binance.websocket}/${symbolConfig.binanceSymbol.toLowerCase()}@ticker`;
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        logger.info('WebSocket connected for symbol', { symbol });
        this.wsReconnectAttempts.set(symbol, 0);
        
        // Notify subscribers of connection
        this.notifyWebSocketSubscribers(symbol, {
          type: 'connection',
          status: 'connected',
          timestamp: Date.now()
        });
      });

      ws.on('message', (data) => {
        try {
          const tickerData = JSON.parse(data.toString());
          this.processWebSocketPriceData(symbol, tickerData);
        } catch (error) {
          logger.error('Error parsing WebSocket data', { symbol, error: error.message });
        }
      });

      ws.on('close', (code, reason) => {
        logger.warn('WebSocket disconnected', { symbol, code, reason: reason.toString() });
        
        // Notify subscribers of disconnection
        this.notifyWebSocketSubscribers(symbol, {
          type: 'connection',
          status: 'disconnected',
          timestamp: Date.now()
        });

        // Attempt reconnection if not manually closed
        if (code !== 1000) {
          this.attemptWebSocketReconnect(symbol);
        }
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { symbol, error: error.message });
      });

      this.wsConnections.set(symbol, ws);

    } catch (error) {
      logger.error('Failed to connect WebSocket', { symbol, error: error.message });
      this.attemptWebSocketReconnect(symbol);
    }
  }

  /**
   * Disconnect WebSocket for a symbol
   * @param {string} symbol - Cryptocurrency symbol
   */
  disconnectWebSocket(symbol) {
    const ws = this.wsConnections.get(symbol);
    if (ws) {
      ws.close(1000, 'Manual disconnect');
      this.wsConnections.delete(symbol);
      logger.info('WebSocket disconnected manually', { symbol });
    }
  }

  /**
   * Attempt WebSocket reconnection with exponential backoff
   * @param {string} symbol - Cryptocurrency symbol
   */
  attemptWebSocketReconnect(symbol) {
    const attempts = this.wsReconnectAttempts.get(symbol) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error('Max WebSocket reconnection attempts reached', { symbol });
      this.notifyWebSocketSubscribers(symbol, {
        type: 'error',
        message: 'Max reconnection attempts reached',
        timestamp: Date.now()
      });
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), 30000);
    
    logger.info('Attempting WebSocket reconnection', { 
      symbol, 
      attempt: attempts + 1, 
      delay 
    });
    
    setTimeout(() => {
      this.wsReconnectAttempts.set(symbol, attempts + 1);
      this.connectWebSocket(symbol);
    }, delay);
  }

  /**
   * Process WebSocket price data and notify subscribers
   * @param {string} symbol - Cryptocurrency symbol
   * @param {Object} tickerData - Binance ticker data
   */
  processWebSocketPriceData(symbol, tickerData) {
    try {
      const priceData = {
        symbol,
        price: parseFloat(tickerData.c), // Current price
        change_24h: parseFloat(tickerData.P), // 24h price change percentage
        volume_24h: parseFloat(tickerData.v), // 24h volume
        high_24h: parseFloat(tickerData.h), // 24h high
        low_24h: parseFloat(tickerData.l), // 24h low
        timestamp: tickerData.E || Date.now() // Event time
      };

      // Validate price data
      if (this.validatePriceData(priceData)) {
        this.notifyWebSocketSubscribers(symbol, {
          type: 'price_update',
          data: priceData,
          timestamp: Date.now()
        });
      } else {
        logger.warn('Invalid WebSocket price data received', { symbol, tickerData });
      }

    } catch (error) {
      logger.error('Error processing WebSocket price data', { 
        symbol, 
        error: error.message 
      });
    }
  }

  /**
   * Notify WebSocket subscribers for a symbol
   * @param {string} symbol - Cryptocurrency symbol
   * @param {Object} data - Data to send to subscribers
   */
  notifyWebSocketSubscribers(symbol, data) {
    const subscribers = this.wsSubscribers.get(symbol);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error in WebSocket subscriber callback', { 
            symbol, 
            error: error.message 
          });
        }
      });
    }
  }

  /**
   * Fetch price data from external APIs
   * @param {string} symbol - Cryptocurrency symbol
   * @param {string} currency - Fiat currency
   * @param {boolean} includeMarketData - Include market data
   * @returns {Object} Price data
   */
  async fetchPriceFromAPI(symbol, currency, includeMarketData) {
    
    try {
      // Try CoinGecko first
      return await this.fetchFromCoinGecko(symbol, currency, includeMarketData);
    } catch (error) {
      logger.warn('CoinGecko API failed, trying Binance', { 
        symbol, 
        error: error.message 
      });
      
      try {
        // Fallback to Binance
        return await this.fetchFromBinance(symbol, currency, includeMarketData);
      } catch (binanceError) {
        logger.warn('Binance API also failed', { 
          symbol, 
          error: binanceError.message 
        });
        
        // Try CoinMarketCap if available
        if (this.apiClient.hasCredentials('coinMarketCap')) {
          return await this.fetchFromCoinMarketCap(symbol, currency, includeMarketData);
        }
        
        throw error; // Throw original CoinGecko error
      }
    }
  }

  /**
   * Fetch price from CoinGecko API
   */
  async fetchFromCoinGecko(symbol, currency, includeMarketData) {
    const symbolConfig = this.supportedSymbols[symbol];
    const currencyLower = currency.toLowerCase();
    
    let url = `${this.apiEndpoints.coinGecko.baseURL}${this.apiEndpoints.coinGecko.simplePrice}`;
    url += `?ids=${symbolConfig.coinGeckoId}&vs_currencies=${currencyLower}`;
    
    if (includeMarketData) {
      url += '&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true';
    }

    const response = await this.apiClient.get(url, {
      rateLimitKey: 'coinGecko',
      rateLimit: { maxRequests: 50, windowMs: 60000 }
    });

    const coinData = response[symbolConfig.coinGeckoId];
    if (!coinData) {
      throw new ServiceError(`No price data found for ${symbol} from CoinGecko`);
    }

    return {
      symbol,
      price: coinData[currencyLower],
      currency: currency.toUpperCase(),
      change_24h: coinData[`${currencyLower}_24h_change`] || null,
      volume_24h: coinData[`${currencyLower}_24h_vol`] || null,
      market_cap: coinData[`${currencyLower}_market_cap`] || null,
      timestamp: Date.now(),
      source: 'coingecko'
    };
  }

  /**
   * Fetch price from Binance API
   */
  async fetchFromBinance(symbol, currency, _includeMarketData) {
    const symbolConfig = this.supportedSymbols[symbol];
    
    const url = `${this.apiEndpoints.binance.baseURL}${this.apiEndpoints.binance.ticker24hr}`;
    const params = `?symbol=${symbolConfig.binanceSymbol}`;

    const response = await this.apiClient.get(url + params, {
      rateLimitKey: 'binance',
      rateLimit: { maxRequests: 1200, windowMs: 60000 }
    });

    // Convert USDT price to requested currency (simplified)
    const usdtPrice = parseFloat(response.lastPrice);
    const convertedPrice = currency.toUpperCase() === 'USD' ? usdtPrice : usdtPrice;

    return {
      symbol,
      price: convertedPrice,
      currency: currency.toUpperCase(),
      change_24h: parseFloat(response.priceChangePercent),
      volume_24h: parseFloat(response.volume),
      market_cap: null, // Not available from Binance ticker
      timestamp: Date.now(),
      source: 'binance'
    };
  }

  /**
   * Fetch price from CoinMarketCap API
   */
  async fetchFromCoinMarketCap(symbol, currency, _includeMarketData) {
    const credentials = this.apiClient.getCredentials('coinMarketCap');
    
    const url = `${this.apiEndpoints.coinMarketCap.baseURL}${this.apiEndpoints.coinMarketCap.quotes}`;
    const params = `?symbol=${symbol}&convert=${currency.toUpperCase()}`;

    const response = await this.apiClient.get(url + params, {
      headers: {
        'X-CMC_PRO_API_KEY': credentials.apiKey
      },
      rateLimitKey: 'coinMarketCap',
      rateLimit: { maxRequests: 333, windowMs: 60000 }
    });

    if (response.status.error_code !== 0) {
      throw new ServiceError(`CoinMarketCap API error: ${response.status.error_message}`);
    }

    const coinData = response.data[symbol];
    if (!coinData) {
      throw new ServiceError(`No price data found for ${symbol} from CoinMarketCap`);
    }

    const quote = coinData.quote[currency.toUpperCase()];

    return {
      symbol,
      price: quote.price,
      currency: currency.toUpperCase(),
      change_24h: quote.percent_change_24h,
      volume_24h: quote.volume_24h,
      market_cap: quote.market_cap,
      timestamp: Date.now(),
      source: 'coinmarketcap'
    };
  }

  /**
   * Fetch historical price data from API
   */
  async fetchHistoryFromAPI(symbol, timeframe, interval) {
    // For now, generate mock data - in production, use CoinGecko history API
    return this.generateMockHistoricalData(symbol, timeframe, interval);
  }

  /**
   * Fetch market data from API
   */
  async fetchMarketDataFromAPI(symbol) {
    // Use the same price API but focus on market data
    const priceData = await this.fetchPriceFromAPI(symbol, 'USD', true);
    
    return {
      symbol,
      market_cap: priceData.market_cap,
      volume_24h: priceData.volume_24h,
      circulating_supply: null, // Would need additional API call
      total_supply: null, // Would need additional API call
      max_supply: null, // Would need additional API call
      timestamp: Date.now(),
      source: priceData.source
    };
  }

  /**
   * Generate mock historical data for fallback
   */
  generateMockHistoricalData(symbol, timeframe, interval) {
    const fallbackPrice = this.fallbackPrices[symbol]?.price || 100;
    const data = [];
    
    // Calculate number of data points based on timeframe and interval
    const timeframeHours = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
    const intervalHours = interval === '1h' ? 1 : interval === '4h' ? 4 : 24;
    const dataPoints = Math.floor(timeframeHours / intervalHours);
    
    const now = Date.now();
    
    for (let i = 0; i < dataPoints; i++) {
      const time = now - (dataPoints - i) * intervalHours * 60 * 60 * 1000;
      const price = fallbackPrice + Math.sin(i * 0.1) * (fallbackPrice * 0.05) + 
                   (Math.random() - 0.5) * (fallbackPrice * 0.02);
      
      data.push({
        timestamp: time,
        price: parseFloat(price.toFixed(2)),
        volume: Math.random() * 1000000
      });
    }
    
    return {
      symbol,
      timeframe,
      interval,
      data,
      timestamp: Date.now(),
      source: 'mock'
    };
  }

  /**
   * Get fallback price data
   */
  getFallbackPrice(symbol, currency) {
    const fallback = this.fallbackPrices[symbol];
    if (!fallback) {
      throw new ServiceError(`No fallback data available for symbol: ${symbol}`);
    }

    return {
      symbol,
      price: fallback.price,
      currency: currency.toUpperCase(),
      change_24h: fallback.change_24h,
      volume_24h: fallback.volume_24h,
      market_cap: null,
      timestamp: Date.now(),
      source: 'fallback'
    };
  }

  /**
   * Get fallback market data
   */
  getFallbackMarketData(symbol) {
    const fallback = this.fallbackPrices[symbol];
    if (!fallback) {
      throw new ServiceError(`No fallback market data available for symbol: ${symbol}`);
    }

    return {
      symbol,
      market_cap: fallback.price * 1000000, // Mock market cap
      volume_24h: fallback.volume_24h,
      circulating_supply: null,
      total_supply: null,
      max_supply: null,
      timestamp: Date.now(),
      source: 'fallback'
    };
  }

  /**
   * Validate price data
   */
  validatePriceData(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.price !== 'number' || data.price <= 0) return false;
    if (data.timestamp && (typeof data.timestamp !== 'number' || data.timestamp <= 0)) return false;
    return true;
  }

  /**
   * Get supported cryptocurrency symbols
   */
  getSupportedSymbols() {
    return { ...this.supportedSymbols };
  }

  /**
   * Clear cache for specific symbol or all symbols
   */
  clearCache(symbol = null) {
    if (symbol) {
      super.clearCache(`price_${symbol}_USD`);
      super.clearCache(`market_${symbol}`);
    } else {
      // Clear all price-related cache entries
      Object.keys(this.supportedSymbols).forEach(sym => {
        super.clearCache(`price_${sym}_USD`);
        super.clearCache(`market_${sym}`);
      });
    }
  }

  /**
   * Cleanup WebSocket connections
   */
  cleanup() {
    this.wsConnections.forEach((ws, symbol) => {
      this.disconnectWebSocket(symbol);
    });
    this.wsConnections.clear();
    this.wsSubscribers.clear();
    this.wsReconnectAttempts.clear();
  }
}