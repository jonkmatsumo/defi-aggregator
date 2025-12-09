import { jest } from '@jest/globals';
import fc from 'fast-check';

// Mock the logger
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  logError: jest.fn()
}));

// Mock UUID for predictable test results
jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
}));

// Mock the service container with all services
jest.unstable_mockModule('../../src/services/container.js', () => ({
  serviceContainer: {
    get: jest.fn().mockImplementation((serviceName) => {
      if (serviceName === 'GasPriceAPIService') {
        return {
          getGasPrices: jest.fn().mockResolvedValue({
            network: 'ethereum',
            gasPrices: {
              slow: { gwei: 10, usd_cost: 0.30 },
              standard: { gwei: 15, usd_cost: 0.45 },
              fast: { gwei: 20, usd_cost: 0.60 }
            },
            timestamp: Date.now(),
            source: 'test'
          })
        };
      }
      if (serviceName === 'PriceFeedAPIService') {
        return {
          getCryptocurrencyPrice: jest.fn().mockResolvedValue({
            symbol: 'BTC',
            price: 42000,
            currency: 'USD',
            change_24h: 2.5,
            volume_24h: 15000000000,
            market_cap: 820000000000,
            timestamp: Date.now(),
            source: 'test'
          })
        };
      }
      if (serviceName === 'LendingAPIService') {
        return {
          getLendingRates: jest.fn().mockResolvedValue({
            token: 'USDC',
            protocols: [
              {
                protocol: 'aave',
                symbol: 'USDC',
                supplyAPY: 0.032,
                borrowAPY: 0.052,
                totalSupply: 4000000,
                totalBorrow: 2000000,
                utilizationRate: 0.5,
                timestamp: Date.now(),
                source: 'test'
              }
            ],
            timestamp: Date.now(),
            source: 'test'
          })
        };
      }
      if (serviceName === 'TokenBalanceAPIService') {
        return {
          getTokenBalance: jest.fn().mockResolvedValue({
            address: '0x1234567890123456789012345678901234567890',
            tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            network: 'ethereum',
            symbol: 'USDC',
            balance: '1000.50',
            balanceUSD: '$1,000.50',
            decimals: 6,
            timestamp: Date.now()
          }),
          getAllTokenBalances: jest.fn().mockResolvedValue({
            address: '0x1234567890123456789012345678901234567890',
            network: 'ethereum',
            tokens: [
              { symbol: 'ETH', name: 'Ether', balance: '1.5', balanceUSD: '$3000', decimals: 18 },
              { symbol: 'USDC', name: 'USD Coin', balance: '1000', balanceUSD: '$1000', decimals: 6 }
            ],
            totalUSD: '4000',
            timestamp: Date.now()
          })
        };
      }
      throw new Error(`Service not found: ${serviceName}`);
    })
  }
}));

// Import modules after mocks
const { ConversationManager } = await import('../../src/conversation/manager.js');
const { ToolRegistry } = await import('../../src/tools/registry.js');
const { AgentResponseFormatter } = await import('../../src/utils/agentResponseFormatter.js');

