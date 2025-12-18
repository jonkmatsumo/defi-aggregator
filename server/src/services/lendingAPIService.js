import { BaseService } from './base.js';
import { APIClient } from './apiClient.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Backend service for fetching DeFi lending rates and protocol data
 * Migrated from frontend lendingService with enhanced caching and error handling
 */
export class LendingAPIService extends BaseService {
  constructor(config = {}) {
    super({
      cacheTimeout: 300000, // 5 minutes for lending rates
      rateLimitWindow: 60000, // 1 minute window
      rateLimitMax: 30, // 30 requests per minute per protocol
      retryAttempts: 3,
      retryDelay: 2000,
      ...config,
    });

    // Initialize API client
    this.apiClient = new APIClient({
      timeout: 20000,
      retryAttempts: 2,
      userAgent: 'DeFi-Backend-Lending/1.0.0',
    });

    // Supported protocols configuration
    this.protocols = {
      aave: {
        name: 'Aave',
        version: 'v2',
        apiEndpoints: {
          reserves: 'https://aave-api-v2.aave.com/data/reserves',
          markets: 'https://aave-api-v2.aave.com/data/markets',
        },
        rateLimit: { maxRequests: 10, windowMs: 1000 }, // 10 requests per second
      },
      compound: {
        name: 'Compound',
        version: 'v2',
        apiEndpoints: {
          ctoken: 'https://api.compound.finance/api/v2/ctoken',
          markets: 'https://api.compound.finance/api/v2/market',
        },
        rateLimit: { maxRequests: 10, windowMs: 1000 },
      },
    };

    // Supported tokens for lending
    this.supportedTokens = [
      { symbol: 'ETH', name: 'Ethereum', decimals: 18, logo: '🔷' },
      { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logo: '🟡' },
      { symbol: 'USDC', name: 'USD Coin', decimals: 6, logo: '💙' },
      { symbol: 'USDT', name: 'Tether USD', decimals: 6, logo: '💚' },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, logo: '🟠' },
      { symbol: 'UNI', name: 'Uniswap', decimals: 18, logo: '🟣' },
      { symbol: 'LINK', name: 'Chainlink', decimals: 18, logo: '🔵' },
      { symbol: 'AAVE', name: 'Aave', decimals: 18, logo: '🔴' },
      { symbol: 'COMP', name: 'Compound', decimals: 18, logo: '🟢' },
    ];

    // Fallback lending rates for error cases
    this.fallbackRates = {
      aave: {
        ETH: {
          supplyAPY: 0.028,
          borrowAPY: 0.048,
          totalSupply: 1200000,
          totalBorrow: 600000,
          utilizationRate: 0.5,
        },
        USDC: {
          supplyAPY: 0.032,
          borrowAPY: 0.052,
          totalSupply: 4000000,
          totalBorrow: 2000000,
          utilizationRate: 0.5,
        },
        DAI: {
          supplyAPY: 0.038,
          borrowAPY: 0.058,
          totalSupply: 6000000,
          totalBorrow: 3000000,
          utilizationRate: 0.5,
        },
      },
      compound: {
        ETH: {
          supplyAPY: 0.025,
          borrowAPY: 0.045,
          totalSupply: 1000000,
          totalBorrow: 500000,
          exchangeRate: 1.02,
        },
        DAI: {
          supplyAPY: 0.035,
          borrowAPY: 0.055,
          totalSupply: 5000000,
          totalBorrow: 2000000,
          exchangeRate: 1.01,
        },
        USDC: {
          supplyAPY: 0.03,
          borrowAPY: 0.05,
          totalSupply: 3000000,
          totalBorrow: 1500000,
          exchangeRate: 1.005,
        },
      },
    };

