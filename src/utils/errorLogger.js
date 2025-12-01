/**
 * Error logging utility for the DeFi Aggregator application
 * Provides comprehensive error logging with context information
 */

import { extractErrorContext } from './errorClassifier.js';

/**
 * Configuration for external logging service
 */
let externalLoggingConfig = {
  enabled: false,
  endpoint: null,
  apiKey: null,
  timeout: 5000
};

/**
 * Configures external logging service
 * @param {object} config - Configuration object
 * @param {string} config.endpoint - External logging service endpoint
 * @param {string} config.apiKey - API key for authentication
 * @param {number} config.timeout - Request timeout in milliseconds
 */
export function configureExternalLogging(config) {
  externalLoggingConfig = {
    enabled: true,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    timeout: config.timeout || 5000
  };
}

/**
 * Formats error data for logging with all required context
 * @param {Error} error - The error object
 * @param {object} errorInfo - React error info with component stack
 * @param {string} boundaryName - Name of the error boundary that caught the error
 * @returns {object} Formatted error data for logging
 */
export function formatErrorForLogging(error, errorInfo = null, boundaryName = 'unknown') {
  const context = extractErrorContext(error, errorInfo, boundaryName);
  
  // Add additional logging-specific information
  const logData = {
    ...context,
    logLevel: 'error',
    source: 'error-boundary',
    sessionId: getSessionId(),
    user: getUserContext()
  };

  return logData;
}

/**
 * Logs error to console with structured format
 * @param {object} errorData - Formatted error data
 */
function logToConsole(errorData) {
  const { error, context, errorInfo } = errorData;
  
  console.group(`🚨 Error Boundary: ${context.boundaryName}`);
  console.error('Error Message:', error.message);
  console.error('Error Type:', context.errorType);
  console.error('Timestamp:', new Date(context.timestamp).toISOString());
  console.error('URL:', context.url);
  console.error('User Agent:', context.userAgent);
  console.error('Environment:', context.environment);
  
  if (error.stack) {
    console.error('Stack Trace:', error.stack);
  }
  
  if (errorInfo.componentStack) {
    console.error('Component Stack:', errorInfo.componentStack);
  }
  
  if (errorData.user.walletAddress) {
    console.error('Wallet Address:', errorData.user.walletAddress);
  }
  
  if (errorData.user.chainId) {
    console.error('Chain ID:', errorData.user.chainId);
  }
  
  console.groupEnd();
}

/**
 * Sends error data to external logging service
 * @param {object} errorData - Formatted error data
 * @returns {Promise<void>} Promise that resolves when logging is complete
 */
export async function sendToExternalService(errorData) {
  if (!externalLoggingConfig.enabled || !externalLoggingConfig.endpoint) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), externalLoggingConfig.timeout);

    const response = await fetch(externalLoggingConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(externalLoggingConfig.apiKey && {
          'Authorization': `Bearer ${externalLoggingConfig.apiKey}`
        })
      },
      body: JSON.stringify(errorData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Failed to send error to external service:', response.status, response.statusText);
    }
  } catch (error) {
    // Don't throw errors from logging - just warn
    console.warn('Error sending to external logging service:', error.message);
  }
}

/**
 * Main error logging function that handles all logging operations
 * @param {Error} error - The error object to log
 * @param {object} errorInfo - React error info with component stack
 * @param {string} boundaryName - Name of the error boundary that caught the error
 * @returns {Promise<void>} Promise that resolves when all logging is complete
 */
export async function logError(error, errorInfo = null, boundaryName = 'unknown') {
  try {
    // Format error data with all required context
    const errorData = formatErrorForLogging(error, errorInfo, boundaryName);
    
    // Always log to console (Requirements 2.1, 2.2, 2.3, 2.4)
    logToConsole(errorData);
    
    // Send to external service if configured (Requirement 2.5)
    if (externalLoggingConfig.enabled) {
      await sendToExternalService(errorData);
    }
  } catch (loggingError) {
    // Ensure logging errors don't crash the application
    console.error('Error in error logging system:', loggingError);
  }
}

/**
 * Gets or creates a session ID for tracking user sessions
 * @returns {string} Session ID
 */
function getSessionId() {
  if (typeof window === 'undefined') {
    return 'server-side';
  }
  
  let sessionId = sessionStorage.getItem('error-boundary-session-id');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('error-boundary-session-id', sessionId);
  }
  
  return sessionId;
}

/**
 * Gets user context information (wallet, chain, etc.)
 * @returns {object} User context object
 */
function getUserContext() {
  const userContext = {
    walletAddress: null,
    chainId: null
  };

  if (typeof window === 'undefined') {
    return userContext;
  }

  try {
    // Try to get wallet information from common sources
    if (window.ethereum) {
      // Get selected account if available
      if (window.ethereum.selectedAddress) {
        userContext.walletAddress = window.ethereum.selectedAddress;
      }
      
      // Get chain ID if available
      if (window.ethereum.chainId) {
        userContext.chainId = parseInt(window.ethereum.chainId, 16);
      }
    }
  } catch (error) {
    // Silently fail if we can't get user context
    console.debug('Could not retrieve user context:', error.message);
  }

  return userContext;
}

/**
 * Utility function to test error logging (for development/testing)
 * @param {string} message - Test error message
 * @param {string} boundaryName - Name of the boundary to test
 */
export function testErrorLogging(message = 'Test error', boundaryName = 'test-boundary') {
  const testError = new Error(message);
  const testErrorInfo = {
    componentStack: '\n    in TestComponent\n    in ErrorBoundary'
  };
  
  logError(testError, testErrorInfo, boundaryName);
}

// configureExternalLogging is already exported above