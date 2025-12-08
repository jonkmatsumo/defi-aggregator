import { BaseService } from './base.js';
import { APIClient } from './apiClient.js';
import { ServiceConfig } from './config.js';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';
import Joi from 'joi';

/**
 * Token Balance API Service for blockchain RPC integration
 * Provides token balance queries across multiple networks
 */
export class TokenBalanceAPIService extends BaseService {
  constructor(config = {}) {
    super(config);

    // Initialize configuration
    this.serviceConfig = new ServiceConfig({
      networks: {
        ethereum: {
          rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2',
          chainId: 1,
          nativeSymbol: 'ETH',
          nativeName: 'Ether',
          nativeDecimals: 18
        },
        polygon: {
          rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2',
          chainId: 137,
          nativeSymbol: 'MATIC',
          nativeName: 'MATIC',
          nativeDecimals: 18
        },
        bsc: {
          rpcUrl: 'https://bsc-dataseed.binance.org',
          chainId: 56,
          nativeSymbol: 'BNB',
          nativeName: 'BNB',
          nativeDecimals: 18
        },
        arbitrum: {
          rpcUrl: 'https://arb1.arbitrum.io/rpc',
          chainId: 42161,
          nativeSymbol: 'ETH',
          nativeName: 'Ether',
          nativeDecimals: 18
        },
        optimism: {
          rpcUrl: 'https://mainnet.optimism.io',
          chainId: 10,
          nativeSymbol: 'ETH',
          nativeName: 'Ether',
          nativeDecimals: 18
        }
      },
      commonTokens: {
        ethereum: {
          '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
            symbol: 'WETH',
            name: 'Wrapped Ether',
            decimals: 18
          },
          '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6
          },
          '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': {
            symbol: 'WBTC',
            name: 'Wrapped Bitcoin',
            decimals: 8
          }
        },
        polygon: {
          '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': {
            symbol: 'WMATIC',
            name: 'Wrapped MATIC',
            decimals: 18
          },
          '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6
          }
        },
        bsc: {
          '0xbb4CdB9CBd36B01bD1cBaEF2aF378a0C60Cb8C8C': {
            symbol: 'WBNB',
            name: 'Wrapped BNB',
            decimals: 18
          },
          '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 18
          }
        }
      },
      cache: {
        enabled: true,
        ttl: 30000 // 30 seconds for balance data
      },
      rateLimit: {
        maxRequests: 50,
        windowMs: 60000 // 1 minute
      },
      timeout: 15000,
      retryAttempts: 2,
      retryDelay: 1000
    });

    // Set validation schema
    this.serviceConfig.setValidationSchema(this.createValidationSchema());
    this.serviceConfig.setEnvironmentPrefix('TOKEN_BALANCE_');

    // Load configuration
    this.config = this.serviceConfig.load(config);

    // Initialize API client
    this.apiClient = new APIClient({
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts,
      retryDelay: this.config.retryDelay,
      userAgent: 'TokenBalance-Service/1.0.0'
    });

    // ERC-20 ABI for token operations
    this.erc20Abi = [
      {
        'constant': true,
        'inputs': [{'name': '_owner', 'type': 'address'}],
        'name': 'balanceOf',
        'outputs': [{'name': 'balance', 'type': 'uint256'}],
        'type': 'function'
      },
      {
        'constant': true,
        'inputs': [],
        'name': 'decimals',
        'outputs': [{'name': '', 'type': 'uint8'}],
        'type': 'function'
      },
      {
        'constant': true,
        'inputs': [],
        'name': 'symbol',
        'outputs': [{'name': '', 'type': 'string'}],
        'type': 'function'
      },
      {
        'constant': true,
        'inputs': [],
        'name': 'name',
        'outputs': [{'name': '', 'type': 'string'}],
        'type': 'function'
      },
      {
        'constant': true,
        'inputs': [],
        'name': 'totalSupply',
        'outputs': [{'name': '', 'type': 'uint256'}],
        'type': 'function'
      }
    ];

    // Mock price data for USD calculations
    this.mockPrices = {
      'ETH': 2000,
      'WETH': 2000,
      'USDC': 1,
      'WBTC': 42000,
      'MATIC': 1.5,
      'WMATIC': 1.5,
      'BNB': 300,
      'WBNB': 300
    };

    logger.info('TokenBalanceAPIService initialized', {
      supportedNetworks: Object.keys(this.config.networks),
      cacheEnabled: this.config.cache.enabled,
      cacheTTL: this.config.cache.ttl
    });
  }

  /**
   * Create validation schema for service configuration
   * @returns {Object} Joi validation schema
   */
  createValidationSchema() {
    return Joi.object({
      networks: Joi.object().pattern(
        Joi.string(),
        Joi.object({
          rpcUrl: Joi.string().uri().required(),
          chainId: Joi.number().positive().required(),
          nativeSymbol: Joi.string().required(),
          nativeName: Joi.string().required(),
          nativeDecimals: Joi.number().positive().required()
        })
      ).required(),
      commonTokens: Joi.object().pattern(
        Joi.string(),
        Joi.object().pattern(
          Joi.string(),
          Joi.object({
            symbol: Joi.string().required(),
            name: Joi.string().required(),
            decimals: Joi.number().positive().required()
          })
        )
      ).default({}),
      cache: Joi.object({
        enabled: Joi.boolean().default(true),
        ttl: Joi.number().positive().default(30000)
      }).default(),
      rateLimit: Joi.object({
        maxRequests: Joi.number().positive().default(50),
        windowMs: Joi.number().positive().default(60000)
      }).default(),
      timeout: Joi.number().positive().default(15000),
      retryAttempts: Joi.number().min(0).max(5).default(2),
      retryDelay: Joi.number().positive().default(1000)
    });
  }

  /**
   * Get native token balance (ETH, MATIC, BNB, etc.)
   * @param {string} address - Wallet address
   * @param {string} network - Network name
   * @returns {Object} Native balance data
   */
  async getNativeBalance(address, network = 'ethereum') {
    try {
      // Validate inputs
      this.validateAddress(address);
      this.validateNetwork(network);

      const cacheKey = `native_balance_${network}_${address}`;
      
      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          logger.debug('Native balance cache hit', { address: address.slice(0, 10) + '...', network });
          return cached;
        }
      }

      // Check rate limiting
      const rateLimitKey = `native_balance_${network}`;
      if (!this.checkRateLimit(rateLimitKey)) {
        throw new ServiceError(`Rate limit exceeded for native balance queries on ${network}`);
      }

      const networkConfig = this.config.networks[network];
      const balance = await this.executeWithRetry(async () => {
        return await this.fetchNativeBalanceFromRPC(address, networkConfig);
      });

      // If balance is 0, return null
      if (!balance || balance === '0' || parseFloat(balance) === 0) {
        logger.debug('Native balance is 0, returning null', { address: address.slice(0, 10) + '...', network });
        return null;
      }

      const result = {
        address,
        network,
        symbol: networkConfig.nativeSymbol,
        name: networkConfig.nativeName,
        balance,
        balanceUSD: this.calculateUSDValue(balance, networkConfig.nativeSymbol),
        decimals: networkConfig.nativeDecimals,
        timestamp: Date.now()
      };

      // Cache the result
      if (this.config.cache.enabled) {
        this.setCachedData(cacheKey, result);
      }

      logger.debug('Native balance fetched successfully', { 
        address: address.slice(0, 10) + '...', 
        network, 
        balance: balance.slice(0, 10) + '...',
        symbol: networkConfig.nativeSymbol
      });

      return result;

    } catch (error) {
      this.handleError(error, 'getNativeBalance', { address: address?.slice(0, 10) + '...', network });
    }
  }

  /**
   * Get ERC-20 token balance
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {string} network - Network name
   * @returns {Object} Token balance data
   */
  async getTokenBalance(address, tokenAddress, network = 'ethereum') {
    try {
      // Validate inputs
      this.validateAddress(address);
      this.validateAddress(tokenAddress);
      this.validateNetwork(network);

      const cacheKey = `token_balance_${network}_${tokenAddress}_${address}`;
      
      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          logger.debug('Token balance cache hit', { 
            address: address.slice(0, 10) + '...', 
            tokenAddress: tokenAddress.slice(0, 10) + '...', 
            network 
          });
          return cached;
        }
      }

      // Check rate limiting
      const rateLimitKey = `token_balance_${network}`;
      if (!this.checkRateLimit(rateLimitKey)) {
        throw new ServiceError(`Rate limit exceeded for token balance queries on ${network}`);
      }

      const networkConfig = this.config.networks[network];
      
      // Fetch token metadata and balance concurrently
      const [metadata, balance] = await Promise.all([
        this.getTokenMetadata(tokenAddress, network),
        this.executeWithRetry(async () => {
          return await this.fetchTokenBalanceFromRPC(address, tokenAddress, networkConfig);
        })
      ]);

      // If balance is 0, return null
      if (!balance || balance === '0' || parseFloat(balance) === 0) {
        logger.debug('Token balance is 0, returning null', { 
          address: address.slice(0, 10) + '...', 
          tokenAddress: tokenAddress.slice(0, 10) + '...', 
          network 
        });
        return null;
      }

      const formattedBalance = this.formatBalance(balance, metadata.decimals);
      
      const result = {
        address,
        tokenAddress,
        network,
        symbol: metadata.symbol,
        name: metadata.name,
        balance: formattedBalance,
        balanceUSD: this.calculateUSDValue(formattedBalance, metadata.symbol),
        decimals: metadata.decimals,
        timestamp: Date.now()
      };

      // Cache the result
      if (this.config.cache.enabled) {
        this.setCachedData(cacheKey, result);
      }

      logger.debug('Token balance fetched successfully', { 
        address: address.slice(0, 10) + '...', 
        tokenAddress: tokenAddress.slice(0, 10) + '...', 
        network,
        balance: formattedBalance.slice(0, 10) + '...',
        symbol: metadata.symbol
      });

      return result;

    } catch (error) {
      this.handleError(error, 'getTokenBalance', { 
        address: address?.slice(0, 10) + '...', 
        tokenAddress: tokenAddress?.slice(0, 10) + '...', 
        network 
      });
    }
  }

  /**
   * Get all token balances for an address
   * @param {string} address - Wallet address
   * @param {string} network - Network name
   * @param {Object} options - Query options
   * @returns {Object} All token balances
   */
  async getAllTokenBalances(address, network = 'ethereum', options = {}) {
    try {
      // Validate inputs
      this.validateAddress(address);
      this.validateNetwork(network);

      const { includeZero = false, includeUSDValues = true } = options;
      const cacheKey = `all_balances_${network}_${address}_${includeZero}`;
      
      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          logger.debug('All token balances cache hit', { address: address.slice(0, 10) + '...', network });
          return cached;
        }
      }

      const balances = [];
      let totalUSD = 0;

      // Fetch native balance
      const nativeBalance = await this.getNativeBalance(address, network);
      if (nativeBalance && (includeZero || parseFloat(nativeBalance.balance) > 0)) {
        balances.push(nativeBalance);
        if (includeUSDValues && nativeBalance.balanceUSD) {
          totalUSD += parseFloat(nativeBalance.balanceUSD.replace(/[^0-9.-]/g, '')) || 0;
        }
      }

      // Fetch common token balances
      const commonTokens = this.config.commonTokens[network] || {};
      const tokenPromises = Object.keys(commonTokens).map(async (tokenAddress) => {
        try {
          const tokenBalance = await this.getTokenBalance(address, tokenAddress, network);
          if (tokenBalance && (includeZero || parseFloat(tokenBalance.balance) > 0)) {
            if (includeUSDValues && tokenBalance.balanceUSD) {
              totalUSD += parseFloat(tokenBalance.balanceUSD.replace(/[^0-9.-]/g, '')) || 0;
            }
            return tokenBalance;
          }
          return null;
        } catch (error) {
          logger.warn('Failed to fetch token balance', { 
            tokenAddress: tokenAddress.slice(0, 10) + '...', 
            error: error.message 
          });
          return null;
        }
      });

      const tokenBalances = (await Promise.all(tokenPromises)).filter(Boolean);
      balances.push(...tokenBalances);

      const result = {
        address,
        network,
        tokens: balances,
        totalUSD: includeUSDValues ? totalUSD.toFixed(2) : null,
        timestamp: Date.now()
      };

      // Cache the result
      if (this.config.cache.enabled) {
        this.setCachedData(cacheKey, result);
      }

      logger.debug('All token balances fetched successfully', { 
        address: address.slice(0, 10) + '...', 
        network,
        tokenCount: balances.length,
        totalUSD: result.totalUSD
      });

      return result;

    } catch (error) {
      this.handleError(error, 'getAllTokenBalances', { address: address?.slice(0, 10) + '...', network });
    }
  }

  /**
   * Get token metadata (symbol, name, decimals)
   * @param {string} tokenAddress - Token contract address
   * @param {string} network - Network name
   * @returns {Object} Token metadata
   */
  async getTokenMetadata(tokenAddress, network = 'ethereum') {
    try {
      // Validate inputs
      this.validateAddress(tokenAddress);
      this.validateNetwork(network);

      const cacheKey = `token_metadata_${network}_${tokenAddress}`;
      
      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          logger.debug('Token metadata cache hit', { tokenAddress: tokenAddress.slice(0, 10) + '...', network });
          return cached;
        }
      }

      // Check if we have common token metadata
      const commonTokens = this.config.commonTokens[network] || {};
      if (commonTokens[tokenAddress]) {
        const metadata = commonTokens[tokenAddress];
        
        // Cache the result
        if (this.config.cache.enabled) {
          this.setCachedData(cacheKey, metadata);
        }
        
        return metadata;
      }

      // Fetch from blockchain
      const networkConfig = this.config.networks[network];
      const metadata = await this.executeWithRetry(async () => {
        return await this.fetchTokenMetadataFromRPC(tokenAddress, networkConfig);
      });

      // Cache the result
      if (this.config.cache.enabled) {
        this.setCachedData(cacheKey, metadata);
      }

      logger.debug('Token metadata fetched from RPC', { 
        tokenAddress: tokenAddress.slice(0, 10) + '...', 
        network,
        symbol: metadata.symbol
      });

      return metadata;

    } catch (error) {
      this.handleError(error, 'getTokenMetadata', { tokenAddress: tokenAddress?.slice(0, 10) + '...', network });
    }
  }

  /**
   * Get portfolio value across multiple networks
   * @param {string} address - Wallet address
   * @param {Array<string>} networks - Networks to check
   * @returns {Object} Portfolio value data
   */
  async getPortfolioValue(address, networks = ['ethereum']) {
    try {
      // Validate inputs
      this.validateAddress(address);
      
      if (!Array.isArray(networks) || networks.length === 0) {
        throw new ServiceError('Networks must be a non-empty array');
      }

      networks.forEach(network => this.validateNetwork(network));

      const cacheKey = `portfolio_${address}_${networks.join('_')}`;
      
      // Check cache first
      if (this.config.cache.enabled) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          logger.debug('Portfolio value cache hit', { address: address.slice(0, 10) + '...', networks });
          return cached;
        }
      }

      // Fetch balances for all networks concurrently
      const networkPromises = networks.map(async (network) => {
        try {
          const balances = await this.getAllTokenBalances(address, network, { includeUSDValues: true });
          const networkValue = parseFloat(balances.totalUSD || '0');
          
          return {
            network,
            valueUSD: networkValue,
            tokenCount: balances.tokens.length,
            tokens: balances.tokens
          };
        } catch (error) {
          logger.warn('Failed to fetch portfolio for network', { network, error: error.message });
          return {
            network,
            valueUSD: 0,
            tokenCount: 0,
            tokens: [],
            error: error.message
          };
        }
      });

      const networkResults = await Promise.all(networkPromises);
      const totalUSD = networkResults.reduce((sum, result) => sum + result.valueUSD, 0);

      const result = {
        address,
        networks,
        totalUSD: totalUSD.toFixed(2),
        breakdown: networkResults,
        timestamp: Date.now()
      };

      // Cache the result
      if (this.config.cache.enabled) {
        this.setCachedData(cacheKey, result);
      }

      logger.debug('Portfolio value calculated successfully', { 
        address: address.slice(0, 10) + '...', 
        networks,
        totalUSD: result.totalUSD
      });

      return result;

    } catch (error) {
      this.handleError(error, 'getPortfolioValue', { address: address?.slice(0, 10) + '...', networks });
    }
  }

  /**
   * Get supported networks
   * @returns {Array<string>} Supported network names
   */
  getSupportedNetworks() {
    return Object.keys(this.config.networks);
  }

  /**
   * Get common tokens for a network
   * @param {string} network - Network name
   * @returns {Object} Common tokens for the network
   */
  getCommonTokens(network) {
    this.validateNetwork(network);
    return this.config.commonTokens[network] || {};
  }

  /**
   * Fetch native balance from RPC
   * @param {string} address - Wallet address
   * @param {Object} networkConfig - Network configuration
   * @returns {string} Balance in wei
   */
  async fetchNativeBalanceFromRPC(address, networkConfig) {
    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 1
    };

    const response = await this.apiClient.post(networkConfig.rpcUrl, rpcPayload, {
      rateLimitKey: `rpc_${networkConfig.chainId}`,
      rateLimit: this.config.rateLimit
    });

    if (response.error) {
      throw new ServiceError(`RPC error: ${response.error.message}`);
    }

    const balanceWei = response.result;
    return this.formatBalance(balanceWei, networkConfig.nativeDecimals);
  }

  /**
   * Fetch token balance from RPC
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - Token contract address
   * @param {Object} networkConfig - Network configuration
   * @returns {string} Balance in token units
   */
  async fetchTokenBalanceFromRPC(address, tokenAddress, networkConfig) {
    // Encode balanceOf function call
    const functionSignature = '0x70a08231'; // balanceOf(address)
    const paddedAddress = address.slice(2).padStart(64, '0');
    const data = functionSignature + paddedAddress;

    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: data
      }, 'latest'],
      id: 1
    };

    const response = await this.apiClient.post(networkConfig.rpcUrl, rpcPayload, {
      rateLimitKey: `rpc_${networkConfig.chainId}`,
      rateLimit: this.config.rateLimit
    });

    if (response.error) {
      throw new ServiceError(`RPC error: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Fetch token metadata from RPC
   * @param {string} tokenAddress - Token contract address
   * @param {Object} networkConfig - Network configuration
   * @returns {Object} Token metadata
   */
  async fetchTokenMetadataFromRPC(tokenAddress, networkConfig) {
    try {
      // Fetch symbol, name, and decimals concurrently
      const [symbol, name, decimals] = await Promise.all([
        this.callTokenFunction(tokenAddress, '0x95d89b41', networkConfig), // symbol()
        this.callTokenFunction(tokenAddress, '0x06fdde03', networkConfig), // name()
        this.callTokenFunction(tokenAddress, '0x313ce567', networkConfig)  // decimals()
      ]);

      return {
        symbol: this.decodeString(symbol) || 'UNKNOWN',
        name: this.decodeString(name) || 'Unknown Token',
        decimals: parseInt(decimals, 16) || 18
      };
    } catch (error) {
      logger.warn('Failed to fetch token metadata from RPC, using fallback', { 
        tokenAddress: tokenAddress.slice(0, 10) + '...', 
        error: error.message 
      });
      
      return {
        symbol: tokenAddress.slice(0, 6).toUpperCase(),
        name: 'Unknown Token',
        decimals: 18
      };
    }
  }

  /**
   * Call token contract function
   * @param {string} tokenAddress - Token contract address
   * @param {string} functionSignature - Function signature
   * @param {Object} networkConfig - Network configuration
   * @returns {string} Function result
   */
  async callTokenFunction(tokenAddress, functionSignature, networkConfig) {
    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{
        to: tokenAddress,
        data: functionSignature
      }, 'latest'],
      id: 1
    };

    const response = await this.apiClient.post(networkConfig.rpcUrl, rpcPayload, {
      rateLimitKey: `rpc_${networkConfig.chainId}`,
      rateLimit: this.config.rateLimit
    });

    if (response.error) {
      throw new ServiceError(`RPC error: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Decode string from hex
   * @param {string} hex - Hex string
   * @returns {string} Decoded string
   */
  decodeString(hex) {
    if (!hex || hex === '0x') return '';
    
    try {
      // Remove 0x prefix
      const cleanHex = hex.slice(2);
      
      // Skip the first 64 characters (offset and length)
      const dataHex = cleanHex.slice(128);
      
      // Convert hex to string
      let result = '';
      for (let i = 0; i < dataHex.length; i += 2) {
        const byte = parseInt(dataHex.substr(i, 2), 16);
        if (byte !== 0) {
          result += String.fromCharCode(byte);
        }
      }
      
      return result.trim();
    } catch (error) {
      logger.warn('Failed to decode string from hex', { hex, error: error.message });
      return '';
    }
  }

  /**
   * Format balance from wei/raw units to human readable
   * @param {string} balance - Balance in wei/raw units
   * @param {number} decimals - Token decimals
   * @returns {string} Formatted balance
   */
  formatBalance(balance, decimals) {
    if (!balance || balance === '0x0' || balance === '0') return '0';
    
    try {
      // Convert hex to decimal if needed
      const balanceInt = balance.startsWith('0x') ? BigInt(balance) : BigInt(balance);
      const divisor = BigInt(10 ** decimals);
      const wholePart = balanceInt / divisor;
      const fractionalPart = balanceInt % divisor;
      
      if (fractionalPart === 0n) {
        return wholePart.toString();
      }
      
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      const trimmedFractional = fractionalStr.replace(/0+$/, '');
      
      if (trimmedFractional === '') {
        return wholePart.toString();
      }
      
      return `${wholePart}.${trimmedFractional}`;
    } catch (error) {
      logger.warn('Failed to format balance', { balance, decimals, error: error.message });
      return '0';
    }
  }

  /**
   * Calculate USD value (mock implementation)
   * @param {string} balance - Token balance
   * @param {string} symbol - Token symbol
   * @returns {string} USD value
   */
  calculateUSDValue(balance, symbol) {
    try {
      const price = this.mockPrices[symbol] || 0;
      const value = parseFloat(balance) * price;
      return value > 0 ? `$${value.toLocaleString()}` : '$0';
    } catch (error) {
      logger.warn('Failed to calculate USD value', { balance, symbol, error: error.message });
      return '$0';
    }
  }

  /**
   * Validate Ethereum address
   * @param {string} address - Address to validate
   */
  validateAddress(address) {
    if (!address || typeof address !== 'string') {
      throw new ServiceError('Address must be a non-empty string');
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new ServiceError('Invalid Ethereum address format');
    }
  }

  /**
   * Validate network name
   * @param {string} network - Network name to validate
   */
  validateNetwork(network) {
    if (!network || typeof network !== 'string') {
      throw new ServiceError('Network must be a non-empty string');
    }
    
    if (!this.config.networks[network]) {
      throw new ServiceError(`Unsupported network: ${network}. Supported networks: ${Object.keys(this.config.networks).join(', ')}`);
    }
  }
}