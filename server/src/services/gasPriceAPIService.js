import { BaseService } from './base.js';
import { APIClient } from './apiClient.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Backend service for fetching real-time gas prices from multiple blockchain networks
 * Migrated from frontend gasPriceService with enhanced caching and error handling
 */
export class GasPriceAPIService extends BaseService {
  constructor(config = {}) {
    super({
      cacheTimeout: 300000, // 5 minutes for gas prices
      rateLimitWindow: 60000, // 1 minute window
      rateLimitMax: 60, // 60 requests per minute per network
      retryAttempts: 3,
      retryDelay: 2000,
      ...config
    });

    // Initialize API client
    this.apiClient = new APIClient({
      timeout: 15000,
      retryAttempts: 2,
      userAgent: 'DeFi-Backend-GasPrice/1.0.0'
    });

    // Supported networks configuration
    this.networks = {
      ethereum: {
        name: 'Ethereum',
        chainId: 1,
        nativeCurrency: { symbol: 'ETH', decimals: 18 },
        apiEndpoints: {
          etherscan: 'https://api.etherscan.io/api',
          gasStation: 'https://ethgasstation.info/api/ethgasAPI.json'
        },
        rateLimit: { maxRequests: 5, windowMs: 1000 } // 5 requests per second
      },
      polygon: {
        name: 'Polygon',
        chainId: 137,
        nativeCurrency: { symbol: 'MATIC', decimals: 18 },
        apiEndpoints: {
          polygonscan: 'https://api.polygonscan.com/api',
          gasStation: 'https://gasstation-mainnet.matic.network/v2'
        },
        rateLimit: { maxRequests: 5, windowMs: 1000 }
      },
      bsc: {
        name: 'BSC',
        chainId: 56,
        nativeCurrency: { symbol: 'BNB', decimals: 18 },
        apiEndpoints: {
          bscscan: 'https://api.bscscan.com/api'
        },
        rateLimit: { maxRequests: 5, windowMs: 1000 }
      },
      arbitrum: {
        name: 'Arbitrum',
        chainId: 42161,
        nativeCurrency: { symbol: 'ETH', decimals: 18 },
        apiEndpoints: {
          arbiscan: 'https://api.arbiscan.io/api'
        },
        rateLimit: { maxRequests: 5, windowMs: 1000 }
      },
      optimism: {
        name: 'Optimism',
        chainId: 10,
        nativeCurrency: { symbol: 'ETH', decimals: 18 },
        apiEndpoints: {
          optimistic: 'https://api-optimistic.etherscan.io/api'
        },
        rateLimit: { maxRequests: 5, windowMs: 1000 }
      }
    };

    // Fallback gas prices for error cases
    this.fallbackGasPrices = {
      ethereum: { 
        slow: { gwei: 15, usd_cost: 0.50 }, 
        standard: { gwei: 18, usd_cost: 0.60 }, 
        fast: { gwei: 22, usd_cost: 0.73 } 
      },
      polygon: { 
        slow: { gwei: 2, usd_cost: 0.01 }, 
        standard: { gwei: 3, usd_cost: 0.015 }, 
        fast: { gwei: 4, usd_cost: 0.02 } 
      },
      bsc: { 
        slow: { gwei: 5, usd_cost: 0.02 }, 
        standard: { gwei: 6, usd_cost: 0.024 }, 
        fast: { gwei: 8, usd_cost: 0.032 } 
      },
      arbitrum: { 
        slow: { gwei: 0.5, usd_cost: 0.005 }, 
        standard: { gwei: 0.6, usd_cost: 0.006 }, 
        fast: { gwei: 0.8, usd_cost: 0.008 } 
      },
      optimism: { 
        slow: { gwei: 0.1, usd_cost: 0.001 }, 
        standard: { gwei: 0.15, usd_cost: 0.0015 }, 
        fast: { gwei: 0.2, usd_cost: 0.002 } 
      }
    };

    // Validate required configuration
    this.validateConfig(['apiKeys.etherscan']);

    // Set up API credentials
    this.setupAPICredentials();

    logger.info('GasPriceAPIService initialized', { 
      supportedNetworks: Object.keys(this.networks),
      cacheTimeout: this.config.cacheTimeout 
    });
  }

