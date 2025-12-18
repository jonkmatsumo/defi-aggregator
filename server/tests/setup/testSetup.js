// Test setup and global configuration
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.PORT = '0'; // Use random available port for tests
process.env.LLM_PROVIDER = 'openai';
process.env.OPENAI_API_KEY = 'test_key';
process.env.LLM_MODEL = 'gpt-4';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
