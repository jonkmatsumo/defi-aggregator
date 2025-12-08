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