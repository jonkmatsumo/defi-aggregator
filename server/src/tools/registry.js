import { logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
import { serviceContainer } from '../services/container.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map(); // toolName -> ToolDefinition
    this.initializeDefaultTools();

    // Retry configuration for transient tool failures
    this.retryConfig = {
      maxRetries: 2,
      baseDelayMs: 200
    };
  }

  /**
   * Validate parameters against a lightweight JSON-schema-like definition.
   * Throws a ToolError with code INVALID_PARAMETERS when validation fails.
   */
  validateParameters(schema = {}, params = {}) {
    if (!schema || typeof schema !== 'object' || schema.type !== 'object') {
      return;
    }

    const errors = [];
    const properties = schema.properties || {};
    const required = schema.required || [];

    // Required checks
    for (const reqKey of required) {
      if (params[reqKey] === undefined || params[reqKey] === null || params[reqKey] === '') {
        errors.push(`Missing required parameter: ${reqKey}`);
      }
    }

    // Property validation
    for (const [key, definition] of Object.entries(properties)) {
      const value = params[key];

      if (value === undefined || value === null) continue; // handled by required check

      // Type validation (lightweight)
      switch (definition.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Parameter "${key}" must be a string`);
        }
        if (definition.pattern) {
          const regex = new RegExp(definition.pattern);
          if (!regex.test(value)) {
            errors.push(`Parameter "${key}" does not match required pattern`);
          }
        }
        if (definition.enum && !definition.enum.includes(value)) {
          errors.push(`Parameter "${key}" must be one of: ${definition.enum.join(', ')}`);
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`Parameter "${key}" must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Parameter "${key}" must be a boolean`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Parameter "${key}" must be an array`);
        } else if (definition.items?.enum) {
          const invalid = value.filter(v => !definition.items.enum.includes(v));
          if (invalid.length > 0) {
            errors.push(`Parameter "${key}" has invalid values: ${invalid.join(', ')}. Allowed: ${definition.items.enum.join(', ')}`);
          }
        }
        break;
      default:
        break;
      }
    }

    if (errors.length > 0) {
      const error = new ToolError(`Invalid parameters: ${errors.join('; ')}`);
      error.code = 'INVALID_PARAMETERS';
      throw error;
    }
  }

  getRecoverySuggestions(errorCode) {
    switch (errorCode) {
    case 'INVALID_PARAMETERS':
      return [
        'Check required parameters and their formats.',
        'Verify enum values (symbols, networks, protocols) are supported.',
        'Ensure addresses are valid hex strings with 0x prefix.'
      ];
    case 'RATE_LIMIT':
      return [
        'Wait a few seconds and retry.',
        'Reduce request frequency.',
        'If the problem persists, try again later.'
      ];
    case 'NETWORK_ERROR':
      return [
        'Check network connectivity.',
        'Retry after a short delay.',
        'If the problem persists, try a different network.'
      ];
    case 'TOOL_ERROR':
    default:
      return [
        'Retry the request shortly.',
        'Try with fewer parameters or different inputs.',
        'If the problem persists, contact support with the error code.'
      ];
    }
  }

  initializeDefaultTools() {
    // Gas price tool with backend service integration
    this.registerTool('get_gas_prices', {
      description: 'Get current gas prices and network fee estimates for blockchain transactions',
      parameters: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'],
            default: 'ethereum',
            description: 'Blockchain network to check gas prices for',
            examples: ['ethereum', 'polygon', 'arbitrum']
          },
          transactionType: {
            type: 'string',
            enum: ['transfer', 'swap', 'contract_interaction'],
            default: 'transfer',
            description: 'Type of transaction to estimate gas for',
            examples: ['transfer', 'swap']
          },
          includeUSDCosts: {
            type: 'boolean',
            default: true,
            description: 'Include USD cost estimates for gas fees',
            examples: [true, false]
          }
        },
        required: ['network']
      },
      execute: async ({ network = 'ethereum', transactionType = 'transfer', includeUSDCosts = true }) => {
        try {
          this.validateParameters(this.tools.get('get_gas_prices')?.parameters, { network, transactionType, includeUSDCosts });
          const gasPriceService = serviceContainer.get('GasPriceAPIService');
          const result = await gasPriceService.getGasPrices(network, { transactionType, includeUSDCosts });
          
          logger.info('Gas price tool executed successfully', { network, transactionType });
          return result;
        } catch (error) {
          logger.error('Gas price tool execution failed', { 
            network, 
            transactionType, 
            error: error.message 
          });
          throw error;
        }
      }
    });

    // Cryptocurrency price tool with backend service integration
    this.registerTool('get_crypto_price', {
      description: 'Get current cryptocurrency prices and market data for specific tokens',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Cryptocurrency symbol (e.g., BTC, ETH, USDC)',
            examples: ['BTC', 'ETH', 'USDC', 'LINK', 'UNI']
          },
          currency: {
            type: 'string',
            enum: ['USD', 'EUR', 'GBP'],
            default: 'USD',
            description: 'Fiat currency for price conversion',
            examples: ['USD', 'EUR']
          },
          includeMarketData: {
            type: 'boolean',
            default: true,
            description: 'Include additional market data like 24h change, volume, market cap',
            examples: [true, false]
          }
        },
        required: ['symbol']
      },
      execute: async ({ symbol, currency = 'USD', includeMarketData = true }) => {
        try {
          this.validateParameters(this.tools.get('get_crypto_price')?.parameters, { symbol, currency, includeMarketData });
          const priceFeedService = serviceContainer.get('PriceFeedAPIService');
          const result = await priceFeedService.getCryptocurrencyPrice(symbol, currency, includeMarketData);
          
          logger.info('Crypto price tool executed successfully', { symbol, currency });
          return result;
        } catch (error) {
          logger.error('Crypto price tool execution failed', { 
            symbol, 
            currency, 
            error: error.message 
          });
          throw error;
        }
      }
    });

    // DeFi lending rates tool with backend service integration
    this.registerTool('get_lending_rates', {
      description: 'Get current lending and borrowing rates from major DeFi protocols like Aave and Compound',
      parameters: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'Token symbol to get lending rates for',
            examples: ['USDC', 'DAI', 'ETH', 'WBTC']
          },
          protocols: {
            type: 'array',
            items: { type: 'string' },
            default: ['aave', 'compound'],
            description: 'DeFi protocols to check rates for',
            examples: [['aave', 'compound'], ['aave']]
          },
          includeUtilization: {
            type: 'boolean',
            default: true,
            description: 'Include utilization rates and total liquidity data',
            examples: [true, false]
          }
        },
        required: ['token']
      },
      execute: async ({ token, protocols = ['aave', 'compound'], includeUtilization = true }) => {
        try {
          this.validateParameters(this.tools.get('get_lending_rates')?.parameters, { token, protocols, includeUtilization });
          const lendingService = serviceContainer.get('LendingAPIService');
          const result = await lendingService.getLendingRates(token, protocols, { includeUtilization });
          
          logger.info('Lending rates tool executed successfully', { token, protocols });
          return result;
        } catch (error) {
          logger.error('Lending rates tool execution failed', { 
            token, 
            protocols, 
            error: error.message 
          });
          throw error;
        }
      }
    });

    // Token balance tool with backend service integration
    this.registerTool('get_token_balance', {
      description: 'Get token balances for a specific wallet address on blockchain networks',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Wallet address to check balances for',
            pattern: '^0x[a-fA-F0-9]{40}$',
            examples: ['0x1234567890abcdef1234567890abcdef12345678']
          },
          network: {
            type: 'string',
            enum: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'],
            default: 'ethereum',
            description: 'Blockchain network to check balances on',
            examples: ['ethereum', 'polygon']
          },
          tokenAddress: {
            type: 'string',
            description: 'Specific token contract address (optional, for single token query)',
            pattern: '^0x[a-fA-F0-9]{40}$',
            examples: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48']
          },
          includeUSDValues: {
            type: 'boolean',
            default: true,
            description: 'Include USD value calculations for balances',
            examples: [true, false]
          }
        },
        required: ['address']
      },
      execute: async ({ address, network = 'ethereum', tokenAddress, includeUSDValues = true }) => {
        try {
          this.validateParameters(this.tools.get('get_token_balance')?.parameters, { address, network, tokenAddress, includeUSDValues });
          const tokenBalanceService = serviceContainer.get('TokenBalanceAPIService');
          
          let result;
          if (tokenAddress) {
            result = await tokenBalanceService.getTokenBalance(address, tokenAddress, network);
          } else {
            result = await tokenBalanceService.getAllTokenBalances(address, network, { includeUSDValues });
          }
          
          logger.info('Token balance tool executed successfully', { 
            address: address.slice(0, 10) + '...', 
            network 
          });
          return result;
        } catch (error) {
          logger.error('Token balance tool execution failed', { 
            address: address?.slice(0, 10) + '...', 
            network, 
            error: error.message 
          });
          throw error;
        }
      }
    });

    logger.info('Default tools initialized', { toolCount: this.tools.size });
  }

  registerTool(name, definition) {
    if (!name || typeof name !== 'string') {
      throw new ToolError('Tool name must be a non-empty string');
    }

    if (!definition || typeof definition !== 'object') {
      throw new ToolError('Tool definition must be an object');
    }

    if (typeof definition.execute !== 'function') {
      throw new ToolError('Tool definition must include an execute function');
    }

    this.tools.set(name, {
      name,
      description: definition.description || '',
      parameters: definition.parameters || {},
      execute: definition.execute
    });

    logger.info('Tool registered', { toolName: name });
  }

  async executeTool(name, parameters = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Tool not found: ${name}`, name);
    }

    try {
      logger.debug('Executing tool', { toolName: name, parameters });
      const startTime = Date.now();

      const result = await this._executeWithRetry(tool, parameters, name);

      const executionTime = Date.now() - startTime;
      logger.info('Tool executed successfully', { 
        toolName: name, 
        executionTime 
      });

      return {
        toolName: name,
        parameters,
        result,
        executionTime,
        success: true
      };

    } catch (error) {
      logger.error('Tool execution failed', { 
        toolName: name, 
        error: error.message,
        stack: error.stack 
      });

      const errorCode = error.code || 'TOOL_ERROR';

      return {
        toolName: name,
        parameters,
        result: null,
        executionTime: 0,
        success: false,
        error: error.message,
        errorCode,
        recoverySuggestions: this.getRecoverySuggestions(errorCode)
      };
    }
  }

  async _executeWithRetry(tool, parameters, toolName) {
    let attempt = 0;
    let lastError;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        return await tool.execute(parameters);
      } catch (err) {
        lastError = err;
        if (!this._isRetryableError(err) || attempt === this.retryConfig.maxRetries) {
          throw err;
        }
        const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
        logger.warn('Retrying tool execution', { toolName, attempt: attempt + 1, delay, error: err.message });
        await this._sleep(delay);
        attempt++;
      }
    }

    throw lastError;
  }

  _isRetryableError(error) {
    const code = (error.code || '').toUpperCase();
    if (code === 'NETWORK_ERROR' || code === 'RATE_LIMIT' || code === 'SERVICE_UNAVAILABLE') {
      return true;
    }
    if (typeof error.status === 'number' && (error.status === 429 || error.status >= 500)) {
      return true;
    }
    return false;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getToolDefinitions() {
    const definitions = [];
    for (const tool of this.tools.values()) {
      definitions.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      });
    }
    return definitions;
  }

  getToolNames() {
    return Array.from(this.tools.keys());
  }

  hasTool(name) {
    return this.tools.has(name);
  }
}