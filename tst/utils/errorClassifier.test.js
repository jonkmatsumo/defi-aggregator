/**
 * Property-based tests for error classification utility
 * Feature: error-boundary, Property: Error Type Classification
 * Validates: Requirements 4.1, 4.2, 4.3
 */

import fc from 'fast-check';
import {
  classifyError,
  getErrorMessage,
  extractErrorContext,
  formatErrorForDisplay,
  ERROR_TYPES,
  ERROR_MESSAGES
} from '../../src/utils/errorClassifier.js';

describe('Error Classification Property Tests', () => {
  
  // **Feature: error-boundary, Property: Error Type Classification**
  // **Validates: Requirements 4.1, 4.2, 4.3**
  describe('Property: Error Type Classification', () => {
    
    test('should classify network errors correctly', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant('fetch'),
          fc.constant('network'),
          fc.constant('timeout'),
          fc.constant('connection'),
          fc.constant('xhr'),
          fc.constant('ajax')
        ),
        fc.string(),
        (networkKeyword, additionalText) => {
          // Create error with network-related message
          const error = new Error(`${additionalText} ${networkKeyword} ${additionalText}`);
          const result = classifyError(error);
          
          // Should always classify as network error
          expect(result).toBe(ERROR_TYPES.NETWORK);
        }
      ), { numRuns: 100 });
    });

    test('should classify wallet errors correctly', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant('wallet'),
          fc.constant('ethereum'),
          fc.constant('metamask'),
          fc.constant('web3'),
          fc.constant('provider'),
          fc.constant('signer'),
          fc.constant('account')
        ),
        fc.string(),
        (walletKeyword, additionalText) => {
          // Create error with wallet-related message
          const error = new Error(`${additionalText} ${walletKeyword} ${additionalText}`);
          const result = classifyError(error);
          
          // Should always classify as wallet error
          expect(result).toBe(ERROR_TYPES.WALLET);
        }
      ), { numRuns: 100 });
    });

    test('should classify render errors correctly', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant('render'),
          fc.constant('cannot read property'),
          fc.constant('cannot read properties'),
          fc.constant('undefined is not an object'),
          fc.constant('null is not an object')
        ),
        fc.string(),
        (renderKeyword, additionalText) => {
          // Create error with render-related message
          const error = new Error(`${additionalText} ${renderKeyword} ${additionalText}`);
          const result = classifyError(error);
          
          // Should always classify as render error
          expect(result).toBe(ERROR_TYPES.RENDER);
        }
      ), { numRuns: 100 });
    });

    test('should classify TypeError as render error when no other patterns match', () => {
      fc.assert(fc.property(
        fc.string().filter(str => {
          const lower = str.toLowerCase();
          // Filter out strings that would trigger network or wallet classification
          return !lower.includes('fetch') &&
                 !lower.includes('network') &&
                 !lower.includes('timeout') &&
                 !lower.includes('connection') &&
                 !lower.includes('xhr') &&
                 !lower.includes('ajax') &&
                 !lower.includes('wallet') &&
                 !lower.includes('ethereum') &&
                 !lower.includes('metamask') &&
                 !lower.includes('web3') &&
                 !lower.includes('provider') &&
                 !lower.includes('signer') &&
                 !lower.includes('account');
        }),
        (message) => {
          // Create TypeError with message that won't trigger other classifications
          const error = new TypeError(message);
          const result = classifyError(error);
          
          // Should classify TypeError as render error when no other patterns match
          expect(result).toBe(ERROR_TYPES.RENDER);
        }
      ), { numRuns: 100 });
    });

    test('should classify unknown errors as generic', () => {
      fc.assert(fc.property(
        fc.string().filter(str => {
          const lower = str.toLowerCase();
          // Filter out strings that would trigger specific classifications
          return !lower.includes('fetch') &&
                 !lower.includes('network') &&
                 !lower.includes('timeout') &&
                 !lower.includes('connection') &&
                 !lower.includes('xhr') &&
                 !lower.includes('ajax') &&
                 !lower.includes('wallet') &&
                 !lower.includes('ethereum') &&
                 !lower.includes('metamask') &&
                 !lower.includes('web3') &&
                 !lower.includes('provider') &&
                 !lower.includes('signer') &&
                 !lower.includes('account') &&
                 !lower.includes('render') &&
                 !lower.includes('cannot read property') &&
                 !lower.includes('cannot read properties') &&
                 !lower.includes('undefined is not an object') &&
                 !lower.includes('null is not an object');
        }),
        (message) => {
          // Create generic error
          const error = new Error(message);
          const result = classifyError(error);
          
          // Should classify as generic error
          expect(result).toBe(ERROR_TYPES.GENERIC);
        }
      ), { numRuns: 100 });
    });

    test('should handle null/undefined errors gracefully', () => {
      fc.assert(fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined)),
        (invalidError) => {
          const result = classifyError(invalidError);
          
          // Should default to generic for invalid inputs
          expect(result).toBe(ERROR_TYPES.GENERIC);
        }
      ), { numRuns: 100 });
    });

    test('should return valid error type for any error', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.record({
            message: fc.string(),
            name: fc.string(),
            stack: fc.string()
          }),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (errorLike) => {
          const result = classifyError(errorLike);
          
          // Result should always be one of the valid error types
          expect(Object.values(ERROR_TYPES)).toContain(result);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Error Message Retrieval', () => {
    test('should return valid message config for any error type', () => {
      fc.assert(fc.property(
        fc.oneof(...Object.values(ERROR_TYPES).map(type => fc.constant(type))),
        (errorType) => {
          const messageConfig = getErrorMessage(errorType);
          
          // Should have required properties
          expect(messageConfig).toHaveProperty('title');
          expect(messageConfig).toHaveProperty('description');
          expect(messageConfig).toHaveProperty('actions');
          expect(Array.isArray(messageConfig.actions)).toBe(true);
          expect(messageConfig.actions.length).toBeGreaterThan(0);
        }
      ), { numRuns: 100 });
    });

    test('should return generic message for invalid error types', () => {
      fc.assert(fc.property(
        fc.string().filter(str => !Object.values(ERROR_TYPES).includes(str)),
        (invalidType) => {
          const messageConfig = getErrorMessage(invalidType);
          const genericConfig = ERROR_MESSAGES[ERROR_TYPES.GENERIC];
          
          // Should return generic message config
          expect(messageConfig).toEqual(genericConfig);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Error Context Extraction', () => {
    test('should extract complete context for any error', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        fc.option(fc.record({
          componentStack: fc.string()
        })),
        fc.string(),
        (error, errorInfo, boundaryName) => {
          const context = extractErrorContext(error, errorInfo, boundaryName);
          
          // Should have required structure
          expect(context).toHaveProperty('error');
          expect(context).toHaveProperty('errorInfo');
          expect(context).toHaveProperty('context');
          
          expect(context.error).toHaveProperty('message');
          expect(context.error).toHaveProperty('stack');
          expect(context.error).toHaveProperty('name');
          
          expect(context.context).toHaveProperty('timestamp');
          expect(context.context).toHaveProperty('boundaryName', boundaryName);
          expect(context.context).toHaveProperty('errorType');
          expect(Object.values(ERROR_TYPES)).toContain(context.context.errorType);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Error Display Formatting', () => {
    test('should format error for display with consistent structure', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        fc.boolean(),
        (error, isDevelopment) => {
          const formatted = formatErrorForDisplay(error, isDevelopment);
          
          // Should have required display properties
          expect(formatted).toHaveProperty('type');
          expect(formatted).toHaveProperty('title');
          expect(formatted).toHaveProperty('description');
          expect(formatted).toHaveProperty('actions');
          
          expect(Object.values(ERROR_TYPES)).toContain(formatted.type);
          expect(Array.isArray(formatted.actions)).toBe(true);
          
          // Technical details should only be present in development
          const hasTechnicalDetails = formatted.hasOwnProperty('technicalDetails');
          expect(hasTechnicalDetails).toBe(isDevelopment);
        }
      ), { numRuns: 100 });
    });

    test('should include technical details in development mode', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        (error) => {
          const formatted = formatErrorForDisplay(error, true);
          
          // Should have technical details in development
          expect(formatted).toHaveProperty('technicalDetails');
          expect(formatted.technicalDetails).toHaveProperty('message');
          expect(formatted.technicalDetails).toHaveProperty('name');
          expect(formatted.technicalDetails).toHaveProperty('stack');
        }
      ), { numRuns: 100 });
    });

    test('should not include technical details in production mode', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        (error) => {
          const formatted = formatErrorForDisplay(error, false);
          
          // Should not have technical details in production
          expect(formatted).not.toHaveProperty('technicalDetails');
        }
      ), { numRuns: 100 });
    });
  });
});