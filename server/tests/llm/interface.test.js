import { jest } from '@jest/globals';
import fc from 'fast-check';
import { LLMInterface, createLLMInterface } from '../../src/llm/interface.js';
import { LLMError } from '../../src/utils/errors.js';

// Mock the external dependencies
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create a test implementation of LLMInterface for property testing
class TestLLM extends LLMInterface {
  constructor(config) {
    super(config);
    this.mockResponses = [];
    this.mockErrors = [];
    this.callCount = 0;
  }

  setMockResponse(response) {
    this.mockResponses.push(response);
  }

  setMockError(error) {
    this.mockErrors.push(error);
  }

  async generateResponse(messages, tools = [], _options = {}) {
    const context = { messageCount: messages.length, toolCount: tools.length };

    return this._retryWithBackoff(async () => {
      this.callCount++;

      if (this.mockErrors.length > 0) {
        const error = this.mockErrors.shift();
        throw error;
      }

      if (this.mockResponses.length > 0) {
        const response = this.mockResponses.shift();
        return {
          content: response.content || 'Test response',
          toolCalls: response.toolCalls || [],
          usage: response.usage || { total_tokens: 100 },
        };
      }

      return {
        content: `Response to ${messages.length} messages with ${tools.length} tools`,
        toolCalls: [],
        usage: { total_tokens: 100 },
      };
    }, context);
  }

  async generateStreamingResponse(
    messages,
    tools = [],
    onChunk,
    _options = {}
  ) {
    const context = {
      messageCount: messages.length,
      toolCount: tools.length,
      streaming: true,
    };

    return this._retryWithBackoff(async () => {
      this.callCount++;

      if (this.mockErrors.length > 0) {
        const error = this.mockErrors.shift();
        onChunk({
          type: 'error',
          error: error.message,
          done: true,
        });
        throw error;
      }

      const content = `Streaming response to ${messages.length} messages`;
      const chunks = content.split(' ');

      // Send content chunks
      for (const chunk of chunks) {
        onChunk({
          type: 'content',
          content: chunk + ' ',
          done: false,
        });
      }

      // Send completion
      onChunk({
        type: 'done',
        content,
        toolCalls: [],
        done: true,
      });

      return {
        content,
        toolCalls: [],
        streaming: true,
      };
    }, context);
  }
}

