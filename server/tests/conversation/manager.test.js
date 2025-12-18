import { jest } from '@jest/globals';
import fc from 'fast-check';
import { ConversationManager } from '../../src/conversation/manager.js';
import { ToolRegistry } from '../../src/tools/registry.js';

// Mock the logger to suppress output during tests
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock UUID generation for predictable test results
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// Mock the service container
const mockServiceContainer = {
  get: jest.fn(),
  register: jest.fn(),
  has: jest.fn(),
};

// Setup default mock implementation
const setupMockServiceContainer = () => {
  mockServiceContainer.get.mockImplementation(serviceName => {
    if (serviceName === 'GasPriceAPIService') {
      return {
        getGasPrices: jest.fn().mockResolvedValue({
          network: 'ethereum',
          gasPrices: {
            slow: { gwei: 10, usd_cost: 0.3 },
            standard: { gwei: 15, usd_cost: 0.45 },
            fast: { gwei: 20, usd_cost: 0.6 },
          },
          timestamp: Date.now(),
          source: 'test',
        }),
      };
    }
    // Return a dummy service for any other request to prevent crashes during property testing
    return {};
  });
};

jest.mock('../../src/services/container.js', () => ({
  serviceContainer: mockServiceContainer,
}));

describe('ConversationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockServiceContainer();
  });

  // Helper function to create fresh instances for each test
  const createTestInstances = () => {
    // Create mock LLM interface
    const mockLLM = {
      generateResponse: jest.fn(),
      generateStreamingResponse: jest.fn(),
    };

    // Create real tool registry with test tools
    const registry = new ToolRegistry();

    // Add a test tool for property testing
    registry.registerTool('test_tool', {
      description: 'A test tool for property testing',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
      execute: async ({ input = 'default' }) => {
        return { processed: input, timestamp: Date.now() };
      },
    });

    // Create mock component intent generator
    const intentGenerator = {
      generateIntent: jest.fn(() => null),
    };

    // Create conversation manager
    const manager = new ConversationManager(
      mockLLM,
      registry,
      intentGenerator,
      {
        maxHistoryLength: 10,
        sessionTimeoutMs: 60000,
        cleanupIntervalMs: 30000,
      }
    );

    return { mockLLM, registry, intentGenerator, manager };
  };

  afterEach(() => {
    // Cleanup will be handled per test instance
  });

  describe('Property 11: Tool execution from LLM calls', () => {
    /**
     * Feature: genai-server-integration, Property 11: Tool execution from LLM calls
     * Validates: Requirements 3.3
     */
    test('should execute tools when LLM response contains tool calls and integrate results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }), // User message
          fc.array(
            fc.record({
              id: fc.string({ minLength: 5, maxLength: 20 }),
              name: fc.constant('test_tool'),
              parameters: fc.record({
                input: fc.string({ minLength: 1, maxLength: 100 }),
              }),
            }),
            { minLength: 1, maxLength: 3 }
          ), // Tool calls
          fc.string({ minLength: 1, maxLength: 1000 }), // LLM response content
          async (userMessage, toolCalls, llmContent) => {
            const { mockLLM, manager } = createTestInstances();
            const sessionId =
              'test-session-' + Math.random().toString(36).substr(2, 9);

            try {
              // Mock LLM responses
              // First call returns tool calls
              mockLLM.generateResponse
                .mockResolvedValueOnce({
                  content: llmContent,
                  toolCalls: toolCalls,
                  usage: { total_tokens: 100 },
                })
                // Second call (after tool execution) returns final response
                .mockResolvedValueOnce({
                  content: `Final response incorporating tool results: ${llmContent}`,
                  toolCalls: [],
                  usage: { total_tokens: 150 },
                });

              // Process the message
              const result = await manager.processMessage(
                sessionId,
                userMessage
              );

              // Verify tool execution occurred
              expect(result).toHaveProperty('toolResults');
              expect(result.toolResults).toHaveLength(toolCalls.length);

              // Verify each tool was executed
              for (let i = 0; i < toolCalls.length; i++) {
                const toolCall = toolCalls[i];
                const toolResult = result.toolResults[i];

                if (toolResult.executionTime === undefined) {
                  throw new Error(
                    'Missing executionTime in toolResult: ' +
                      JSON.stringify(toolResult, null, 2)
                  );
                }

                expect(toolResult).toHaveProperty('toolName', toolCall.name);
                expect(toolResult).toHaveProperty(
                  'parameters',
                  toolCall.parameters
                );
                expect(toolResult).toHaveProperty('success', true);
                expect(toolResult).toHaveProperty('result');
                expect(toolResult).toHaveProperty('executionTime');
                expect(typeof toolResult.executionTime).toBe('number');
                expect(toolResult.executionTime).toBeGreaterThanOrEqual(0);
              }

              // Verify LLM was called twice (initial + follow-up with tool results)
              expect(mockLLM.generateResponse).toHaveBeenCalledTimes(2);

              // Verify final response includes tool results integration
              expect(result.content).toContain(
                'Final response incorporating tool results'
              );

              // Verify session contains the conversation history with tool messages
              const session = manager.getSession(sessionId);
              expect(session).toBeDefined();
              expect(session.messages.length).toBeGreaterThan(1);

              // Should have user message, tool call message, tool result messages, and final response
              const messageTypes = session.messages.map(msg => msg.role);
              expect(messageTypes).toContain('user');
              expect(messageTypes).toContain('assistant');
              expect(messageTypes).toContain('tool');
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should handle tool execution errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (userMessage, errorMessage) => {
            const { mockLLM, registry, manager } = createTestInstances();
            const sessionId =
              'test-session-error-' + Math.random().toString(36).substr(2, 9);

            try {
              // Register a tool that always fails
              registry.registerTool('failing_tool', {
                description: 'A tool that always fails',
                parameters: { type: 'object' },
                execute: async () => {
                  throw new Error(errorMessage);
                },
              });

              // Mock LLM response with failing tool call
              mockLLM.generateResponse
                .mockResolvedValueOnce({
                  content: 'I need to use a tool',
                  toolCalls: [
                    {
                      id: 'call_fail_123',
                      name: 'failing_tool',
                      parameters: {},
                    },
                  ],
                  usage: { total_tokens: 100 },
                })
                .mockResolvedValueOnce({
                  content: 'I encountered an error with the tool',
                  toolCalls: [],
                  usage: { total_tokens: 120 },
                });

              const result = await manager.processMessage(
                sessionId,
                userMessage
              );

              // Should handle error gracefully
              expect(result).toHaveProperty('toolResults');
              expect(result.toolResults).toHaveLength(1);
              expect(result.toolResults[0]).toHaveProperty('success', false);
              expect(result.toolResults[0]).toHaveProperty(
                'error',
                errorMessage
              );
              expect(result.toolResults[0]).toHaveProperty('result', null);

              // Should still return a response
              expect(result).toHaveProperty('content');
              expect(typeof result.content).toBe('string');
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should handle messages without tool calls normally', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (userMessage, llmResponse) => {
            const { mockLLM, manager } = createTestInstances();
            const sessionId =
              'test-session-no-tools-' +
              Math.random().toString(36).substr(2, 9);

            try {
              // Mock LLM response without tool calls
              mockLLM.generateResponse.mockResolvedValueOnce({
                content: llmResponse,
                toolCalls: [],
                usage: { total_tokens: 100 },
              });

              const result = await manager.processMessage(
                sessionId,
                userMessage
              );

              // Should not have tool results
              expect(result.toolResults).toBeUndefined();

              // Should have normal response
              expect(result).toHaveProperty('content', llmResponse);
              expect(result).toHaveProperty('role', 'assistant');

              // LLM should only be called once (no follow-up)
              expect(mockLLM.generateResponse).toHaveBeenCalledTimes(1);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should maintain conversation context across tool executions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 200 }), {
            minLength: 2,
            maxLength: 5,
          }),
          async messages => {
            const { mockLLM, manager } = createTestInstances();
            const sessionId =
              'test-session-context-' + Math.random().toString(36).substr(2, 9);

            try {
              // Process multiple messages in sequence
              for (let i = 0; i < messages.length; i++) {
                const message = messages[i];
                const isLastMessage = i === messages.length - 1;

                if (isLastMessage) {
                  // Last message includes tool call
                  mockLLM.generateResponse
                    .mockResolvedValueOnce({
                      content: `Processing message ${i + 1}`,
                      toolCalls: [
                        {
                          id: 'call_test_123',
                          name: 'test_tool',
                          parameters: { input: message },
                        },
                      ],
                      usage: { total_tokens: 100 },
                    })
                    .mockResolvedValueOnce({
                      content: `Final response for message ${i + 1} with tool result`,
                      toolCalls: [],
                      usage: { total_tokens: 150 },
                    });
                } else {
                  // Regular message without tools
                  mockLLM.generateResponse.mockResolvedValueOnce({
                    content: `Response to message ${i + 1}: ${message}`,
                    toolCalls: [],
                    usage: { total_tokens: 80 },
                  });
                }

                await manager.processMessage(sessionId, message);
              }

              // Verify session maintains full conversation history
              const session = manager.getSession(sessionId);
              expect(session).toBeDefined();
              expect(session.messages.length).toBeGreaterThan(messages.length);

              // Should contain all user messages (accounting for potential duplicates being filtered)
              const userMessages = session.messages.filter(
                msg => msg.role === 'user'
              );
              expect(userMessages.length).toBeGreaterThanOrEqual(1);
              expect(userMessages.length).toBeLessThanOrEqual(messages.length);

              // Should contain assistant responses
              const assistantMessages = session.messages.filter(
                msg => msg.role === 'assistant'
              );
              expect(assistantMessages.length).toBeGreaterThan(0);

              // Last interaction should include tool messages
              const toolMessages = session.messages.filter(
                msg => msg.role === 'tool'
              );
              expect(toolMessages.length).toBeGreaterThan(0);
            } finally {
              manager.destroy();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Tool Integration Context', () => {
    test('should include tool calls and results in LLM message preparation', async () => {
      const { manager } = createTestInstances();
      const sessionId = 'test-session-context';

      try {
        // Create a session with tool interaction history
        const session = manager.createSession(sessionId);

        // Add messages with tool calls and results
        manager.addMessageToSession(session, {
          id: 'msg-1',
          role: 'user',
          content: 'Get gas prices',
          timestamp: Date.now(),
        });

        manager.addMessageToSession(session, {
          id: 'msg-2',
          role: 'assistant',
          content: "I'll get the gas prices for you",
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'get_gas_prices', // Should match tool_call_id in tool message
              name: 'get_gas_prices',
              parameters: { network: 'ethereum' },
            },
          ],
        });

        manager.addMessageToSession(session, {
          id: 'msg-3',
          role: 'tool',
          content: JSON.stringify({ prices: { fast: '20 gwei' } }),
          timestamp: Date.now(),
          tool_call_id: 'get_gas_prices',
          name: 'get_gas_prices',
        });

        // Prepare messages for LLM
        const messages = manager.prepareMessagesForLLM(session);

        // Should include tool context
        expect(messages).toHaveLength(3);
        expect(messages[1]).toHaveProperty('tool_calls');
        expect(messages[2]).toHaveProperty('role', 'tool');
      } finally {
        manager.destroy();
      }
    });
  });
});
