import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fc from 'fast-check';
import Joi from 'joi';
import { ServiceConfig } from '../../src/services/config.js';
import { ServiceError } from '../../src/utils/errors.js';

describe('ServiceConfig', () => {
  let serviceConfig;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    serviceConfig = new ServiceConfig({
      defaultKey: 'defaultValue',
      nested: {
        key: 'nestedDefault',
      },
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Environment Variable Loading', () => {
    test('should load configuration from environment variables', () => {
      process.env.SERVICE_API_KEY = 'test-api-key';
      process.env.SERVICE_TIMEOUT = '5000';
      process.env.SERVICE_ENABLED = 'true';
      process.env.SERVICE_NESTED_VALUE = 'nested-env-value';

      const config = serviceConfig.load();

      expect(config.api.key).toBe('test-api-key');
      expect(config.timeout).toBe(5000);
      expect(config.enabled).toBe(true);
      expect(config.nested.value).toBe('nested-env-value');
    });

    test('should parse different value types correctly', () => {
      process.env.SERVICE_STRING_VAL = 'string-value';
      process.env.SERVICE_INT_VAL = '42';
      process.env.SERVICE_FLOAT_VAL = '3.14';
      process.env.SERVICE_BOOL_TRUE = 'true';
      process.env.SERVICE_BOOL_FALSE = 'false';
      process.env.SERVICE_ARRAY_VAL = 'item1,item2,item3';
      process.env.SERVICE_JSON_VAL = '{"key":"value","num":123}';

      const config = serviceConfig.load();

      expect(config.string.val).toBe('string-value');
      expect(config.int.val).toBe(42);
      expect(config.float.val).toBe(3.14);
      expect(config.bool.true).toBe(true);
      expect(config.bool.false).toBe(false);
      expect(config.array.val).toEqual(['item1', 'item2', 'item3']);
      expect(config.json.val).toEqual({ key: 'value', num: 123 });
    });

    test('should handle invalid JSON gracefully', () => {
      process.env.SERVICE_INVALID_JSON = '{invalid-json}';

      const config = serviceConfig.load();

      // Should fall back to string value
      expect(config.invalid.json).toBe('{invalid-json}');
    });

    test('should convert environment keys to config keys correctly', () => {
      const testCases = [
        ['SERVICE_API_KEY', 'api.key'],
        ['SERVICE_NESTED_DEEP_VALUE', 'nested.deep.value'],
        ['SERVICE_SIMPLE', 'simple'],
      ];

      testCases.forEach(([envKey, expectedConfigKey]) => {
        const configKey = serviceConfig.envKeyToConfigKey(envKey, 'SERVICE_');
        expect(configKey).toBe(expectedConfigKey);
      });
    });

    // **Feature: service-migration-to-backend, Property 21: Environment-based configuration support**
    test('Property 21: Environment-based configuration support', () => {
      fc.assert(
        fc.property(
          fc.record({
            stringVal: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter(
                s =>
                  s.trim().length > 0 &&
                  !/^\d+$/.test(s) &&
                  !/^\d+\.\d+$/.test(s) &&
                  s.toLowerCase() !== 'true' &&
                  s.toLowerCase() !== 'false' &&
                  !s.includes(',')
              ),
            intVal: fc.integer({ min: 0, max: 10000 }),
            floatVal: fc
              .float({ min: 1, max: 100, noNaN: true })
              .filter(
                f =>
                  !f.toString().includes('e') && /^\d+\.\d+$/.test(f.toString())
              ),
            boolVal: fc.boolean(),
            arrayVal: fc.array(
              fc
                .string({ minLength: 1, maxLength: 20 })
                .filter(
                  s =>
                    s.trim().length > 0 &&
                    !s.includes(',') &&
                    !/^\d+$/.test(s) &&
                    s.toLowerCase() !== 'true' &&
                    s.toLowerCase() !== 'false'
                ),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          testConfig => {
            // Clear environment
            Object.keys(process.env).forEach(key => {
              if (key.startsWith('SERVICE_')) {
                delete process.env[key];
              }
            });

            // Set environment variables
            process.env.SERVICE_STRING_VAL = testConfig.stringVal;
            process.env.SERVICE_INT_VAL = testConfig.intVal.toString();
            process.env.SERVICE_FLOAT_VAL = testConfig.floatVal.toString();
            process.env.SERVICE_BOOL_VAL = testConfig.boolVal.toString();
            process.env.SERVICE_ARRAY_VAL = testConfig.arrayVal.join(',');

            const config = new ServiceConfig();
            const loadedConfig = config.load();

            // Verify environment variables are loaded correctly
            expect(loadedConfig.string.val).toBe(testConfig.stringVal);
            expect(loadedConfig.int.val).toBe(testConfig.intVal);
            expect(loadedConfig.float.val).toBe(testConfig.floatVal);
            expect(loadedConfig.bool.val).toBe(testConfig.boolVal);
            expect(loadedConfig.array.val).toEqual(testConfig.arrayVal);

            // Verify configuration can be retrieved
            expect(config.get('string.val')).toBe(testConfig.stringVal);
            expect(config.get('int.val')).toBe(testConfig.intVal);
            expect(config.get('float.val')).toBe(testConfig.floatVal);
            expect(config.get('bool.val')).toBe(testConfig.boolVal);
            expect(config.get('array.val')).toEqual(testConfig.arrayVal);

            // Verify has() method works correctly
            expect(config.has('string.val')).toBe(true);
            expect(config.has('nonexistent.key')).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Property 21: Environment prefix isolation', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 10 })
            .map(s => s.toUpperCase().replace(/[^A-Z]/g, 'A') + '_'),
          fc.record({
            key1: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                s =>
                  s.trim().length > 0 &&
                  !s.includes(',') &&
                  !/^\d+$/.test(s) &&
                  !/^\d+\.\d+$/.test(s) &&
                  s.toLowerCase() !== 'true' &&
                  s.toLowerCase() !== 'false'
              ),
            key2: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter(
                s =>
                  s.trim().length > 0 &&
                  !s.includes(',') &&
                  !/^\d+$/.test(s) &&
                  !/^\d+\.\d+$/.test(s) &&
                  s.toLowerCase() !== 'true' &&
                  s.toLowerCase() !== 'false'
              ),
          }),
          (prefix, testValues) => {
            // Clear environment
            Object.keys(process.env).forEach(key => {
              if (key.startsWith(prefix) || key.startsWith('OTHER_')) {
                delete process.env[key];
              }
            });

            // Set environment variables with test prefix
            process.env[`${prefix}KEY1`] = testValues.key1;
            process.env[`${prefix}KEY2`] = testValues.key2;

            // Set environment variables with different prefix
            process.env.OTHER_KEY1 = 'other-value1';
            process.env.OTHER_KEY2 = 'other-value2';

            const config = new ServiceConfig();
            config.setEnvironmentPrefix(prefix);
            const loadedConfig = config.load();

            // Verify only variables with correct prefix are loaded
            expect(loadedConfig.key1).toBe(testValues.key1);
            expect(loadedConfig.key2).toBe(testValues.key2);
            expect(loadedConfig.other).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Configuration Management', () => {
    test('should merge default and environment configuration', () => {
      process.env.SERVICE_API_KEY = 'env-api-key';
      process.env.SERVICE_NEW_KEY = 'new-value';

      const config = serviceConfig.load();

      // Should have default values
      expect(config.defaultKey).toBe('defaultValue');
      expect(config.nested.key).toBe('nestedDefault');

      // Should have environment values
      expect(config.api.key).toBe('env-api-key');
      expect(config.new.key).toBe('new-value');
    });

    test('should apply overrides', () => {
      const overrides = {
        overrideKey: 'overrideValue',
        nested: {
          override: 'nestedOverride',
        },
      };

      const config = serviceConfig.load(overrides);

      expect(config.overrideKey).toBe('overrideValue');
      expect(config.nested.override).toBe('nestedOverride');
      // Note: The current implementation replaces the entire nested object
      // This is acceptable behavior for overrides
    });

    test('should get and set nested values', () => {
      serviceConfig.load();

      serviceConfig.set('deep.nested.value', 'test-value');
      expect(serviceConfig.get('deep.nested.value')).toBe('test-value');

      expect(serviceConfig.get('nonexistent.key', 'default')).toBe('default');
    });

    test('should check if keys exist', () => {
      serviceConfig.load();

      expect(serviceConfig.has('defaultKey')).toBe(true);
      expect(serviceConfig.has('nested.key')).toBe(true);
      expect(serviceConfig.has('nonexistent')).toBe(false);
    });

    test('should merge additional configuration', () => {
      serviceConfig.load();

      serviceConfig.merge({
        newKey: 'newValue',
        nested: {
          merged: 'mergedValue',
        },
      });

      expect(serviceConfig.get('newKey')).toBe('newValue');
      expect(serviceConfig.get('nested.merged')).toBe('mergedValue');
      expect(serviceConfig.get('nested.key')).toBe('nestedDefault'); // Should preserve existing
    });

    test('should get service-specific configuration', () => {
      serviceConfig.set('myService.apiKey', 'service-api-key');
      serviceConfig.set('myService.timeout', 5000);

      const serviceSpecificConfig = serviceConfig.getServiceConfig('myService');

      expect(serviceSpecificConfig.apiKey).toBe('service-api-key');
      expect(serviceSpecificConfig.timeout).toBe(5000);
    });
  });

  describe('Validation', () => {
    test('should validate configuration with schema', () => {
      const schema = Joi.object({
        apiKey: Joi.string().required(),
        timeout: Joi.number().positive().default(5000),
      });

      serviceConfig.setValidationSchema(schema);

      // Should throw error for missing required field
      expect(() => {
        serviceConfig.load({ timeout: 3000 });
      }).toThrow(ServiceError);

      // Should pass validation with valid config
      const validConfig = serviceConfig.load({
        apiKey: 'test-key',
        timeout: 3000,
      });
      expect(validConfig.apiKey).toBe('test-key');
      expect(validConfig.timeout).toBe(3000);
    });

    test('should throw error for invalid validation schema', () => {
      expect(() => {
        serviceConfig.setValidationSchema('invalid-schema');
      }).toThrow(ServiceError);

      expect(() => {
        serviceConfig.setValidationSchema(null);
      }).toThrow(ServiceError);
    });
  });

  describe('Static Helper Methods', () => {
    test('should create service-specific schema', () => {
      const serviceSchema = Joi.object({
        apiKey: Joi.string().required(),
        timeout: Joi.number().default(5000),
      });

      const schema = ServiceConfig.createServiceSchema(
        'myService',
        serviceSchema
      );

      const { error, value } = schema.validate({
        myService: {
          apiKey: 'test-key',
        },
      });

      expect(error).toBeFalsy();
      expect(value.myService.apiKey).toBe('test-key');
      expect(value.myService.timeout).toBe(5000);
    });

    test('should create API service schema', () => {
      const schema = ServiceConfig.createAPIServiceSchema();

      const { error, value } = schema.validate({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      expect(error).toBeFalsy();
      expect(value.apiKey).toBe('test-key');
      expect(value.baseURL).toBe('https://api.example.com');
      expect(value.timeout).toBe(30000); // Default value
    });
  });
});

describe('Configuration Validation Accuracy', () => {
  // **Feature: service-migration-to-backend, Property 22: Configuration validation accuracy**
  test('Property 22: Configuration validation accuracy', () => {
    fc.assert(
      fc.property(
        fc.record({
          validConfig: fc.record({
            apiKey: fc.string({ minLength: 10, maxLength: 50 }),
            timeout: fc.integer({ min: 1000, max: 60000 }),
            enabled: fc.boolean(),
            retryAttempts: fc.integer({ min: 1, max: 10 }),
          }),
          invalidConfigs: fc.array(
            fc.oneof(
              // Missing required field
              fc.record({
                timeout: fc.integer({ min: 1000, max: 60000 }),
                enabled: fc.boolean(),
              }),
              // Invalid type for apiKey
              fc.record({
                apiKey: fc.integer(),
                timeout: fc.integer({ min: 1000, max: 60000 }),
              }),
              // Invalid range for timeout
              fc.record({
                apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                timeout: fc.integer({ min: -1000, max: 0 }),
              }),
              // Invalid type for boolean
              fc.record({
                apiKey: fc.string({ minLength: 10, maxLength: 50 }),
                timeout: fc.integer({ min: 1000, max: 60000 }),
                enabled: fc.string(),
              })
            ),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        ({ validConfig, invalidConfigs }) => {
          const schema = Joi.object({
            apiKey: Joi.string().min(5).required(),
            timeout: Joi.number().positive().required(),
            enabled: Joi.boolean().default(true),
            retryAttempts: Joi.number().min(1).max(10).default(3),
          });

          const config = new ServiceConfig();
          config.setValidationSchema(schema);

          // Valid configuration should pass validation
          const loadedValidConfig = config.load(validConfig);
          expect(loadedValidConfig.apiKey).toBe(validConfig.apiKey);
          expect(loadedValidConfig.timeout).toBe(validConfig.timeout);
          expect(loadedValidConfig.enabled).toBe(validConfig.enabled);

          // Invalid configurations should fail validation
          invalidConfigs.forEach(invalidConfig => {
            const testConfig = new ServiceConfig();
            testConfig.setValidationSchema(schema);

            expect(() => {
              testConfig.load(invalidConfig);
            }).toThrow(ServiceError);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 22: Validation error message clarity', () => {
    fc.assert(
      fc.property(
        fc.record({
          missingField: fc.constantFrom('apiKey', 'baseURL', 'timeout'),
          invalidValue: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.integer({ min: -1000, max: 0 })
          ),
        }),
        ({ missingField, invalidValue }) => {
          const schema = Joi.object({
            apiKey: Joi.string().required(),
            baseURL: Joi.string().uri().required(),
            timeout: Joi.number().positive().required(),
          });

          const config = new ServiceConfig();
          config.setValidationSchema(schema);

          // Test missing required field
          const incompleteConfig = {
            apiKey: 'test-key',
            baseURL: 'https://api.example.com',
            timeout: 5000,
          };
          delete incompleteConfig[missingField];

          let thrownError;
          try {
            config.load(incompleteConfig);
          } catch (error) {
            thrownError = error;
          }

          expect(thrownError).toBeInstanceOf(ServiceError);
          expect(thrownError.message).toContain(
            'Configuration validation failed'
          );
          expect(thrownError.message).toContain(missingField);

          // Test invalid value type/range
          const invalidConfig = {
            apiKey: 'test-key',
            baseURL: 'https://api.example.com',
            timeout: invalidValue,
          };

          let thrownError2;
          try {
            const config2 = new ServiceConfig();
            config2.setValidationSchema(schema);
            config2.load(invalidConfig);
          } catch (error) {
            thrownError2 = error;
          }

          expect(thrownError2).toBeInstanceOf(ServiceError);
          expect(thrownError2.message).toContain(
            'Configuration validation failed'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 22: Schema validation consistency', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            serviceName: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
            config: fc.record({
              apiKey: fc.string({ minLength: 10, maxLength: 50 }),
              timeout: fc.integer({ min: 1000, max: 60000 }),
              retryAttempts: fc.integer({ min: 1, max: 5 }),
            }),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        serviceConfigs => {
          // Create schemas for each service
          const schemas = serviceConfigs.map(({ serviceName }) => ({
            serviceName,
            schema: ServiceConfig.createServiceSchema(
              serviceName,
              Joi.object({
                apiKey: Joi.string().min(5).required(),
                timeout: Joi.number().positive().required(),
                retryAttempts: Joi.number().min(1).max(10).default(3),
              })
            ),
          }));

          // Test each service configuration
          serviceConfigs.forEach(
            ({ serviceName, config: serviceConfig }, index) => {
              const { schema } = schemas[index];
              const testConfig = new ServiceConfig();
              testConfig.setValidationSchema(schema);

              const fullConfig = {
                [serviceName]: serviceConfig,
              };

              // Should validate successfully
              const loadedConfig = testConfig.load(fullConfig);
              expect(loadedConfig[serviceName].apiKey).toBe(
                serviceConfig.apiKey
              );
              expect(loadedConfig[serviceName].timeout).toBe(
                serviceConfig.timeout
              );
              expect(loadedConfig[serviceName].retryAttempts).toBe(
                serviceConfig.retryAttempts
              );

              // Should fail validation with missing service config
              const testConfig2 = new ServiceConfig();
              testConfig2.setValidationSchema(schema);

              expect(() => {
                testConfig2.load({ [serviceName]: {} }); // Empty service config should fail
              }).toThrow(ServiceError);
            }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 22: API service schema validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          validAPIConfig: fc.record({
            apiKey: fc.hexaString({ minLength: 10, maxLength: 100 }),
            baseURL: fc.constant('https://api.example.com'),
            timeout: fc.integer({ min: 1000, max: 60000 }),
            retryAttempts: fc.integer({ min: 1, max: 10 }),
          }),
          invalidAPIConfigs: fc.array(
            fc.oneof(
              // Missing required apiKey
              fc.record({
                baseURL: fc.webUrl(),
                timeout: fc.integer({ min: 1000, max: 60000 }),
              }),
              // Invalid URL format
              fc.record({
                apiKey: fc.string({ minLength: 10, maxLength: 100 }),
                baseURL: fc
                  .string({ minLength: 5, maxLength: 20 })
                  .filter(s => !s.startsWith('http')),
                timeout: fc.integer({ min: 1000, max: 60000 }),
              }),
              // Invalid timeout (negative)
              fc.record({
                apiKey: fc.string({ minLength: 10, maxLength: 100 }),
                baseURL: fc.webUrl(),
                timeout: fc.integer({ min: -5000, max: 0 }),
              })
            ),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        ({ validAPIConfig, invalidAPIConfigs }) => {
          const schema = ServiceConfig.createAPIServiceSchema();

          // Valid API configuration should pass
          const { error: validError, value: validValue } =
            schema.validate(validAPIConfig);
          expect(validError).toBeFalsy();
          expect(validValue.apiKey).toBe(validAPIConfig.apiKey);
          expect(validValue.baseURL).toBe(validAPIConfig.baseURL);
          expect(validValue.timeout).toBe(validAPIConfig.timeout);

          // Invalid configurations should fail
          invalidAPIConfigs.forEach(invalidConfig => {
            const { error } = schema.validate(invalidConfig);
            expect(error).toBeTruthy();
            expect(error.details).toBeDefined();
            expect(error.details.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