describe('LLM Interface', () => {
  describe('LLMInterface Base Class', () => {
    test('should throw error for unimplemented generateResponse', async () => {
      const llm = new LLMInterface({ provider: 'test' });
      await expect(llm.generateResponse([])).rejects.toThrow(
        'generateResponse must be implemented by subclass'
      );
    });

    test('should throw error for unimplemented generateStreamingResponse', async () => {
      const llm = new LLMInterface({ provider: 'test' });
      const mockOnChunk = jest.fn();
      await expect(
        llm.generateStreamingResponse([], [], mockOnChunk)
      ).rejects.toThrow(
        'generateStreamingResponse must be implemented by subclass'
      );
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 9: Message forwarding to LLM
     * Validates: Requirements 3.1
     */
    test('Property 9: Message forwarding to LLM', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system'),
              content: fc.string({ minLength: 1, maxLength: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async messages => {
            const llm = new TestLLM({ provider: 'test' });

            const result = await llm.generateResponse(messages);

            // Verify the message was processed by the LLM
            expect(result).toHaveProperty('content');
            expect(result.content).toContain(`${messages.length} messages`);
            expect(llm.callCount).toBe(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 10: LLM response processing
     * Validates: Requirements 3.2
     */
    test('Property 10: LLM response processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 2000 }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              name: fc.string({ minLength: 1 }),
              arguments: fc.string(),
            }),
            { maxLength: 5 }
          ),
          async (responseContent, toolCalls) => {
            const llm = new TestLLM({ provider: 'test' });

            // Set up mock response
            llm.setMockResponse({
              content: responseContent,
              toolCalls: toolCalls,
              usage: { total_tokens: 100 },
            });

            const result = await llm.generateResponse([
              { role: 'user', content: 'test' },
            ]);

            // Verify response is processed correctly
            expect(result).toHaveProperty('content');
            expect(result.content).toBe(responseContent);
            expect(result).toHaveProperty('toolCalls');
            expect(result.toolCalls).toEqual(toolCalls);
            expect(result).toHaveProperty('usage');
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 13: LLM API error handling
     * Validates: Requirements 3.5
     */
    test('Property 13: LLM API error handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(500, 502, 503, 504), // Server errors that should be retried
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorStatus, errorMessage) => {
            const llm = new TestLLM({
              provider: 'test',
              maxRetries: 1, // Reduce retries for faster tests
            });

            // Mock API error
            const apiError = new Error(errorMessage);
            apiError.status = errorStatus;
            llm.setMockError(apiError);
            llm.setMockError(apiError); // Set error for retry as well

            // Should handle error gracefully and throw error
            await expect(
              llm.generateResponse([{ role: 'user', content: 'test' }])
            ).rejects.toThrow(errorMessage);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 29: LLM API retry with exponential backoff
     * Validates: Requirements 8.2
     */
    test('Property 29: LLM API retry with exponential backoff', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 3 }), // Need at least 2 retries for this test
          async maxRetries => {
            const llm = new TestLLM({
              provider: 'test',
              maxRetries,
              retryDelay: 1, // Very short delay for tests
            });

            // Mock temporary failure followed by success
            const tempError = new Error('Temporary failure');
            tempError.status = 500;
            llm.setMockError(tempError); // First call fails
            llm.setMockResponse({ content: 'Success' }); // Second call succeeds

            const result = await llm.generateResponse([
              { role: 'user', content: 'test' },
            ]);

            // Should succeed after retry
            expect(result).toHaveProperty('content', 'Success');

            // Should have been called twice (initial + 1 retry)
            expect(llm.callCount).toBe(2);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 33: Streaming response forwarding
     * Validates: Requirements 9.1
     */
    test('Property 33: Streaming response forwarding', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
            minLength: 1,
            maxLength: 10,
          }),
          async _contentChunks => {
            const llm = new TestLLM({ provider: 'test' });
            const receivedChunks = [];
            const onChunk = jest.fn(chunk => {
              receivedChunks.push(chunk);
            });

            await llm.generateStreamingResponse(
              [{ role: 'user', content: 'test' }],
              [],
              onChunk
            );

            // Should forward content chunks
            const contentChunksReceived = receivedChunks.filter(
              chunk => chunk.type === 'content'
            );
            expect(contentChunksReceived.length).toBeGreaterThan(0);

            // Should receive completion signal
            const doneChunks = receivedChunks.filter(
              chunk => chunk.done === true
            );
            expect(doneChunks).toHaveLength(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 34: Streaming completion signaling
     * Validates: Requirements 9.3
     */
    test('Property 34: Streaming completion signaling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }),
          async _fullContent => {
            const llm = new TestLLM({ provider: 'test' });
            const receivedChunks = [];
            const onChunk = jest.fn(chunk => {
              receivedChunks.push(chunk);
            });

            await llm.generateStreamingResponse(
              [{ role: 'user', content: 'test' }],
              [],
              onChunk
            );

            // Should send completion signal
            const completionChunks = receivedChunks.filter(
              chunk => chunk.type === 'done' && chunk.done === true
            );
            expect(completionChunks).toHaveLength(1);
            expect(completionChunks[0]).toHaveProperty('content');
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 35: Streaming error handling
     * Validates: Requirements 9.4
     */
    test('Property 35: Streaming error handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async errorMessage => {
            const llm = new TestLLM({
              provider: 'test',
              maxRetries: 1,
            });
            const receivedChunks = [];
            const onChunk = jest.fn(chunk => {
              receivedChunks.push(chunk);
            });

            // Mock streaming error
            const streamError = new Error(errorMessage);
            llm.setMockError(streamError);
            llm.setMockError(streamError); // For retry

            await expect(
              llm.generateStreamingResponse(
                [{ role: 'user', content: 'test' }],
                [],
                onChunk
              )
            ).rejects.toThrow();

            // Should send error chunk to client
            const errorChunks = receivedChunks.filter(
              chunk => chunk.type === 'error'
            );
            expect(errorChunks.length).toBeGreaterThan(0);
            expect(errorChunks[0].error).toBe(errorMessage);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 36: Streaming backward compatibility
     * Validates: Requirements 9.5
     */
    test('Property 36: Streaming backward compatibility', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }),
          async content => {
            const llm = new TestLLM({ provider: 'test' });

            // Set up mock response for non-streaming
            llm.setMockResponse({ content });

            // Non-streaming call should work
            const result = await llm.generateResponse([
              { role: 'user', content: 'test' },
            ]);
            expect(result.content).toBe(content);
            expect(result.streaming).toBeUndefined(); // Not marked as streaming

            // Streaming call should also work with same interface
            const onChunk = jest.fn();

            const streamResult = await llm.generateStreamingResponse(
              [{ role: 'user', content: 'test' }],
              [],
              onChunk
            );
            expect(streamResult).toHaveProperty('content');
            expect(streamResult.streaming).toBe(true); // Marked as streaming
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('createLLMInterface', () => {
    test('should throw error for unsupported provider', () => {
      const config = { provider: 'unsupported', apiKey: 'test-key' };
      expect(() => createLLMInterface(config)).toThrow(LLMError);
    });
  });
});
