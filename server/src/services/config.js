import Joi from 'joi';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../utils/errors.js';

/**
 * Service configuration management with environment variable support
 */
export class ServiceConfig {
  constructor(defaultConfig = {}) {
    this.defaultConfig = defaultConfig;
    this.config = {};
    this.validationSchema = null;
    this.environmentPrefix = 'SERVICE_';
  }

  /**
   * Set validation schema for configuration
   * @param {Object} schema - Joi validation schema
   */
  setValidationSchema(schema) {
    if (!schema || typeof schema.validate !== 'function') {
      throw new ServiceError('Invalid validation schema provided');
    }
    this.validationSchema = schema;
  }

  /**
   * Set environment variable prefix
   * @param {string} prefix - Environment variable prefix
   */
  setEnvironmentPrefix(prefix) {
    if (typeof prefix !== 'string') {
      throw new ServiceError('Environment prefix must be a string');
    }
    this.environmentPrefix = prefix;
  }

  /**
   * Load configuration from environment variables and defaults
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Loaded configuration
   */
  load(overrides = {}) {
    // Start with default configuration
    const config = { ...this.defaultConfig };

    // Load from environment variables
    this.loadFromEnvironment(config);

    // Apply overrides
    Object.assign(config, overrides);

    // Validate configuration if schema is set
    if (this.validationSchema) {
      this.validateConfiguration(config);
    }

    this.config = config;

    logger.info('Service configuration loaded', {
      hasValidationSchema: !!this.validationSchema,
      environmentPrefix: this.environmentPrefix,
      configKeys: Object.keys(config)
    });

    return config;
  }

  /**
   * Load configuration from environment variables
   * @param {Object} config - Configuration object to populate
   */
  loadFromEnvironment(config) {
    const envVars = process.env;
    const prefix = this.environmentPrefix;

    for (const [key, value] of Object.entries(envVars)) {
      if (key.startsWith(prefix)) {
        const configKey = this.envKeyToConfigKey(key, prefix);
        const parsedValue = this.parseEnvironmentValue(value);

        this.setNestedValue(config, configKey, parsedValue);

        logger.debug('Environment variable loaded', {
          envKey: key,
          configKey,
          valueType: typeof parsedValue
        });
      }
    }
  }

  /**
   * Convert environment variable key to configuration key
   * @param {string} envKey - Environment variable key
   * @param {string} prefix - Environment prefix
   * @returns {string} Configuration key
   */
  envKeyToConfigKey(envKey, prefix) {
    return envKey
      .substring(prefix.length)
      .toLowerCase()
      .replace(/_/g, '.');
  }

  /**
   * Parse environment variable value to appropriate type
   * @param {string} value - Environment variable value
   * @returns {*} Parsed value
   */
  parseEnvironmentValue(value) {
    // Handle boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Handle integer values (only if it's a clean integer)
    if (/^-?\d+$/.test(value)) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) return parsed;
    }

    // Handle float values (only if it's a clean float)
    if (/^-?\d+\.\d+$/.test(value)) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && isFinite(parsed)) return parsed;
    }

    // Handle JSON values
    if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (error) {
        logger.warn('Failed to parse JSON environment value', { value, error: error.message });
      }
    }

    // Handle comma-separated arrays (only if contains comma and not just whitespace)
    if (value.includes(',') && value.trim().length > 0) {
      const items = value.split(',');
      if (items.length > 1) {
        return items;
      }
    }

    // Return as string
    return value;
  }

  /**
   * Set nested configuration value using dot notation
   * @param {Object} config - Configuration object
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} value - Value to set
   */
  setNestedValue(config, key, value) {
    const keys = key.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get nested configuration value using dot notation
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = undefined) {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], this.config);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} value - Value to set
   */
  set(key, value) {
    this.setNestedValue(this.config, key, value);
  }

  /**
   * Check if configuration key exists
   * @param {string} key - Configuration key
   * @returns {boolean}
   */
  has(key) {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], this.config);
    return value !== undefined;
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration to validate
   */
  validateConfiguration(config) {
    const { error, value } = this.validationSchema.validate(config, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: false
    });

    if (error) {
      const errorMessage = `Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`;
      logger.error('Configuration validation error', {
        error: errorMessage,
        details: error.details
      });
      throw new ServiceError(errorMessage);
    }

    logger.debug('Configuration validation successful');
    return value;
  }

  /**
   * Get all configuration
   * @returns {Object} Complete configuration object
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Get configuration for specific service
   * @param {string} serviceName - Service name
   * @returns {Object} Service-specific configuration
   */
  getServiceConfig(serviceName) {
    return this.get(serviceName, {});
  }

  /**
   * Merge additional configuration
   * @param {Object} additionalConfig - Additional configuration to merge
   */
  merge(additionalConfig) {
    this.config = this.deepMerge(this.config, additionalConfig);

    // Re-validate if schema is set
    if (this.validationSchema) {
      this.validateConfiguration(this.config);
    }

    logger.debug('Configuration merged', {
      additionalKeys: Object.keys(additionalConfig)
    });
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Create service-specific configuration schema
   * @param {string} serviceName - Service name
   * @param {Object} serviceSchema - Service-specific schema
   * @returns {Object} Combined schema
   */
  static createServiceSchema(serviceName, serviceSchema) {
    return Joi.object({
      [serviceName]: serviceSchema
    });
  }

  /**
   * Create common API service configuration schema
   * @returns {Object} Common API service schema
   */
  static createAPIServiceSchema() {
    return Joi.object({
      apiKey: Joi.string().trim().min(1).required(),
      baseURL: Joi.string().uri().required(),
      timeout: Joi.number().positive().default(30000),
      retryAttempts: Joi.number().min(0).max(10).default(3),
      retryDelay: Joi.number().positive().default(1000),
      rateLimit: Joi.object({
        maxRequests: Joi.number().positive().default(100),
        windowMs: Joi.number().positive().default(60000)
      }).default(),
      cache: Joi.object({
        enabled: Joi.boolean().default(true),
        ttl: Joi.number().positive().default(300000)
      }).default()
    });
  }
}