describe('AI Agent Integration Tests', () => {
  let manager;
  let mockLLM;
  let registry;
  let intentGenerator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock LLM interface
    mockLLM = {
      generateResponse: jest.fn(),
      generateStreamingResponse: jest.fn()
    };

    // Create real tool registry
    registry = new ToolRegistry();

    // Create mock component intent generator
    intentGenerator = {
      generateIntent: jest.fn(() => null)
    };

    // Create conversation manager
    manager = new ConversationManager(
      mockLLM,
      registry,
      intentGenerator,
      {
        maxHistoryLength: 50,
        sessionTimeoutMs: 60000,
        cleanupIntervalMs: 30000
      }
    );
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('End-to-End Message Processing Flow', () => {
    it('should process a message without tool calls successfully', async () => {
      const sessionId = 'test-session-1';
      const userMessage = 'Hello, how are you?';
      const expectedResponse = 'I\'m doing great! How can I help you with DeFi today?';

      mockLLM.generateResponse.mockResolvedValueOnce({
        content: expectedResponse,
        toolCalls: [],
        usage: { total_tokens: 50 }
      });

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.content).toBe(expectedResponse);
      expect(result.role).toBe('assistant');
      expect(result.toolResults).toBeUndefined();
      expect(mockLLM.generateResponse).toHaveBeenCalledTimes(1);
    });

    it('should process a message with gas price tool call', async () => {
      const sessionId = 'test-session-gas';
      const userMessage = 'What are the current gas prices on Ethereum?';

      // First LLM call returns tool request
      mockLLM.generateResponse.mockResolvedValueOnce({
        content: 'Let me check the current gas prices for you.',
        toolCalls: [{
          id: 'call_gas_1',
          name: 'get_gas_prices',
          parameters: { network: 'ethereum' }
        }],
        usage: { total_tokens: 100 }
      });

      // Second LLM call after tool execution
      mockLLM.generateResponse.mockResolvedValueOnce({
        content: 'The current gas prices on Ethereum are: Slow: 10 gwei ($0.30), Standard: 15 gwei ($0.45), Fast: 20 gwei ($0.60). Gas prices are currently low - a good time for transactions!',
        toolCalls: [],
        usage: { total_tokens: 150 }
      });

      const result = await manager.processMessage(sessionId, userMessage);

      // Verify tool was executed
      expect(result.toolResults).toBeDefined();
      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults[0].toolName).toBe('get_gas_prices');
      expect(result.toolResults[0].success).toBe(true);

      // Verify formatted results are included
      expect(result.formattedResults).toBeDefined();
      expect(result.formattedResults.results).toHaveLength(1);
      expect(result.formattedResults.results[0].type).toBe('gas_prices');

      // Verify LLM was called twice
      expect(mockLLM.generateResponse).toHaveBeenCalledTimes(2);
    });

    it('should process a message with crypto price tool call', async () => {
      const sessionId = 'test-session-crypto';
      const userMessage = 'What is the current price of Bitcoin?';

      mockLLM.generateResponse
        .mockResolvedValueOnce({
          content: 'Let me check the Bitcoin price.',
          toolCalls: [{
            id: 'call_crypto_1',
            name: 'get_crypto_price',
            parameters: { symbol: 'BTC', currency: 'USD' }
          }],
          usage: { total_tokens: 80 }
        })
        .mockResolvedValueOnce({
          content: 'Bitcoin is currently trading at $42,000 USD, up 2.5% in the last 24 hours.',
          toolCalls: [],
          usage: { total_tokens: 120 }
        });

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults[0].toolName).toBe('get_crypto_price');
      expect(result.formattedResults.results[0].type).toBe('crypto_price');
    });

    it('should process a message with lending rates tool call', async () => {
      const sessionId = 'test-session-lending';
      const userMessage = 'What are the USDC lending rates on Aave?';

      mockLLM.generateResponse
        .mockResolvedValueOnce({
          content: 'I\'ll check the USDC lending rates for you.',
          toolCalls: [{
            id: 'call_lending_1',
            name: 'get_lending_rates',
            parameters: { token: 'USDC', protocols: ['aave'] }
          }],
          usage: { total_tokens: 90 }
        })
        .mockResolvedValueOnce({
          content: 'On Aave, USDC has a supply APY of 3.2% and a borrow APY of 5.2%.',
          toolCalls: [],
          usage: { total_tokens: 130 }
        });

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults[0].toolName).toBe('get_lending_rates');
      expect(result.formattedResults.results[0].type).toBe('lending_rates');
    });

    it('should process a message with multiple tool calls', async () => {
      const sessionId = 'test-session-multi';
      const userMessage = 'Show me gas prices and BTC price';

      mockLLM.generateResponse
        .mockResolvedValueOnce({
          content: 'I\'ll get both for you.',
          toolCalls: [
            { id: 'call_multi_1', name: 'get_gas_prices', parameters: { network: 'ethereum' } },
            { id: 'call_multi_2', name: 'get_crypto_price', parameters: { symbol: 'BTC' } }
          ],
          usage: { total_tokens: 100 }
        })
        .mockResolvedValueOnce({
          content: 'Here are the results: Gas is at 15 gwei standard, and BTC is at $42,000.',
          toolCalls: [],
          usage: { total_tokens: 180 }
        });

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.toolResults).toHaveLength(2);
      expect(result.formattedResults.results).toHaveLength(2);
      expect(result.formattedResults.hasErrors).toBe(false);
    });
  });

  describe('Error Handling in AI Agent Flow', () => {
    it('should handle tool execution errors gracefully', async () => {
      const sessionId = 'test-session-error';
      const userMessage = 'Get gas prices';

      // Register a failing tool
      registry.registerTool('failing_tool', {
        description: 'A tool that fails',
        parameters: {},
        execute: async () => {
          throw new Error('Service unavailable');
        }
      });

      mockLLM.generateResponse
        .mockResolvedValueOnce({
          content: 'Let me check.',
          toolCalls: [{ id: 'call_error_1', name: 'failing_tool', parameters: {} }],
          usage: { total_tokens: 50 }
        })
        .mockResolvedValueOnce({
          content: 'I encountered an error retrieving that information.',
          toolCalls: [],
          usage: { total_tokens: 80 }
        });

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults[0].success).toBe(false);
      expect(result.toolResults[0].error).toBe('Service unavailable');
      expect(result.formattedResults.hasErrors).toBe(true);
    });

    it('should provide user-friendly error when LLM fails', async () => {
      const sessionId = 'test-session-llm-error';
      const userMessage = 'Hello';

      mockLLM.generateResponse.mockRejectedValueOnce(new Error('OpenAI API error'));

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.role).toBe('assistant');
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('LLM_ERROR');
      expect(result.error.retryable).toBe(true);
      expect(result.error.suggestions).toBeDefined();
      expect(result.error.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle rate limit errors with appropriate messaging', async () => {
      const sessionId = 'test-session-rate';
      const userMessage = 'Hello';

      const rateLimitError = new Error('Rate limit exceeded');
      mockLLM.generateResponse.mockRejectedValueOnce(rateLimitError);

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.error.code).toBe('RATE_LIMIT');
      expect(result.error.retryable).toBe(true);
    });

    it('should handle validation errors with helpful suggestions', async () => {
      const sessionId = 'test-session-validation';
      const userMessage = 'Hello';

      const validationError = new Error('Invalid address format');
      mockLLM.generateResponse.mockRejectedValueOnce(validationError);

      const result = await manager.processMessage(sessionId, userMessage);

      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.retryable).toBe(false);
      expect(result.error.suggestions).toContain('Make sure wallet addresses are valid Ethereum addresses');
    });
  });

  describe('Session Management with Tool Execution', () => {
    it('should maintain conversation history across tool executions', async () => {
      const sessionId = 'test-session-history';

      // First message
      mockLLM.generateResponse.mockResolvedValueOnce({
        content: 'Hello! How can I help?',
        toolCalls: [],
        usage: { total_tokens: 30 }
      });
      await manager.processMessage(sessionId, 'Hi');

      // Second message with tool call
      mockLLM.generateResponse
        .mockResolvedValueOnce({
          content: 'Checking gas...',
          toolCalls: [{ id: 'call_history_1', name: 'get_gas_prices', parameters: { network: 'ethereum' } }],
          usage: { total_tokens: 50 }
        })
        .mockResolvedValueOnce({
          content: 'Gas is 15 gwei',
          toolCalls: [],
          usage: { total_tokens: 70 }
        });
      await manager.processMessage(sessionId, 'What are gas prices?');

      const session = manager.getSession(sessionId);

      // Should have messages including tool messages
      expect(session.messages.length).toBeGreaterThanOrEqual(4);

      const roles = session.messages.map(m => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
      expect(roles).toContain('tool');
    });

    it('should include tool context in subsequent LLM calls', async () => {
      const sessionId = 'test-session-context';

      mockLLM.generateResponse
        .mockResolvedValueOnce({
          content: 'Let me get that.',
          toolCalls: [{ id: 'call_context_1', name: 'get_gas_prices', parameters: { network: 'ethereum' } }],
          usage: { total_tokens: 60 }
        })
        .mockResolvedValueOnce({
          content: 'Gas is 15 gwei standard.',
          toolCalls: [],
          usage: { total_tokens: 100 }
        });

      await manager.processMessage(sessionId, 'Gas prices please');

      // Second call should include tool results in context
      const secondCall = mockLLM.generateResponse.mock.calls[1];
      const messages = secondCall[0];

      expect(messages.some(m => m.role === 'tool')).toBe(true);
    });
  });

  describe('Property Tests for AI Agent Flow', () => {
    it('should always return a valid response structure', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        async (userMessage) => {
          const sessionId = 'prop-test-' + Math.random().toString(36).substr(2, 9);
          const newManager = new ConversationManager(
            {
              generateResponse: jest.fn().mockResolvedValue({
                content: 'Response: ' + userMessage.slice(0, 50),
                toolCalls: [],
                usage: { total_tokens: 50 }
              })
            },
            registry,
            intentGenerator,
            { cleanupIntervalMs: 60000 }
          );

          try {
            const result = await newManager.processMessage(sessionId, userMessage);

            // Response should always have these properties
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('role', 'assistant');
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('timestamp');
            expect(typeof result.id).toBe('string');
            expect(typeof result.content).toBe('string');
            expect(typeof result.timestamp).toBe('number');
          } finally {
            newManager.destroy();
          }
        }
      ), { numRuns: 20 });
    });

    it('should handle any combination of tool calls correctly', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(
          fc.constantFrom('get_gas_prices', 'get_crypto_price', 'get_lending_rates'),
          { minLength: 1, maxLength: 3 }
        ),
        async (toolNames) => {
          const sessionId = 'prop-multi-' + Math.random().toString(36).substr(2, 9);

          const toolCalls = toolNames.map((name, index) => {
            const params = {
              'get_gas_prices': { network: 'ethereum' },
              'get_crypto_price': { symbol: 'BTC' },
              'get_lending_rates': { token: 'USDC' }
            };
            return {
              id: `call_prop_${index}_${Math.random().toString(36).substr(2, 5)}`,
              name,
              parameters: params[name]
            };
          });

          mockLLM.generateResponse
            .mockResolvedValueOnce({
              content: 'Processing...',
              toolCalls,
              usage: { total_tokens: 100 }
            })
            .mockResolvedValueOnce({
              content: 'Here are the results.',
              toolCalls: [],
              usage: { total_tokens: 150 }
            });

          const result = await manager.processMessage(sessionId, 'Get data');

          // Should have results for all tools
          expect(result.toolResults).toHaveLength(toolNames.length);
          expect(result.formattedResults.results).toHaveLength(toolNames.length);

          // All tool results should be successful
          result.toolResults.forEach(tr => {
            expect(tr.success).toBe(true);
            expect(tr.result).toBeDefined();
          });
        }
      ), { numRuns: 20 });
    });
  });
});

