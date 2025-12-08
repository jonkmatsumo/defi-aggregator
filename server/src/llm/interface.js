import { logger } from '../utils/logger.js';
import { LLMError } from '../utils/errors.js';

export class LLMInterface {
  constructor(config) {
    this.config = config;
  }

  async generateResponse(messages, _tools = [], _options = {}) {
    throw new Error('generateResponse must be implemented by subclass');
  }

  async generateStreamingResponse(messages, _tools = [], onChunk, _options = {}) {
    throw new Error('generateStreamingResponse must be implemented by subclass');
  }
}

export class OpenAILLM extends LLMInterface {
  constructor(config) {
    super(config);
    // OpenAI implementation will be added in later tasks
    logger.info('OpenAI LLM interface initialized', { model: config.model });
  }

  async generateResponse(messages, _tools = [], _options = {}) {
    // Placeholder implementation
    logger.info('OpenAI generateResponse called', { messageCount: messages.length });
    return {
      content: 'OpenAI placeholder response',
      toolCalls: []
    };
  }
}

export class AnthropicLLM extends LLMInterface {
  constructor(config) {
    super(config);
    // Anthropic implementation will be added in later tasks
    logger.info('Anthropic LLM interface initialized', { model: config.model });
  }

  async generateResponse(messages, _tools = [], _options = {}) {
    // Placeholder implementation
    logger.info('Anthropic generateResponse called', { messageCount: messages.length });
    return {
      content: 'Anthropic placeholder response',
      toolCalls: []
    };
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