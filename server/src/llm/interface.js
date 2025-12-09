import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger, logError } from '../utils/logger.js';
import { LLMError, CircuitBreaker, classifyError } from '../utils/errors.js';

export class LLMInterface {
  constructor(config) {
    this.config = {
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      maxSystemPromptLength: 16000,
      ...config
    };

    // Initialize circuit breaker for error recovery
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000 // 10 seconds
    });

    // Simple in-memory cache for system prompts to avoid re-allocation
    this.systemPromptCache = new Map(); // prompt string -> { role, content }
  }

  async generateResponse(messages, _tools = [], _options = {}) {
    throw new Error('generateResponse must be implemented by subclass');
  }

  async generateStreamingResponse(messages, _tools = [], onChunk, _options = {}) {
    throw new Error('generateStreamingResponse must be implemented by subclass');
  }

  // Exponential backoff retry logic with circuit breaker
  async _retryWithBackoff(operation, context = {}) {
    return this.circuitBreaker.execute(async () => {
      let lastError;

      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          logger.debug('LLM API attempt', { attempt: attempt + 1, ...context });
          return await operation();
        } catch (error) {
          lastError = error;

          // Log error with classification
          const errorClassification = classifyError(error);
          logError(error, {
            ...context,
            attempt: attempt + 1,
            classification: errorClassification
          });

          // Don't retry on authentication or invalid request errors
          if (this._isNonRetryableError(error)) {
            logger.error('Non-retryable LLM error', { error: error.message, ...context });
            throw new LLMError(`LLM API error: ${error.message}`, this.config.provider);
          }

          if (attempt < this.config.maxRetries - 1) {
            const delay = this.config.retryDelay * Math.pow(2, attempt);
            logger.warn('LLM API retry', {
              attempt: attempt + 1,
              delay,
              error: error.message,
              ...context
            });
            await this._sleep(delay);
          }
        }
      }

      logger.error('LLM API max retries exceeded', {
        maxRetries: this.config.maxRetries,
        error: lastError.message,
        ...context
      });
      throw new LLMError(`LLM API failed after ${this.config.maxRetries} attempts: ${lastError.message}`, this.config.provider);
    });
  }

  _isNonRetryableError(error) {
    // Don't retry on authentication, invalid request, or quota errors
    return error.status === 401 || error.status === 400 || error.status === 403 || error.status === 429;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validateSystemPrompt(systemPrompt) {
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      throw new LLMError('System prompt must be a non-empty string', this.config.provider);
    }

    if (systemPrompt.length > this.config.maxSystemPromptLength) {
      const error = new LLMError(
        `System prompt exceeds max length (${systemPrompt.length} > ${this.config.maxSystemPromptLength})`,
        this.config.provider
      );
      error.code = 'SYSTEM_PROMPT_TOO_LARGE';
      throw error;
    }
  }

  getCachedSystemPrompt(systemPrompt) {
    if (!systemPrompt) return null;
    const cached = this.systemPromptCache.get(systemPrompt);
    if (cached) return cached;
    const entry = { role: 'system', content: systemPrompt };
    // Keep cache from growing unbounded; simple cap of 20 prompts
    if (this.systemPromptCache.size >= 20) {
      const oldestKey = this.systemPromptCache.keys().next().value;
      this.systemPromptCache.delete(oldestKey);
    }
    this.systemPromptCache.set(systemPrompt, entry);
    return entry;
  }

  _formatMessages(messages) {
    return messages.map(msg => {
      const formatted = {
        role: msg.role,
        content: msg.content
      };

      if (msg.tool_calls) {
        formatted.tool_calls = msg.tool_calls;
      }

      if (msg.tool_call_id) {
        formatted.tool_call_id = msg.tool_call_id;
      }

      // OpenAI requires content to be null (not undefined) if it's empty but tools are present
      if (!formatted.content && formatted.tool_calls) {
        formatted.content = null;
      }

      return formatted;
    });
  }

  _formatTools(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }
}

export class OpenAILLM extends LLMInterface {
  constructor(config) {
    super(config);

    if (!config.apiKey) {
      throw new LLMError('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: this.config.timeout
    });

    this.model = config.model || 'gpt-4';
    logger.info('OpenAI LLM interface initialized', { model: this.model });
  }

  async generateResponse(messages, tools = [], options = {}) {
    const context = { messageCount: messages.length, toolCount: tools.length };

    return this._retryWithBackoff(async () => {
      // Prepare messages with system prompt if provided
      let formattedMessages = this._formatMessages(messages);
      if (options.systemPrompt) {
        this.validateSystemPrompt(options.systemPrompt);
        const cachedPrompt = this.getCachedSystemPrompt(options.systemPrompt);
        formattedMessages = [
          cachedPrompt,
          ...formattedMessages
        ];
        context.systemPromptLength = options.systemPrompt.length;
      }

      const requestParams = {
        model: this.model,
        messages: formattedMessages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature
      };

      if (tools.length > 0) {
        requestParams.tools = this._formatTools(tools);
        requestParams.tool_choice = 'auto';
      }

      logger.debug('OpenAI API request', { ...context, model: this.model });

      const response = await this.client.chat.completions.create(requestParams);

      const result = {
        content: response.choices[0].message.content || '',
        toolCalls: response.choices[0].message.tool_calls || [],
        usage: response.usage
      };

      logger.info('OpenAI response generated', {
        ...context,
        responseLength: result.content.length,
        toolCallCount: result.toolCalls.length,
        usage: result.usage
      });

      return result;
    }, context);
  }

