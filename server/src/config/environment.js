import Joi from 'joi';
import { logger } from '../utils/logger.js';

const configSchema = Joi.object({
  port: Joi.number().port().default(3001),
  host: Joi.string().default('localhost'),
  nodeEnv: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),

  llm: Joi.object({
    provider: Joi.string().valid('openai', 'anthropic').required(),
    apiKey: Joi.string().required(),
    model: Joi.string().required(),
    maxTokens: Joi.number().positive().default(2048),
    temperature: Joi.number().min(0).max(2).default(0.7),
  }).required(),

  websocket: Joi.object({
    pingInterval: Joi.number().positive().default(30000),
    maxConnections: Joi.number().positive().default(100),
    messageQueueSize: Joi.number().positive().default(1000),
  }).default(),

  logging: Joi.object({
    level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    format: Joi.string().valid('json', 'text').default('json'),
  }).default(),

  tools: Joi.object({
    enabled: Joi.array().items(Joi.string()).default(['gas_price']),
    rateLimit: Joi.number().positive().default(10),
  }).default(),

  apiKeys: Joi.object({
    etherscan: Joi.string().optional(),
    alchemy: Joi.string().optional(),
  }).default(),

  corsOrigin: Joi.string().default('http://localhost:3000'),
  apiTimeout: Joi.number().positive().default(30000),
});

export function validateConfig() {
  const rawConfig = {
    port: process.env.PORT !== undefined ? parseInt(process.env.PORT) : 3001,
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',

    llm: {
      provider: process.env.LLM_PROVIDER || 'openai',
      apiKey:
        process.env.LLM_PROVIDER === 'anthropic'
          ? process.env.ANTHROPIC_API_KEY
          : process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4',
      maxTokens:
        process.env.LLM_MAX_TOKENS !== undefined
          ? parseInt(process.env.LLM_MAX_TOKENS)
          : 2048,
      temperature:
        process.env.LLM_TEMPERATURE !== undefined
          ? parseFloat(process.env.LLM_TEMPERATURE)
          : 0.7,
    },

    websocket: {
      pingInterval:
        process.env.WS_PING_INTERVAL !== undefined
          ? parseInt(process.env.WS_PING_INTERVAL)
          : 30000,
      maxConnections:
        process.env.WS_MAX_CONNECTIONS !== undefined
          ? parseInt(process.env.WS_MAX_CONNECTIONS)
          : 100,
      messageQueueSize:
        process.env.WS_MESSAGE_QUEUE_SIZE !== undefined
          ? parseInt(process.env.WS_MESSAGE_QUEUE_SIZE)
          : 1000,
    },

    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
    },

    tools: {
      enabled: process.env.TOOLS_ENABLED
        ? process.env.TOOLS_ENABLED.split(',')
        : ['gas_price'],
      rateLimit:
        process.env.TOOLS_RATE_LIMIT !== undefined
          ? parseInt(process.env.TOOLS_RATE_LIMIT)
          : 10,
    },

    apiKeys: {
      etherscan: process.env.ETHERSCAN_API_KEY,
      alchemy: process.env.ALCHEMY_API_KEY,
    },

    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    apiTimeout:
      process.env.API_TIMEOUT !== undefined
        ? parseInt(process.env.API_TIMEOUT)
        : 30000,
  };

  const { error, value } = configSchema.validate(rawConfig, {
    abortEarly: false,
    allowUnknown: false,
  });

  if (error) {
    const errorMessage = `Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  logger.info('Configuration validated successfully', {
    port: value.port,
    host: value.host,
    environment: value.nodeEnv,
    llmProvider: value.llm.provider,
  });

  return value;
}
