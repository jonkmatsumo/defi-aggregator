import { logger } from '../utils/logger.js';
import { serviceContainer } from '../services/container.js';

/**
 * WebSocket handler for real-time cryptocurrency price updates
 * Bridges client WebSocket connections to the PriceFeedAPIService
 */
export class PriceWebSocketHandler {
  constructor(wss, config = {}) {
    this.wss = wss;
    this.config = {
      maxSubscriptionsPerClient: config.maxSubscriptionsPerClient || 20,
      heartbeatInterval: config.heartbeatInterval || 30000,
      ...config,
    };

    // Track client subscriptions: clientId -> Set of symbols
    this.clientSubscriptions = new Map();

    // Track symbol subscribers: symbol -> Set of clientIds
    this.symbolSubscribers = new Map();

    // Track WebSocket connections: clientId -> { ws, lastActivity }
    this.clients = new Map();

    // Price service unsubscribe functions
    this.priceServiceUnsubscribers = new Map();

    // Heartbeat interval
    this.heartbeatIntervalId = null;

    logger.info('PriceWebSocketHandler initialized', {
      maxSubscriptionsPerClient: this.config.maxSubscriptionsPerClient,
    });
  }

  /**
   * Initialize the price handler and set up event listeners
   */
  initialize() {
    // Start heartbeat to detect stale connections
    this.heartbeatIntervalId = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);

