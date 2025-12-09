import { jest } from '@jest/globals';
import fc from 'fast-check';

describe('Configuration Management', () => {
  let originalEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  /**
   * **Feature: genai-server-integration, Property 37: Environment variable configuration**
   * For any configurable server option, it should be settable via environment variables and the server should use the provided values correctly.
   * **Validates: Requirements 10.1**
   */
  test('Property 37: Environment variable configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid environment variable configurations
        fc.record({
          PORT: fc.integer({ min: 1024, max: 65535 }).map(String),
          HOST: fc.constantFrom('localhost', '127.0.0.1', '0.0.0.0'),
          NODE_ENV: fc.constantFrom('development', 'staging', 'production', 'test'),
          LLM_PROVIDER: fc.constantFrom('openai', 'anthropic'),
          LLM_MODEL: fc.constantFrom('gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet', 'claude-3-haiku'),
          LLM_MAX_TOKENS: fc.integer({ min: 100, max: 4096 }).map(String),
          LLM_TEMPERATURE: fc.float({ min: 0, max: 2, noNaN: true }).map(String),
          WS_PING_INTERVAL: fc.integer({ min: 5000, max: 60000 }).map(String),
          WS_MAX_CONNECTIONS: fc.integer({ min: 10, max: 1000 }).map(String),
          WS_MESSAGE_QUEUE_SIZE: fc.integer({ min: 100, max: 10000 }).map(String),
          LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
          LOG_FORMAT: fc.constantFrom('json', 'text'),
          TOOLS_ENABLED: fc.array(fc.constantFrom('gas_price', 'token_balance', 'lending'), { minLength: 1, maxLength: 3 }).map(arr => arr.join(',')),
          TOOLS_RATE_LIMIT: fc.integer({ min: 1, max: 100 }).map(String),
          CORS_ORIGIN: fc.constantFrom('http://localhost:3000', 'https://example.com', '*'),
          API_TIMEOUT: fc.integer({ min: 5000, max: 120000 }).map(String)
        }),
        async (envVars) => {
          // Set environment variables
          Object.assign(process.env, envVars);

          // Always set required API keys for testing
          process.env.OPENAI_API_KEY = 'test_openai_key';
          process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';

          // Import validateConfig fresh to pick up new env vars
          const { validateConfig } = await import('../../src/config/environment.js?' + Date.now());

          // Validate configuration
          const config = validateConfig();

          // Verify that environment variables are correctly loaded
          expect(config.port).toBe(parseInt(envVars.PORT));
          expect(config.host).toBe(envVars.HOST);
          expect(config.nodeEnv).toBe(envVars.NODE_ENV);
          expect(config.llm.provider).toBe(envVars.LLM_PROVIDER);
          expect(config.llm.model).toBe(envVars.LLM_MODEL);
          expect(config.llm.maxTokens).toBe(parseInt(envVars.LLM_MAX_TOKENS));
          expect(config.llm.temperature).toBe(parseFloat(envVars.LLM_TEMPERATURE));
          expect(config.websocket.pingInterval).toBe(parseInt(envVars.WS_PING_INTERVAL));
          expect(config.websocket.maxConnections).toBe(parseInt(envVars.WS_MAX_CONNECTIONS));
          expect(config.websocket.messageQueueSize).toBe(parseInt(envVars.WS_MESSAGE_QUEUE_SIZE));
          expect(config.logging.level).toBe(envVars.LOG_LEVEL);
          expect(config.logging.format).toBe(envVars.LOG_FORMAT);
          expect(config.tools.enabled).toEqual(envVars.TOOLS_ENABLED.split(','));
          expect(config.tools.rateLimit).toBe(parseInt(envVars.TOOLS_RATE_LIMIT));
          expect(config.corsOrigin).toBe(envVars.CORS_ORIGIN);
          expect(config.apiTimeout).toBe(parseInt(envVars.API_TIMEOUT));

          // Verify API key is set correctly based on provider
          const expectedApiKey = envVars.LLM_PROVIDER === 'anthropic' ? 'test_anthropic_key' : 'test_openai_key';
          expect(config.llm.apiKey).toBe(expectedApiKey);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: genai-server-integration, Property 38: Environment-specific configuration**
   * For any deployment environment (development, staging, production), the server should load the appropriate configuration for that environment.
   * **Validates: Requirements 10.2**
   */
  test('Property 38: Environment-specific configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different environment configurations
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production', 'test'),
          // Environment-specific overrides
          logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
          corsOrigin: fc.constantFrom('http://localhost:3000', 'https://staging.example.com', 'https://example.com'),
          apiTimeout: fc.integer({ min: 5000, max: 120000 })
        }),
        async ({ environment, logLevel, corsOrigin, apiTimeout }) => {
          // Set environment-specific variables
          process.env.NODE_ENV = environment;
          process.env.LOG_LEVEL = logLevel;
          process.env.CORS_ORIGIN = corsOrigin;
          process.env.API_TIMEOUT = apiTimeout.toString();

          // Set required variables
          process.env.LLM_PROVIDER = 'openai';
          process.env.OPENAI_API_KEY = 'test_key';
          process.env.PORT = '3001';

          // Import validateConfig fresh to pick up new env vars
          const { validateConfig } = await import('../../src/config/environment.js?' + Date.now());

          // Validate configuration
          const config = validateConfig();

          // Verify environment-specific configuration is loaded correctly
          expect(config.nodeEnv).toBe(environment);
          expect(config.logging.level).toBe(logLevel);
          expect(config.corsOrigin).toBe(corsOrigin);
          expect(config.apiTimeout).toBe(apiTimeout);

          // Verify environment-appropriate defaults are applied
          expect(config.nodeEnv).toBe(environment);
          expect(['debug', 'info', 'warn', 'error']).toContain(config.logging.level);

          // All environments should have valid configuration
          expect(['development', 'staging', 'production', 'test']).toContain(environment);

          // All environments should have valid configuration
          expect(config.port).toBeGreaterThan(0);
          expect(config.llm.provider).toBeDefined();
          expect(config.llm.apiKey).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: genai-server-integration, Property 39: Configuration validation**
   * For any invalid configuration value, the server should validate the configuration at startup and fail with a descriptive error message.
   * **Validates: Requirements 10.4**
   */
  test('Property 39: Configuration validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid configuration scenarios
        fc.oneof(
          // Invalid port configurations
          fc.record({
            type: fc.constant('invalid_port'),
            PORT: fc.oneof(
              fc.constant('-1'),
              fc.constant('0'),
              fc.constant('99999'),
              fc.constant('not_a_number')
            )
          }),
          // Invalid LLM provider
          fc.record({
            type: fc.constant('invalid_llm_provider'),
            LLM_PROVIDER: fc.constantFrom('invalid_provider', 'gpt', 'claude')
          }),
          // Missing API key
          fc.record({
            type: fc.constant('missing_api_key'),
            LLM_PROVIDER: fc.constantFrom('openai', 'anthropic'),
            removeApiKey: fc.constant(true)
          }),
          // Invalid log level
          fc.record({
            type: fc.constant('invalid_log_level'),
            LOG_LEVEL: fc.constantFrom('invalid', 'trace', 'verbose')
          }),
          // Invalid temperature
          fc.record({
            type: fc.constant('invalid_temperature'),
            LLM_TEMPERATURE: fc.oneof(
              fc.constant('-1'),
              fc.constant('3'),
              fc.constant('not_a_number')
            )
          }),
          // Invalid WebSocket configuration
          fc.record({
            type: fc.constant('invalid_websocket'),
            WS_MAX_CONNECTIONS: fc.oneof(
              fc.constant('0'),
              fc.constant('-1'),
              fc.constant('not_a_number')
            )
          })
        ),
        async (invalidConfig) => {
          // Set base valid configuration
          process.env.PORT = '3001';
          process.env.HOST = 'localhost';
          process.env.NODE_ENV = 'test';
          process.env.LLM_PROVIDER = 'openai';
          process.env.OPENAI_API_KEY = 'test_key';
          process.env.ANTHROPIC_API_KEY = 'test_key';

          // Apply invalid configuration based on type
          switch (invalidConfig.type) {
            case 'invalid_port':
              process.env.PORT = invalidConfig.PORT;
              break;
            case 'invalid_llm_provider':
              process.env.LLM_PROVIDER = invalidConfig.LLM_PROVIDER;
              break;
            case 'missing_api_key':
              if (invalidConfig.LLM_PROVIDER === 'openai') {
                delete process.env.OPENAI_API_KEY;
              } else {
                delete process.env.ANTHROPIC_API_KEY;
              }
              process.env.LLM_PROVIDER = invalidConfig.LLM_PROVIDER;
              break;
            case 'invalid_log_level':
              process.env.LOG_LEVEL = invalidConfig.LOG_LEVEL;
              break;
            case 'invalid_temperature':
              process.env.LLM_TEMPERATURE = invalidConfig.LLM_TEMPERATURE;
              break;
            case 'invalid_websocket':
              process.env.WS_MAX_CONNECTIONS = invalidConfig.WS_MAX_CONNECTIONS;
              break;
            default:
              // No additional configuration needed
              break;
          }

          // Import validateConfig fresh to pick up new env vars
          const { validateConfig } = await import('../../src/config/environment.js?' + Date.now());

          // Validation should fail with descriptive error
          let thrownError;
          try {
            validateConfig();
            // Should not reach here
            expect(true).toBe(false);
          } catch (error) {
            thrownError = error;
          }

          // Verify error was thrown and is descriptive
          expect(thrownError).toBeDefined();
          expect(typeof thrownError.message).toBe('string');
          expect(thrownError.message.length).toBeGreaterThan(10); // Should be descriptive
          // Check that error message contains validation failure indication
          const errorMessage = thrownError.message.toLowerCase();
          const hasValidationFailure = errorMessage.includes('configuration validation failed') ||
            errorMessage.includes('validation') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('required') ||
            errorMessage.includes('must be') ||
            errorMessage.includes('not allowed');
          expect(hasValidationFailure).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });
});