  /**
   * Set up API credentials for external services
   */
  setupAPICredentials() {
    const apiKeys = this.config.apiKeys || {};

    if (apiKeys.etherscan) {
      this.apiClient.setCredentials('etherscan', { apiKey: apiKeys.etherscan });
    }
    if (apiKeys.polygonscan) {
      this.apiClient.setCredentials('polygonscan', { apiKey: apiKeys.polygonscan });
    }
    if (apiKeys.bscscan) {
      this.apiClient.setCredentials('bscscan', { apiKey: apiKeys.bscscan });
    }
    if (apiKeys.arbiscan) {
      this.apiClient.setCredentials('arbiscan', { apiKey: apiKeys.arbiscan });
    }
    if (apiKeys.optimistic) {
      this.apiClient.setCredentials('optimistic', { apiKey: apiKeys.optimistic });
    }
  }

  /**
   * Get current gas prices for specified network
   * @param {string} network - Network name (ethereum, polygon, bsc, arbitrum, optimism)
   * @param {Object} options - Additional options
   * @returns {Object} Gas price data with slow, standard, fast estimates
   */
  async getGasPrices(network = 'ethereum', options = {}) {
    if (!this.networks[network]) {
      throw new ServiceError(`Unsupported network: ${network}`);
    }

    const cacheKey = `gas_prices_${network}`;

    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Check rate limiting
    if (!this.checkRateLimit(`gas_${network}`)) {
      logger.warn('Rate limit exceeded for gas price request', { network });
      return this.getFallbackGasPrices(network);
    }

    try {
      const gasData = await this.executeWithRetry(async () => {
        return await this.fetchGasPricesFromAPI(network, options);
      });

      // Cache the result
      this.setCachedData(cacheKey, gasData);

      logger.info('Gas prices fetched successfully', { 
        network, 
        prices: gasData.gasPrices 
      });

      return gasData;

    } catch (error) {
      logger.error('Failed to fetch gas prices', { 
        network, 
        error: error.message 
      });

      // Return fallback data on error
      const fallbackData = this.getFallbackGasPrices(network);
      this.setCachedData(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Fetch gas prices for multiple networks concurrently
   * @param {Array<string>} networks - Array of network names
   * @returns {Object} Gas prices for each network
   */
  async getMultiNetworkGasPrices(networks = ['ethereum', 'polygon']) {
    const validNetworks = networks.filter(network => this.networks[network]);
    
    if (validNetworks.length === 0) {
      throw new ServiceError('No valid networks specified');
    }

    const gasPricePromises = validNetworks.map(async (network) => {
      try {
        const gasData = await this.getGasPrices(network);
        return { network, data: gasData, success: true };
      } catch (error) {
        logger.warn('Failed to fetch gas prices for network', { 
          network, 
          error: error.message 
        });
        return { 
          network, 
          data: this.getFallbackGasPrices(network), 
          success: false 
        };
      }
    });

    const results = await Promise.allSettled(gasPricePromises);
    const gasPrices = {};

    results.forEach((result, index) => {
      const network = validNetworks[index];
      if (result.status === 'fulfilled') {
        gasPrices[network] = result.value.data;
      } else {
        gasPrices[network] = this.getFallbackGasPrices(network);
      }
    });

    return {
      networks: gasPrices,
      timestamp: Date.now(),
      source: 'backend_api'
    };
  }

  /**
   * Calculate transaction cost estimates
   * @param {string} network - Network name
   * @param {string} transactionType - Type of transaction
   * @param {number} gasLimit - Gas limit for transaction
   * @returns {Object} Cost estimates in native currency and USD
   */
  async getTransactionCostEstimate(network, transactionType = 'transfer', gasLimit = 21000) {
    const gasData = await this.getGasPrices(network);
    const networkInfo = this.networks[network];

    if (!gasData || !networkInfo) {
      throw new ServiceError(`Cannot calculate costs for network: ${network}`);
    }

    const costs = {};
    const gasPrices = gasData.gasPrices;

    // Calculate costs for each speed tier
    ['slow', 'standard', 'fast'].forEach(speed => {
      if (gasPrices[speed]) {
        const gasCostWei = gasPrices[speed].gwei * gasLimit * 1e9; // Convert gwei to wei
        const gasCostEth = gasCostWei / 1e18; // Convert wei to ETH/native currency
        
        costs[speed] = {
          gasPrice: gasPrices[speed].gwei,
          gasCost: gasCostEth,
          gasCostUSD: gasPrices[speed].usd_cost || gasCostEth * 2000, // Fallback ETH price
          currency: networkInfo.nativeCurrency.symbol
        };
      }
    });

    return {
      network,
      transactionType,
      gasLimit,
      costs,
      timestamp: Date.now()
    };
  }

  /**
   * Fetch gas prices from external APIs
   * @param {string} network - Network name
   * @param {Object} options - Fetch options
   * @returns {Object} Formatted gas price data
   */
  async fetchGasPricesFromAPI(network, options = {}) {
    const networkConfig = this.networks[network];
    
    switch (network) {
    case 'ethereum':
      return await this.fetchEthereumGasPrices(networkConfig, options);
    case 'polygon':
      return await this.fetchPolygonGasPrices(networkConfig, options);
    case 'bsc':
      return await this.fetchBSCGasPrices(networkConfig, options);
    case 'arbitrum':
      return await this.fetchArbitrumGasPrices(networkConfig, options);
    case 'optimism':
      return await this.fetchOptimismGasPrices(networkConfig, options);
    default:
      throw new ServiceError(`No API implementation for network: ${network}`);
    }
  }

  /**
   * Fetch Ethereum gas prices from Etherscan API
   */
  async fetchEthereumGasPrices(networkConfig, _options) {
    const credentials = this.apiClient.getCredentials('etherscan');
    const url = `${networkConfig.apiEndpoints.etherscan}?module=gastracker&action=gasoracle&apikey=${credentials.apiKey}`;

    const response = await this.apiClient.get(url, {
      rateLimitKey: 'etherscan',
      rateLimit: networkConfig.rateLimit
    });

    if (response.status !== '1') {
      throw new ServiceError(`Etherscan API error: ${response.message}`);
    }

    const result = response.result;
    return {
      network: 'ethereum',
      gasPrices: {
        slow: { gwei: parseFloat(result.SafeGasPrice), usd_cost: this.calculateUSDCost(result.SafeGasPrice, 'ethereum') },
        standard: { gwei: parseFloat(result.ProposeGasPrice), usd_cost: this.calculateUSDCost(result.ProposeGasPrice, 'ethereum') },
        fast: { gwei: parseFloat(result.FastGasPrice), usd_cost: this.calculateUSDCost(result.FastGasPrice, 'ethereum') }
      },
      timestamp: Date.now(),
      source: 'etherscan'
    };
  }

  /**
   * Fetch Polygon gas prices from Polygonscan API
   */
  async fetchPolygonGasPrices(networkConfig, _options) {
    try {
      // Try Polygon Gas Station first
      const gasStationUrl = networkConfig.apiEndpoints.gasStation;
      const response = await this.apiClient.get(gasStationUrl, {
        rateLimitKey: 'polygon_gas_station',
        rateLimit: networkConfig.rateLimit
      });

      return {
        network: 'polygon',
        gasPrices: {
          slow: { gwei: response.safeLow?.maxFee || 2, usd_cost: this.calculateUSDCost(response.safeLow?.maxFee || 2, 'polygon') },
          standard: { gwei: response.standard?.maxFee || 3, usd_cost: this.calculateUSDCost(response.standard?.maxFee || 3, 'polygon') },
          fast: { gwei: response.fast?.maxFee || 4, usd_cost: this.calculateUSDCost(response.fast?.maxFee || 4, 'polygon') }
        },
        timestamp: Date.now(),
        source: 'polygon_gas_station'
      };
    } catch (error) {
      // Fallback to Polygonscan if available
      if (this.apiClient.hasCredentials('polygonscan')) {
        return await this.fetchPolygonscanGasPrices(networkConfig);
      }
      throw error;
    }
  }

  /**
   * Fetch BSC gas prices from BSCScan API
   */
  async fetchBSCGasPrices(networkConfig, _options) {
    if (!this.apiClient.hasCredentials('bscscan')) {
      // Use estimated values for BSC
      return {
        network: 'bsc',
        gasPrices: {
          slow: { gwei: 5, usd_cost: this.calculateUSDCost(5, 'bsc') },
          standard: { gwei: 6, usd_cost: this.calculateUSDCost(6, 'bsc') },
          fast: { gwei: 8, usd_cost: this.calculateUSDCost(8, 'bsc') }
        },
        timestamp: Date.now(),
        source: 'estimated'
      };
    }

    const credentials = this.apiClient.getCredentials('bscscan');
    const url = `${networkConfig.apiEndpoints.bscscan}?module=gastracker&action=gasoracle&apikey=${credentials.apiKey}`;

    const response = await this.apiClient.get(url, {
      rateLimitKey: 'bscscan',
      rateLimit: networkConfig.rateLimit
    });

    if (response.status !== '1') {
      throw new ServiceError(`BSCScan API error: ${response.message}`);
    }

    const result = response.result;
    return {
      network: 'bsc',
      gasPrices: {
        slow: { gwei: parseFloat(result.SafeGasPrice), usd_cost: this.calculateUSDCost(result.SafeGasPrice, 'bsc') },
        standard: { gwei: parseFloat(result.ProposeGasPrice), usd_cost: this.calculateUSDCost(result.ProposeGasPrice, 'bsc') },
        fast: { gwei: parseFloat(result.FastGasPrice), usd_cost: this.calculateUSDCost(result.FastGasPrice, 'bsc') }
      },
      timestamp: Date.now(),
      source: 'bscscan'
    };
  }

  /**
   * Fetch Arbitrum gas prices
   */
  async fetchArbitrumGasPrices(_networkConfig, _options) {
    // Arbitrum has very low and stable gas prices
    return {
      network: 'arbitrum',
      gasPrices: {
        slow: { gwei: 0.5, usd_cost: this.calculateUSDCost(0.5, 'arbitrum') },
        standard: { gwei: 0.6, usd_cost: this.calculateUSDCost(0.6, 'arbitrum') },
        fast: { gwei: 0.8, usd_cost: this.calculateUSDCost(0.8, 'arbitrum') }
      },
      timestamp: Date.now(),
      source: 'estimated'
    };
  }

  /**
   * Fetch Optimism gas prices
   */
  async fetchOptimismGasPrices(_networkConfig, _options) {
    // Optimism has very low and stable gas prices
    return {
      network: 'optimism',
      gasPrices: {
        slow: { gwei: 0.1, usd_cost: this.calculateUSDCost(0.1, 'optimism') },
        standard: { gwei: 0.15, usd_cost: this.calculateUSDCost(0.15, 'optimism') },
        fast: { gwei: 0.2, usd_cost: this.calculateUSDCost(0.2, 'optimism') }
      },
      timestamp: Date.now(),
      source: 'estimated'
    };
  }

  /**
   * Calculate USD cost for gas price (simplified calculation)
   * @param {number} gasPriceGwei - Gas price in gwei
   * @param {string} network - Network name
   * @returns {number} Estimated USD cost for standard transaction
   */
  calculateUSDCost(gasPriceGwei, network) {
    const gasLimit = 21000; // Standard transfer
    const gasCostWei = gasPriceGwei * gasLimit * 1e9;
    const gasCostEth = gasCostWei / 1e18;

    // Simplified price estimates (in production, fetch from price API)
    const prices = {
      ethereum: 2000, // ETH price
      polygon: 0.8,   // MATIC price
      bsc: 300,       // BNB price
      arbitrum: 2000, // ETH price
      optimism: 2000  // ETH price
    };

    return gasCostEth * (prices[network] || 1);
  }

  /**
   * Get fallback gas prices for network
   * @param {string} network - Network name
   * @returns {Object} Fallback gas price data
   */
  getFallbackGasPrices(network) {
    const fallbackPrices = this.fallbackGasPrices[network];
    if (!fallbackPrices) {
      throw new ServiceError(`No fallback data available for network: ${network}`);
    }

    return {
      network,
      gasPrices: fallbackPrices,
      timestamp: Date.now(),
      source: 'fallback'
    };
  }

  /**
   * Get supported networks
   * @returns {Object} Supported networks configuration
   */
  getSupportedNetworks() {
    return { ...this.networks };
  }

  /**
   * Clear cache for specific network or all networks
   * @param {string} network - Network name (optional)
   */
  clearCache(network = null) {
    if (network) {
      super.clearCache(`gas_prices_${network}`);
    } else {
      // Clear all gas price cache entries
      Object.keys(this.networks).forEach(net => {
        super.clearCache(`gas_prices_${net}`);
      });
    }
  }
}