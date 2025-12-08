import { logger } from '../utils/logger.js';
import { ToolError } from '../utils/errors.js';
import { serviceContainer } from '../services/container.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map(); // toolName -> ToolDefinition
    this.initializeDefaultTools();
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
            description: 'Blockchain network to check gas prices for'
          },
          transactionType: {
            type: 'string',
            enum: ['transfer', 'swap', 'contract_interaction'],
            default: 'transfer',
            description: 'Type of transaction to estimate gas for'
          },
          includeUSDCosts: {
            type: 'boolean',
            default: true,
            description: 'Include USD cost estimates for gas fees'
          }
        }
      },
      execute: async ({ network = 'ethereum', transactionType = 'transfer', includeUSDCosts = true }) => {
        try {
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
            description: 'Fiat currency for price conversion'
          },
          includeMarketData: {
            type: 'boolean',
            default: true,
            description: 'Include additional market data like 24h change, volume, market cap'
          }
        },
        required: ['symbol']
      },
      execute: async ({ symbol, currency = 'USD', includeMarketData = true }) => {
        try {
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
            description: 'DeFi protocols to check rates for'
          },
          includeUtilization: {
            type: 'boolean',
            default: true,
            description: 'Include utilization rates and total liquidity data'
          }
        },
        required: ['token']
      },
      execute: async ({ token, protocols = ['aave', 'compound'], includeUtilization = true }) => {
        try {
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
            pattern: '^0x[a-fA-F0-9]{40}$'
          },
          network: {
            type: 'string',
            enum: ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'],
            default: 'ethereum',
            description: 'Blockchain network to check balances on'
          },
          tokenAddress: {
            type: 'string',
            description: 'Specific token contract address (optional, for single token query)',
            pattern: '^0x[a-fA-F0-9]{40}$'
          },
          includeUSDValues: {
            type: 'boolean',
            default: true,
            description: 'Include USD value calculations for balances'
          }
        },
        required: ['address']
      },
      execute: async ({ address, network = 'ethereum', tokenAddress, includeUSDValues = true }) => {
        try {
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
      
      const result = await tool.execute(parameters);
      
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

      return {
        toolName: name,
        parameters,
        result: null,
        executionTime: 0,
        success: false,
        error: error.message
      };
    }
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