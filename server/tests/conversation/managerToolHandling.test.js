import { ConversationManager } from '../../src/conversation/manager.js';
import { jest } from '@jest/globals';

// Mock dependencie
const mockLLMInterface = {
  generateResponse: jest.fn()
};

const mockToolRegistry = {
  getToolDefinitions: jest.fn().mockReturnValue([]),
  executeTool: jest.fn()
};

const mockConfig = {
  maxHistoryLength: 10
};

describe('ConversationManager Integration', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ConversationManager(mockLLMInterface, mockToolRegistry, { generateIntent: jest.fn() }, mockConfig);
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  it('should correctly handle tool calls and preserve tool_call_id', async () => {
    const sessionId = 'test-session';
    const userMessage = 'What is the price of ETH?';

    // 1. First LLM response returns a tool call
    const toolCallId = 'call_12345';
    const toolName = 'get_crypto_price';
    const toolArgs = { symbol: 'ETH' };

    mockLLMInterface.generateResponse
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{
          id: toolCallId,
          type: 'function',
          function: {
            name: toolName,
            arguments: JSON.stringify(toolArgs)
          }
        }]
      })
    // 2. Second LLM response (final answer)
      .mockResolvedValueOnce({
        content: 'The price of ETH is $2000.',
        toolCalls: []
      });

    mockToolRegistry.executeTool.mockResolvedValue({
      success: true,
      result: { price: 2000 },
      executionTime: 10
    });

    await manager.processMessage(sessionId, userMessage);

    // Verify tool execution
    expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(toolName, toolArgs);

    // Verify follow-up LLM call structure
    expect(mockLLMInterface.generateResponse).toHaveBeenCalledTimes(2);

    const secondCallArgs = mockLLMInterface.generateResponse.mock.calls[1];
    const messages = secondCallArgs[0];

    // Find the tool response message
    const toolMessage = messages.find(m => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    expect(toolMessage.tool_call_id).toBe(toolCallId); // CRITICAL CHECK
    expect(toolMessage.content).toBe(JSON.stringify({ price: 2000 }));

    // Verify assistant message with tool calls is present and has correct format
    const assistantMessage = messages.find(m => m.role === 'assistant' && m.tool_calls);
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage.tool_calls[0].id).toBe(toolCallId);
  });

  it('should skip invalid tool calls', async () => {
    const sessionId = 'test-session-invalid';

    mockLLMInterface.generateResponse.mockResolvedValueOnce({
      content: null,
      toolCalls: [{
        // Missing ID and Name
        function: {}
      }]
    });

    await manager.processMessage(sessionId, 'invalid tool');

    expect(mockToolRegistry.executeTool).not.toHaveBeenCalled();
    // Should not crash, just ignore
  });
});