  async generateStreamingResponse(messages, tools = [], onChunk, options = {}) {
    const context = { messageCount: messages.length, toolCount: tools.length, streaming: true };

    return this._retryWithBackoff(async () => {
      // Prepare messages with system prompt if provided
      let formattedMessages = this._formatMessages(messages);
      if (options.systemPrompt) {
        this.validateSystemPrompt(options.systemPrompt);
        const cachedPrompt = this.getCachedSystemPrompt(options.systemPrompt);
        formattedMessages = [
          cachedPrompt,
          ...formattedMessages
        ];
        context.systemPromptLength = options.systemPrompt.length;
      }

      const requestParams = {
        model: this.model,
        messages: formattedMessages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        stream: true
      };

      if (tools.length > 0) {
        requestParams.tools = this._formatTools(tools);
        requestParams.tool_choice = 'auto';
      }

      logger.debug('OpenAI streaming request', { ...context, model: this.model });

      const stream = await this.client.chat.completions.create(requestParams);

      let fullContent = '';
      const toolCalls = [];

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            fullContent += delta.content;
            onChunk({
              type: 'content',
              content: delta.content,
              done: false
            });
          }

          if (delta?.tool_calls) {
            toolCalls.push(...delta.tool_calls);
          }

          // Check if stream is done
          if (chunk.choices[0]?.finish_reason) {
            onChunk({
              type: 'done',
              content: fullContent,
              toolCalls,
              done: true
            });
            break;
          }
        }

        logger.info('OpenAI streaming completed', {
          ...context,
          responseLength: fullContent.length,
          toolCallCount: toolCalls.length
        });

        return {
          content: fullContent,
          toolCalls,
          streaming: true
        };

      } catch (streamError) {
        logger.error('OpenAI streaming error', {
          ...context,
          error: streamError.message
        });

        // Send error to client
        onChunk({
          type: 'error',
          error: streamError.message,
          done: true
        });

        throw streamError;
      }
    }, context);
  }
}

export class AnthropicLLM extends LLMInterface {
  constructor(config) {
    super(config);

    if (!config.apiKey) {
      throw new LLMError('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: this.config.timeout
    });

    this.model = config.model || 'claude-3-sonnet-20240229';
    logger.info('Anthropic LLM interface initialized', { model: this.model });
  }

  async generateResponse(messages, tools = [], options = {}) {
    const context = { messageCount: messages.length, toolCount: tools.length };

    return this._retryWithBackoff(async () => {
      // Convert messages to Anthropic format
      const anthropicMessages = this._formatAnthropicMessages(messages);

      const requestParams = {
        model: this.model,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature
      };

      // Add system prompt if provided (Anthropic uses separate system parameter)
      if (options.systemPrompt) {
        this.validateSystemPrompt(options.systemPrompt);
        requestParams.system = options.systemPrompt;
        context.systemPromptLength = options.systemPrompt.length;
      }

      if (tools.length > 0) {
        requestParams.tools = this._formatAnthropicTools(tools);
      }

      logger.debug('Anthropic API request', { ...context, model: this.model });

      const response = await this.client.messages.create(requestParams);

      const result = {
        content: response.content[0]?.text || '',
        toolCalls: response.content.filter(c => c.type === 'tool_use') || [],
        usage: response.usage
      };

      logger.info('Anthropic response generated', {
        ...context,
        responseLength: result.content.length,
        toolCallCount: result.toolCalls.length,
        usage: result.usage
      });

      return result;
    }, context);
  }

  async generateStreamingResponse(messages, tools = [], onChunk, options = {}) {
    const context = { messageCount: messages.length, toolCount: tools.length, streaming: true };

    return this._retryWithBackoff(async () => {
      const anthropicMessages = this._formatAnthropicMessages(messages);

      const requestParams = {
        model: this.model,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        stream: true
      };

      // Add system prompt if provided (Anthropic uses separate system parameter)
      if (options.systemPrompt) {
        this.validateSystemPrompt(options.systemPrompt);
        requestParams.system = options.systemPrompt;
        context.systemPromptLength = options.systemPrompt.length;
      }

      if (tools.length > 0) {
        requestParams.tools = this._formatAnthropicTools(tools);
      }

      logger.debug('Anthropic streaming request', { ...context, model: this.model });

      const stream = await this.client.messages.create(requestParams);

      let fullContent = '';
      const toolCalls = [];

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            fullContent += chunk.delta.text;
            onChunk({
              type: 'content',
              content: chunk.delta.text,
              done: false
            });
          }

          if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
            toolCalls.push(chunk.content_block);
          }

          if (chunk.type === 'message_stop') {
            onChunk({
              type: 'done',
              content: fullContent,
              toolCalls,
              done: true
            });
            break;
          }
        }

        logger.info('Anthropic streaming completed', {
          ...context,
          responseLength: fullContent.length,
          toolCallCount: toolCalls.length
        });

        return {
          content: fullContent,
          toolCalls,
          streaming: true
        };

      } catch (streamError) {
        logger.error('Anthropic streaming error', {
          ...context,
          error: streamError.message
        });

        onChunk({
          type: 'error',
          error: streamError.message,
          done: true
        });

        throw streamError;
      }
    }, context);
  }

  _formatAnthropicMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  _formatAnthropicTools(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }
}

export function createLLMInterface(config) {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLM(config);
    case 'anthropic':
      return new AnthropicLLM(config);
    default:
      throw new LLMError(`Unsupported LLM provider: ${config.provider}`);
  }
}