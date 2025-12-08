import express from 'express';
import { serviceContainer } from '../services/container.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Create service API routes for frontend access
 * Provides HTTP endpoints for all migrated backend services
 */
export function createServiceRoutes() {
  const router = express.Router();

  // Middleware for request logging
  router.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('API request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        query: req.query
      });
    });
    
    next();
  });

  // ============================================
  // Gas Price Endpoints
  // ============================================

  /**
   * GET /api/gas-prices/:network
   * Get gas prices for a specific blockchain network
   */
  router.get('/gas-prices/:network', async (req, res) => {
    try {
      const { network } = req.params;
      const { transactionType, includeUSDCosts } = req.query;

      // Validate network parameter
      const validNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];
      if (!validNetworks.includes(network)) {
        return sendValidationError(
          res,
          `Invalid network: ${network}. Valid networks: ${validNetworks.join(', ')}`,
          'INVALID_NETWORK'
        );
      }

      const gasPriceService = serviceContainer.get('GasPriceAPIService');
      const startTime = Date.now();
      
      const result = await gasPriceService.getGasPrices(network, {
        transactionType: transactionType || 'transfer',
        includeUSDCosts: includeUSDCosts !== 'false'
      });

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'gas-prices');
    }
  });

  /**
   * GET /api/gas-prices
   * Get gas prices for multiple networks
   */
  router.get('/gas-prices', async (req, res) => {
    try {
      const { networks } = req.query;
      const networkList = networks ? networks.split(',').map(n => n.trim()) : ['ethereum'];

      // Validate networks
      const validNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];
      const invalidNetworks = networkList.filter(n => !validNetworks.includes(n));
      
      if (invalidNetworks.length > 0) {
        return sendValidationError(
          res,
          `Invalid networks: ${invalidNetworks.join(', ')}. Valid networks: ${validNetworks.join(', ')}`,
          'INVALID_NETWORK'
        );
      }

      const gasPriceService = serviceContainer.get('GasPriceAPIService');
      const startTime = Date.now();
      
      const result = await gasPriceService.getMultiNetworkGasPrices(networkList);

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now(),
          networksRequested: networkList.length
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'gas-prices');
    }
  });

  // ============================================
  // Price Feed Endpoints
  // ============================================

  /**
   * GET /api/prices/:symbol
   * Get price for a specific cryptocurrency
   */
  router.get('/prices/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { currency, includeMarketData } = req.query;

      // Validate symbol
      const upperSymbol = symbol.toUpperCase();
      const validSymbols = ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'MATIC', 'LINK', 'UNI'];
      
      if (!validSymbols.includes(upperSymbol)) {
        return sendValidationError(
          res,
          `Invalid symbol: ${symbol}. Valid symbols: ${validSymbols.join(', ')}`,
          'INVALID_SYMBOL'
        );
      }

      const priceFeedService = serviceContainer.get('PriceFeedAPIService');
      const startTime = Date.now();
      
      const result = await priceFeedService.getCryptocurrencyPrice(
        upperSymbol,
        currency || 'USD',
        includeMarketData !== 'false'
      );

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'prices');
    }
  });

  /**
   * GET /api/prices
   * Get prices for multiple cryptocurrencies
   */
  router.get('/prices', async (req, res) => {
    try {
      const { symbols, currency } = req.query;
      const symbolList = symbols 
        ? symbols.split(',').map(s => s.trim().toUpperCase()) 
        : ['BTC', 'ETH'];

      // Validate symbols
      const validSymbols = ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'MATIC', 'LINK', 'UNI'];
      const invalidSymbols = symbolList.filter(s => !validSymbols.includes(s));
      
      if (invalidSymbols.length > 0) {
        return sendValidationError(
          res,
          `Invalid symbols: ${invalidSymbols.join(', ')}. Valid symbols: ${validSymbols.join(', ')}`,
          'INVALID_SYMBOL'
        );
      }

      const priceFeedService = serviceContainer.get('PriceFeedAPIService');
      const startTime = Date.now();
      
      const result = await priceFeedService.getMultiplePrices(symbolList, currency || 'USD');

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now(),
          symbolsRequested: symbolList.length
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'prices');
    }
  });

  // ============================================
  // Lending Rate Endpoints
  // ============================================

  /**
   * GET /api/lending-rates/:token
   * Get lending rates for a specific token
   */
  router.get('/lending-rates/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { protocols, includeUtilization } = req.query;

      // Validate token
      const upperToken = token.toUpperCase();
      const validTokens = ['ETH', 'DAI', 'USDC', 'USDT', 'WBTC', 'UNI', 'LINK', 'AAVE', 'COMP'];
      
      if (!validTokens.includes(upperToken)) {
        return sendValidationError(
          res,
          `Invalid token: ${token}. Valid tokens: ${validTokens.join(', ')}`,
          'INVALID_TOKEN'
        );
      }

      const protocolList = protocols 
        ? protocols.split(',').map(p => p.trim().toLowerCase()) 
        : ['aave', 'compound'];

      // Validate protocols
      const validProtocols = ['aave', 'compound'];
      const invalidProtocols = protocolList.filter(p => !validProtocols.includes(p));
      
      if (invalidProtocols.length > 0) {
        return sendValidationError(
          res,
          `Invalid protocols: ${invalidProtocols.join(', ')}. Valid protocols: ${validProtocols.join(', ')}`,
          'INVALID_PROTOCOL'
        );
      }

      const lendingService = serviceContainer.get('LendingAPIService');
      const startTime = Date.now();
      
      const result = await lendingService.getLendingRates(upperToken, protocolList, {
        includeUtilization: includeUtilization !== 'false'
      });

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'lending-rates');
    }
  });

  /**
   * GET /api/lending-rates
   * Get all lending rates across all protocols
   */
  router.get('/lending-rates', async (req, res) => {
    try {
      const lendingService = serviceContainer.get('LendingAPIService');
      const startTime = Date.now();
      
      const result = await lendingService.getAllProtocolRates();

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'lending-rates');
    }
  });

  // ============================================
  // Token Balance Endpoints
  // ============================================

  /**
   * GET /api/balances/:address
   * Get token balances for a wallet address
   */
  router.get('/balances/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const { network, tokenAddress, includeUSDValues } = req.query;

      // Validate address format
      if (!isValidEthereumAddress(address)) {
        return sendValidationError(
          res,
          'Invalid Ethereum address format. Address must be 42 characters starting with 0x',
          'INVALID_ADDRESS'
        );
      }

      // Validate network if provided
      const validNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];
      const networkToUse = network || 'ethereum';
      
      if (!validNetworks.includes(networkToUse)) {
        return sendValidationError(
          res,
          `Invalid network: ${network}. Valid networks: ${validNetworks.join(', ')}`,
          'INVALID_NETWORK'
        );
      }

      // Validate token address if provided
      if (tokenAddress && !isValidEthereumAddress(tokenAddress)) {
        return sendValidationError(
          res,
          'Invalid token address format. Address must be 42 characters starting with 0x',
          'INVALID_TOKEN_ADDRESS'
        );
      }

      const tokenBalanceService = serviceContainer.get('TokenBalanceAPIService');
      const startTime = Date.now();
      
      let result;
      if (tokenAddress) {
        result = await tokenBalanceService.getTokenBalance(address, tokenAddress, networkToUse);
      } else {
        result = await tokenBalanceService.getAllTokenBalances(address, networkToUse, {
          includeUSDValues: includeUSDValues !== 'false'
        });
      }

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'balances');
    }
  });

  /**
   * GET /api/portfolio/:address
   * Get portfolio value across multiple networks
   */
  router.get('/portfolio/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const { networks } = req.query;

      // Validate address format
      if (!isValidEthereumAddress(address)) {
        return sendValidationError(
          res,
          'Invalid Ethereum address format. Address must be 42 characters starting with 0x',
          'INVALID_ADDRESS'
        );
      }

      const networkList = networks 
        ? networks.split(',').map(n => n.trim().toLowerCase()) 
        : ['ethereum'];

      // Validate networks
      const validNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];
      const invalidNetworks = networkList.filter(n => !validNetworks.includes(n));
      
      if (invalidNetworks.length > 0) {
        return sendValidationError(
          res,
          `Invalid networks: ${invalidNetworks.join(', ')}. Valid networks: ${validNetworks.join(', ')}`,
          'INVALID_NETWORK'
        );
      }

      const tokenBalanceService = serviceContainer.get('TokenBalanceAPIService');
      const startTime = Date.now();
      
      const result = await tokenBalanceService.getPortfolioValue(address, networkList);

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        metadata: {
          executionTime,
          timestamp: Date.now(),
          networksQueried: networkList.length
        }
      });

    } catch (error) {
      handleServiceError(res, error, 'portfolio');
    }
  });

  // ============================================
  // Utility Endpoints
  // ============================================

  /**
   * GET /api/supported
   * Get all supported networks, tokens, and symbols
   */
  router.get('/supported', (req, res) => {
    res.json({
      success: true,
      data: {
        networks: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'],
        cryptocurrencies: ['BTC', 'ETH', 'USDC', 'USDT', 'SOL', 'MATIC', 'LINK', 'UNI'],
        lendingTokens: ['ETH', 'DAI', 'USDC', 'USDT', 'WBTC', 'UNI', 'LINK', 'AAVE', 'COMP'],
        protocols: ['aave', 'compound'],
        currencies: ['USD', 'EUR', 'GBP']
      },
      metadata: {
        timestamp: Date.now()
      }
    });
  });

  return router;
}

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid
 */
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Send validation error response with consistent structure
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {string} code - Error code
 */