    logger.info('LendingAPIService initialized', {
      supportedProtocols: Object.keys(this.protocols),
      supportedTokens: this.supportedTokens.length,
      cacheTimeout: this.config.cacheTimeout,
    });
  }

  /**
   * Get lending rates for specific token across protocols
   * @param {string} token - Token symbol (e.g., 'ETH', 'USDC')
   * @param {Array<string>} protocols - Array of protocol names
   * @param {Object} options - Additional options
   * @returns {Object} Lending rates data
   */
  async getLendingRates(
    token,
    protocols = ['aave', 'compound'],
    _options = {}
  ) {
    if (!token) {
      throw new ServiceError('Token symbol is required');
    }

    const validProtocols = protocols.filter(
      protocol => this.protocols[protocol]
    );
    if (validProtocols.length === 0) {
      throw new ServiceError('No valid protocols specified');
    }

    const cacheKey = `lending_rates_${token}_${validProtocols.join('_')}`;

    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const ratePromises = validProtocols.map(async protocol => {
        // Check rate limiting
        if (!this.checkRateLimit(`lending_${protocol}`)) {
          logger.warn('Rate limit exceeded for lending request', {
            protocol,
            token,
          });
          return {
            protocol,
            data: this.getFallbackTokenData(protocol, token),
            success: false,
          };
        }

        try {
          const protocolData = await this.executeWithRetry(async () => {
            return await this.getProtocolTokenData(protocol, token);
          });
          return { protocol, data: protocolData, success: true };
        } catch (error) {
          logger.warn('Failed to fetch rates for protocol', {
            protocol,
            token,
            error: error.message,
          });
          return {
            protocol,
            data: this.getFallbackTokenData(protocol, token),
            success: false,
          };
        }
      });

      const results = await Promise.allSettled(ratePromises);
      const protocolRates = [];
      let hasAnySuccess = false;

      results.forEach((result, index) => {
        const protocol = validProtocols[index];
        if (result.status === 'fulfilled') {
          protocolRates.push(result.value.data);
          if (result.value.success) {
            hasAnySuccess = true;
          }
        } else {
          protocolRates.push(this.getFallbackTokenData(protocol, token));
        }
      });

      const lendingData = {
        token,
        protocols: protocolRates,
        timestamp: Date.now(),
        source: hasAnySuccess ? 'backend_api' : 'fallback',
      };

      // Cache the result
      this.setCachedData(cacheKey, lendingData);

      logger.info('Lending rates fetched successfully', {
        token,
        protocols: validProtocols,
        ratesCount: protocolRates.length,
      });

      return lendingData;
    } catch (error) {
      logger.error('Failed to fetch lending rates', {
        token,
        protocols: validProtocols,
        error: error.message,
      });

      // Return fallback data on error
      const fallbackData = this.getFallbackLendingRates(token, validProtocols);
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Get comprehensive protocol data for multiple tokens
   * @param {string} protocol - Protocol name
   * @param {Array<string>} tokens - Array of token symbols
   * @returns {Object} Protocol data for all tokens
   */
  async getProtocolData(protocol, tokens = []) {
    if (!this.protocols[protocol]) {
      throw new ServiceError(`Unsupported protocol: ${protocol}`);
    }

    const cacheKey = `protocol_data_${protocol}_${tokens.join('_')}`;

    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Check rate limiting
    if (!this.checkRateLimit(`lending_${protocol}`)) {
      logger.warn('Rate limit exceeded for lending request', { protocol });
      return this.getFallbackProtocolData(protocol, tokens);
    }

    try {
      const protocolData = await this.executeWithRetry(async () => {
        return await this.fetchProtocolDataFromAPI(protocol, tokens);
      });

      // Cache the result
      this.setCachedData(cacheKey, protocolData);

      logger.info('Protocol data fetched successfully', {
        protocol,
        tokensCount: protocolData.tokens.length,
      });

      return protocolData;
    } catch (error) {
      logger.error('Failed to fetch protocol data', {
        protocol,
        tokens,
        error: error.message,
      });

      // Return fallback data on error
      const fallbackData = this.getFallbackProtocolData(protocol, tokens);
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Get rates for all supported tokens across all protocols
   * @returns {Object} All protocol rates
   */
  async getAllProtocolRates() {
    const cacheKey = 'all_protocol_rates';

    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const protocolPromises = Object.keys(this.protocols).map(
        async protocol => {
          try {
            const tokenSymbols = this.supportedTokens.map(t => t.symbol);
            const protocolData = await this.getProtocolData(
              protocol,
              tokenSymbols
            );
            return { protocol, data: protocolData, success: true };
          } catch (error) {
            logger.warn('Failed to fetch all rates for protocol', {
              protocol,
              error: error.message,
            });
            return {
              protocol,
              data: this.getFallbackProtocolData(
                protocol,
                this.supportedTokens.map(t => t.symbol)
              ),
              success: false,
            };
          }
        }
      );

      const results = await Promise.allSettled(protocolPromises);
      const allRates = { protocols: {} };

      results.forEach((result, index) => {
        const protocol = Object.keys(this.protocols)[index];
        if (result.status === 'fulfilled') {
          allRates.protocols[protocol] = result.value.data;
        } else {
          allRates.protocols[protocol] = this.getFallbackProtocolData(
            protocol,
            this.supportedTokens.map(t => t.symbol)
          );
        }
      });

      allRates.timestamp = Date.now();
      allRates.source = 'backend_api';

      // Cache the result
      this.setCachedData(cacheKey, allRates);

      return allRates;
    } catch (error) {
      logger.error('Failed to fetch all protocol rates', {
        error: error.message,
      });

      // Return fallback data
      const fallbackData = this.getFallbackAllProtocolRates();
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Fetch protocol data from external APIs
   * @param {string} protocol - Protocol name
   * @param {Array<string>} tokens - Token symbols
   * @returns {Object} Formatted protocol data
   */
  async fetchProtocolDataFromAPI(protocol, tokens = []) {
    switch (protocol) {
      case 'aave':
        return await this.fetchAaveData(tokens);
      case 'compound':
        return await this.fetchCompoundData(tokens);
      default:
        throw new ServiceError(
          `No API implementation for protocol: ${protocol}`
        );
    }
  }

  /**
   * Fetch Aave protocol data
   * @param {Array<string>} tokens - Token symbols to fetch
   * @returns {Object} Formatted Aave data
   */
  async fetchAaveData(tokens = []) {
    const protocolConfig = this.protocols.aave;
    const url = protocolConfig.apiEndpoints.reserves;

    const response = await this.apiClient.get(url, {
      rateLimitKey: 'aave',
      rateLimit: protocolConfig.rateLimit,
    });

    if (!Array.isArray(response)) {
      throw new ServiceError('Invalid Aave API response format');
    }

    const reserves = response;
    const filteredReserves =
      tokens.length > 0
        ? reserves.filter(reserve => tokens.includes(reserve.symbol))
        : reserves;

    const formattedTokens = filteredReserves.map(reserve => ({
      symbol: reserve.symbol,
      name: reserve.name,
      address: reserve.reserveAddress,
      decimals: reserve.decimals,
      platform: 'Aave',
      logo: this.getTokenLogo(reserve.symbol),
      supplyAPY: parseFloat(reserve.liquidityRate || 0) / 1e25, // Convert from ray to decimal
      borrowAPY: parseFloat(reserve.variableBorrowRate || 0) / 1e25,
      totalSupply: parseFloat(reserve.totalLiquidity || 0),
      totalBorrow: parseFloat(reserve.totalVariableDebt || 0),
      utilizationRate: parseFloat(reserve.utilizationRate || 0) / 1e25,
      availableLiquidity: parseFloat(reserve.availableLiquidity || 0),
    }));

    return {
      protocol: 'aave',
      tokens: formattedTokens,
      timestamp: Date.now(),
      source: 'aave_api',
    };
  }

  /**
   * Fetch Compound protocol data
   * @param {Array<string>} tokens - Token symbols to fetch
   * @returns {Object} Formatted Compound data
   */
  async fetchCompoundData(tokens = []) {
    const protocolConfig = this.protocols.compound;
    const url = protocolConfig.apiEndpoints.ctoken;

    const response = await this.apiClient.get(url, {
      rateLimitKey: 'compound',
      rateLimit: protocolConfig.rateLimit,
    });

    if (!response.cToken || !Array.isArray(response.cToken)) {
      throw new ServiceError('Invalid Compound API response format');
    }

    const cTokens = response.cToken;
    const filteredTokens =
      tokens.length > 0
        ? cTokens.filter(token => tokens.includes(token.symbol))
        : cTokens;

    const formattedTokens = filteredTokens.map(token => ({
      symbol: token.symbol,
      name: token.name,
      address: token.token_address,
      cTokenAddress: token.cToken_address,
      decimals: token.decimals,
      platform: 'Compound',
      logo: this.getTokenLogo(token.symbol),
      supplyAPY: parseFloat(token.supply_rate?.value || 0),
      borrowAPY: parseFloat(token.borrow_rate?.value || 0),
      totalSupply: parseFloat(token.total_supply?.value || 0),
      totalBorrow: parseFloat(token.total_borrow?.value || 0),
      exchangeRate: parseFloat(token.exchange_rate?.value || 0),
    }));

    return {
      protocol: 'compound',
      tokens: formattedTokens,
      timestamp: Date.now(),
      source: 'compound_api',
    };
  }

  /**
   * Get protocol-specific token data
   * @param {string} protocol - Protocol name
   * @param {string} token - Token symbol
   * @returns {Object} Token data for protocol
   */
  async getProtocolTokenData(protocol, token) {
    const protocolData = await this.fetchProtocolDataFromAPI(protocol, [token]);
    const tokenData = protocolData.tokens.find(t => t.symbol === token);

    if (!tokenData) {
      throw new ServiceError(
        `Token ${token} not found in ${protocol} protocol`
      );
    }

    return {
      protocol,
      ...tokenData,
      timestamp: Date.now(),
    };
  }

  /**
   * Get token logo emoji
   * @param {string} symbol - Token symbol
   * @returns {string} Logo emoji
   */
  getTokenLogo(symbol) {
    const tokenInfo = this.supportedTokens.find(t => t.symbol === symbol);
    return tokenInfo ? tokenInfo.logo : '💰';
  }

  /**
   * Get fallback token data for protocol
   * @param {string} protocol - Protocol name
   * @param {string} token - Token symbol
   * @returns {Object} Fallback token data
   */
  getFallbackTokenData(protocol, token) {
    const fallbackData = this.fallbackRates[protocol]?.[token];
    if (!fallbackData) {
      // Return generic fallback data
      return {
        protocol,
        symbol: token,
        name: token,
        platform: protocol.charAt(0).toUpperCase() + protocol.slice(1),
        logo: this.getTokenLogo(token),
        supplyAPY: 0.02,
        borrowAPY: 0.04,
        totalSupply: 1000000,
        totalBorrow: 500000,
        timestamp: Date.now(),
        source: 'fallback',
      };
    }

    return {
      protocol,
      symbol: token,
      name: token,
      platform: protocol.charAt(0).toUpperCase() + protocol.slice(1),
      logo: this.getTokenLogo(token),
      ...fallbackData,
      timestamp: Date.now(),
      source: 'fallback',
    };
  }

  /**
   * Get fallback lending rates for token
   * @param {string} token - Token symbol
   * @param {Array<string>} protocols - Protocol names
   * @returns {Object} Fallback lending rates
   */
  getFallbackLendingRates(token, protocols) {
    const protocolRates = protocols.map(protocol =>
      this.getFallbackTokenData(protocol, token)
    );

    return {
      token,
      protocols: protocolRates,
      timestamp: Date.now(),
      source: 'fallback',
    };
  }

  /**
   * Get fallback protocol data
   * @param {string} protocol - Protocol name
   * @param {Array<string>} tokens - Token symbols
   * @returns {Object} Fallback protocol data
   */
  getFallbackProtocolData(protocol, tokens) {
    const tokenData = tokens.map(token =>
      this.getFallbackTokenData(protocol, token)
    );

    return {
      protocol,
      tokens: tokenData,
      timestamp: Date.now(),
      source: 'fallback',
    };
  }

  /**
   * Get fallback data for all protocols
   * @returns {Object} Fallback all protocol rates
   */
  getFallbackAllProtocolRates() {
    const protocols = {};
    const tokenSymbols = this.supportedTokens.map(t => t.symbol);

    Object.keys(this.protocols).forEach(protocol => {
      protocols[protocol] = this.getFallbackProtocolData(
        protocol,
        tokenSymbols
      );
    });

    return {
      protocols,
      timestamp: Date.now(),
      source: 'fallback',
    };
  }

  /**
   * Get supported protocols
   * @returns {Object} Supported protocols configuration
   */
  getSupportedProtocols() {
    return { ...this.protocols };
  }

  /**
   * Get supported tokens
   * @returns {Array} Supported tokens list
   */
  getSupportedTokens() {
    return [...this.supportedTokens];
  }

  /**
   * Get cached data with corruption detection
   * @param {string} key - Cache key
   * @returns {*} Cached data or null
   */
  getCachedData(key) {
    const data = super.getCachedData(key);

    // Check for cache corruption
    if (data !== null && data !== undefined) {
      // Validate data structure based on cache key type
      if (key.includes('lending_rates_')) {
        if (!data.token || !data.protocols || !Array.isArray(data.protocols)) {
          logger.warn('Cache corruption detected, clearing corrupted entry', {
            key,
          });
          super.clearCache(key);
          return null;
        }
      } else if (key.includes('protocol_data_')) {
        if (!data.protocol || !data.tokens || !Array.isArray(data.tokens)) {
          logger.warn('Cache corruption detected, clearing corrupted entry', {
            key,
          });
          super.clearCache(key);
          return null;
        }
      }
    }

    return data;
  }

  /**
   * Clear cache for specific protocol/token or all cache
   * @param {string} protocol - Protocol name (optional)
   * @param {string} token - Token symbol (optional)
   */
  clearCache(protocol = null, token = null) {
    if (protocol && token) {
      super.clearCache(`lending_rates_${token}_${protocol}`);
    } else if (protocol) {
      // Clear all cache entries for protocol
      const keys = Array.from(this.cache.keys()).filter(key =>
        key.includes(protocol)
      );
      keys.forEach(key => super.clearCache(key));
    } else {
      // Clear all lending cache entries
      super.clearCache();
    }
  }
}