    logger.info('PriceWebSocketHandler ready for connections');
  }

  /**
   * Handle a new client connection for price subscriptions
   * @param {string} clientId - Unique client identifier
   * @param {WebSocket} ws - WebSocket connection
   */
  handleConnection(clientId, ws) {
    this.clients.set(clientId, {
      ws,
      lastActivity: Date.now(),
      isAlive: true,
    });

    this.clientSubscriptions.set(clientId, new Set());

    logger.info('Price WebSocket client connected', {
      clientId,
      totalClients: this.clients.size,
    });

    // Set up ping/pong for connection health
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
        client.lastActivity = Date.now();
      }
    });
  }

  /**
   * Handle a price-related message from a client
   * @param {string} clientId - Client identifier
   * @param {Object} message - Parsed message object
   */
  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn('Message from unknown client', { clientId });
      return;
    }

    client.lastActivity = Date.now();

    try {
      switch (message.type) {
        case 'subscribe':
          await this.handleSubscribe(clientId, message.symbols);
          break;

        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message.symbols);
          break;

        case 'get_subscriptions':
          this.sendCurrentSubscriptions(clientId);
          break;

        default:
          // Unknown message type for price handler - ignore
          break;
      }
    } catch (error) {
      logger.error('Error handling price message', {
        clientId,
        messageType: message.type,
        error: error.message,
      });
      this.sendError(clientId, error.message);
    }
  }

  /**
   * Handle client disconnection
   * @param {string} clientId - Client identifier
   */
  handleDisconnection(clientId) {
    const subscriptions = this.clientSubscriptions.get(clientId);

    if (subscriptions) {
      // Unsubscribe from all symbols
      for (const symbol of subscriptions) {
        this.removeClientFromSymbol(clientId, symbol);
      }
    }

    this.clientSubscriptions.delete(clientId);
    this.clients.delete(clientId);

    logger.info('Price WebSocket client disconnected', {
      clientId,
      remainingClients: this.clients.size,
    });
  }

  /**
   * Handle subscription request
   * @param {string} clientId - Client identifier
   * @param {Array<string>} symbols - Symbols to subscribe to
   */
  async handleSubscribe(clientId, symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      this.sendError(
        clientId,
        'Invalid subscription: symbols must be a non-empty array'
      );
      return;
    }

    const clientSubs = this.clientSubscriptions.get(clientId);
    if (!clientSubs) {
      this.sendError(clientId, 'Client not registered');
      return;
    }

    // Get the price feed service
    let priceFeedService;
    try {
      priceFeedService = serviceContainer.get('PriceFeedAPIService');
    } catch (error) {
      logger.error('PriceFeedAPIService not available', {
        error: error.message,
      });
      this.sendError(clientId, 'Price service unavailable');
      return;
    }

    // Validate symbols
    const supportedSymbols = priceFeedService.getSupportedSymbols();
    const validSymbols = symbols
      .map(s => s.toUpperCase())
      .filter(s => supportedSymbols[s]);

    if (validSymbols.length === 0) {
      this.sendError(
        clientId,
        `No valid symbols provided. Supported: ${Object.keys(supportedSymbols).join(', ')}`
      );
      return;
    }

    // Check subscription limit
    const currentCount = clientSubs.size;
    const newSymbols = validSymbols.filter(s => !clientSubs.has(s));

    if (
      currentCount + newSymbols.length >
      this.config.maxSubscriptionsPerClient
    ) {
      this.sendError(
        clientId,
        `Subscription limit exceeded. Maximum: ${this.config.maxSubscriptionsPerClient}`
      );
      return;
    }

    // Add subscriptions
    const subscribedSymbols = [];

    for (const symbol of validSymbols) {
      if (!clientSubs.has(symbol)) {
        clientSubs.add(symbol);
        this.addClientToSymbol(clientId, symbol, priceFeedService);
        subscribedSymbols.push(symbol);
      }
    }

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      symbols: Array.from(clientSubs),
      added: subscribedSymbols,
      timestamp: Date.now(),
    });

    logger.info('Client subscribed to symbols', {
      clientId,
      newSymbols: subscribedSymbols,
      totalSubscriptions: clientSubs.size,
    });

    // Send initial prices for newly subscribed symbols
    await this.sendInitialPrices(clientId, subscribedSymbols, priceFeedService);
  }

  /**
   * Handle unsubscription request
   * @param {string} clientId - Client identifier
   * @param {Array<string>} symbols - Symbols to unsubscribe from
   */
  async handleUnsubscribe(clientId, symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      this.sendError(
        clientId,
        'Invalid unsubscription: symbols must be a non-empty array'
      );
      return;
    }

    const clientSubs = this.clientSubscriptions.get(clientId);
    if (!clientSubs) {
      this.sendError(clientId, 'Client not registered');
      return;
    }

    const unsubscribedSymbols = [];

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      if (clientSubs.has(upperSymbol)) {
        clientSubs.delete(upperSymbol);
        this.removeClientFromSymbol(clientId, upperSymbol);
        unsubscribedSymbols.push(upperSymbol);
      }
    }

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      symbols: Array.from(clientSubs),
      removed: unsubscribedSymbols,
      timestamp: Date.now(),
    });

    logger.info('Client unsubscribed from symbols', {
      clientId,
      removedSymbols: unsubscribedSymbols,
      remainingSubscriptions: clientSubs.size,
    });
  }

  /**
   * Add a client to a symbol's subscriber list
   * @param {string} clientId - Client identifier
   * @param {string} symbol - Symbol to subscribe to
   * @param {Object} priceFeedService - Price feed service instance
   */
  addClientToSymbol(clientId, symbol, priceFeedService) {
    if (!this.symbolSubscribers.has(symbol)) {
      this.symbolSubscribers.set(symbol, new Set());

      // Start real-time subscription for this symbol
      this.startPriceSubscription(symbol, priceFeedService);
    }

    this.symbolSubscribers.get(symbol).add(clientId);
  }

  /**
   * Remove a client from a symbol's subscriber list
   * @param {string} clientId - Client identifier
   * @param {string} symbol - Symbol to unsubscribe from
   */
  removeClientFromSymbol(clientId, symbol) {
    const subscribers = this.symbolSubscribers.get(symbol);

    if (subscribers) {
      subscribers.delete(clientId);

      // If no more subscribers, stop the price subscription
      if (subscribers.size === 0) {
        this.stopPriceSubscription(symbol);
        this.symbolSubscribers.delete(symbol);
      }
    }
  }

  /**
   * Start real-time price subscription via PriceFeedAPIService
   * @param {string} symbol - Symbol to subscribe to
   * @param {Object} priceFeedService - Price feed service instance
   */
  startPriceSubscription(symbol, priceFeedService) {
    if (this.priceServiceUnsubscribers.has(symbol)) {
      return; // Already subscribed
    }

    logger.info('Starting price subscription', { symbol });

    const unsubscribe = priceFeedService.subscribeToRealTimePrices(
      [symbol],
      update => this.handlePriceUpdate(symbol, update)
    );

    this.priceServiceUnsubscribers.set(symbol, unsubscribe);
  }

  /**
   * Stop real-time price subscription
   * @param {string} symbol - Symbol to unsubscribe from
   */
  stopPriceSubscription(symbol) {
    const unsubscribe = this.priceServiceUnsubscribers.get(symbol);

    if (unsubscribe) {
      logger.info('Stopping price subscription', { symbol });
      unsubscribe();
      this.priceServiceUnsubscribers.delete(symbol);
    }
  }

  /**
   * Handle price update from PriceFeedAPIService
   * @param {string} symbol - Symbol that was updated
   * @param {Object} update - Price update data
   */
  handlePriceUpdate(symbol, update) {
    const subscribers = this.symbolSubscribers.get(symbol);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // Format the message based on update type
    let message;

    if (update.type === 'price_update') {
      message = {
        type: 'price_update',
        symbol,
        data: update.data,
        timestamp: update.timestamp || Date.now(),
      };
    } else if (update.type === 'connection') {
      message = {
        type: 'connection_status',
        symbol,
        status: update.status,
        timestamp: update.timestamp || Date.now(),
      };
    } else if (update.type === 'error') {
      message = {
        type: 'subscription_error',
        symbol,
        message: update.message,
        timestamp: update.timestamp || Date.now(),
      };
    } else {
      // Unknown update type
      return;
    }

    // Broadcast to all subscribed clients
    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Send initial prices after subscription
   * @param {string} clientId - Client identifier
   * @param {Array<string>} symbols - Symbols to get prices for
   * @param {Object} priceFeedService - Price feed service instance
   */
  async sendInitialPrices(clientId, symbols, priceFeedService) {
    for (const symbol of symbols) {
      try {
        const priceData = await priceFeedService.getCryptocurrencyPrice(
          symbol,
          'USD',
          true
        );

        this.sendToClient(clientId, {
          type: 'price_update',
          symbol,
          data: {
            symbol,
            price: priceData.price,
            change_24h: priceData.change_24h,
            volume_24h: priceData.volume_24h,
            market_cap: priceData.market_cap,
            source: priceData.source,
          },
          initial: true,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.warn('Failed to send initial price', {
          clientId,
          symbol,
          error: error.message,
        });
      }
    }
  }

  /**
   * Send current subscriptions to client
   * @param {string} clientId - Client identifier
   */
  sendCurrentSubscriptions(clientId) {
    const subscriptions = this.clientSubscriptions.get(clientId);

    this.sendToClient(clientId, {
      type: 'subscriptions',
      symbols: subscriptions ? Array.from(subscriptions) : [],
      timestamp: Date.now(),
    });
  }

  /**
   * Send a message to a specific client
   * @param {string} clientId - Client identifier
   * @param {Object} message - Message to send
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);

    if (client && client.ws.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send message to client', {
          clientId,
          error: error.message,
        });
      }
    }
  }

  /**
   * Send an error message to a client
   * @param {string} clientId - Client identifier
   * @param {string} errorMessage - Error message
   */
  sendError(clientId, errorMessage) {
    this.sendToClient(clientId, {
      type: 'error',
      message: errorMessage,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a message to all connected clients
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    for (const [clientId] of this.clients) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Check heartbeats and close stale connections
   */
  checkHeartbeats() {
    for (const [clientId, client] of this.clients) {
      if (!client.isAlive) {
        logger.info('Terminating stale price connection', { clientId });
        client.ws.terminate();
        this.handleDisconnection(clientId);
        continue;
      }

      client.isAlive = false;
      client.ws.ping();
    }
  }

  /**
   * Get metrics about the price handler
   */
  getMetrics() {
    const symbolCounts = {};
    for (const [symbol, subscribers] of this.symbolSubscribers) {
      symbolCounts[symbol] = subscribers.size;
    }

    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.symbolSubscribers.size,
      totalClientSubscriptions: Array.from(
        this.clientSubscriptions.values()
      ).reduce((sum, subs) => sum + subs.size, 0),
      symbolSubscriberCounts: symbolCounts,
    };
  }

  /**
   * Cleanup all connections and subscriptions
   */
  cleanup() {
    logger.info('Cleaning up PriceWebSocketHandler');

    // Stop heartbeat
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    // Stop all price subscriptions
    for (const [symbol, unsubscribe] of this.priceServiceUnsubscribers) {
      logger.debug('Stopping price subscription', { symbol });
      unsubscribe();
    }
    this.priceServiceUnsubscribers.clear();

    // Clear all tracking maps
    this.clientSubscriptions.clear();
    this.symbolSubscribers.clear();
    this.clients.clear();

    logger.info('PriceWebSocketHandler cleanup complete');
  }
}