function sendValidationError(res, message, code) {
  res.status(400).json({
    success: false,
    error: {
      type: 'validation',
      message,
      code
    },
    metadata: {
      timestamp: Date.now()
    }
  });
}

/**
 * Handle service errors and return appropriate HTTP responses
 * @param {Response} res - Express response object
 * @param {Error} error - Error to handle
 * @param {string} endpoint - Endpoint name for logging
 */
function handleServiceError(res, error, endpoint) {
  logger.error('Service API error', {
    endpoint,
    error: error.message,
    stack: error.stack
  });

  // Determine error type and status code
  let statusCode = 500;
  let errorType = 'internal';
  let errorCode = 'INTERNAL_ERROR';

  if (error instanceof ServiceError) {
    if (error.message.includes('not found')) {
      statusCode = 404;
      errorType = 'not_found';
      errorCode = 'NOT_FOUND';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorType = 'rate_limit';
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message.includes('Invalid') || error.message.includes('Unsupported')) {
      statusCode = 400;
      errorType = 'validation';
      errorCode = 'VALIDATION_ERROR';
    }
  } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    statusCode = 504;
    errorType = 'timeout';
    errorCode = 'GATEWAY_TIMEOUT';
  } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    errorType = 'service_unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      type: errorType,
      message: error.message,
      code: errorCode
    },
    metadata: {
      timestamp: Date.now()
    }
  });
}

