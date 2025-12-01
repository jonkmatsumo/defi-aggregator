/**
 * Error type constants for classification
 */
export const ERROR_TYPES = {
  NETWORK: 'network',
  WALLET: 'wallet',
  RENDER: 'render',
  GENERIC: 'generic'
};

/**
 * Error messages mapped by error type
 */
export const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: {
    title: "We're having trouble connecting to the network",
    description: "Check your internet connection and try again",
    actions: ["Check your internet connection", "Try again in a moment", "Refresh the page"]
  },
  [ERROR_TYPES.WALLET]: {
    title: "There's an issue with your wallet connection",
    description: "Please reconnect your wallet or refresh the page",
    actions: ["Reconnect your wallet", "Refresh the page", "Check your wallet extension"]
  },
  [ERROR_TYPES.RENDER]: {
    title: "Something unexpected happened",
    description: "We encountered an issue displaying this content",
    actions: ["Refresh the page", "Try again", "Contact support if the issue persists"]
  },
  [ERROR_TYPES.GENERIC]: {
    title: "Something unexpected happened",
    description: "We encountered an unexpected error",
    actions: ["Refresh the page", "Try again", "Contact support if the issue persists"]
  }
};

/**
 * Classifies an error based on its characteristics
 * @param {Error} error - The error object to classify
 * @returns {string} The error type from ERROR_TYPES
 */
export function classifyError(error) {
  if (!error) {
    return ERROR_TYPES.GENERIC;
  }

  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  const errorStack = error.stack?.toLowerCase() || '';

  // Check for network-related errors
  if (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('xhr') ||
    errorMessage.includes('ajax') ||
    errorName.includes('networkerror')
  ) {
    return ERROR_TYPES.NETWORK;
  }

  // Check for wallet-related errors
  if (
    errorMessage.includes('wallet') ||
    errorMessage.includes('ethereum') ||
    errorMessage.includes('metamask') ||
    errorMessage.includes('web3') ||
    errorMessage.includes('provider') ||
    errorMessage.includes('signer') ||
    errorMessage.includes('account') ||
    errorStack.includes('ethers') ||
    errorStack.includes('wagmi') ||
    errorStack.includes('viem')
  ) {
    return ERROR_TYPES.WALLET;
  }

  // Check for render-related errors
  if (
    error instanceof TypeError ||
    errorMessage.includes('render') ||
    errorMessage.includes('cannot read property') ||
    errorMessage.includes('cannot read properties') ||
    errorMessage.includes('undefined is not an object') ||
    errorMessage.includes('null is not an object') ||
    errorName.includes('typeerror')
  ) {
    return ERROR_TYPES.RENDER;
  }

  // Default to generic error
  return ERROR_TYPES.GENERIC;
}

/**
 * Gets the error message configuration for a given error type
 * @param {string} errorType - The error type from ERROR_TYPES
 * @returns {object} The error message configuration
 */
export function getErrorMessage(errorType) {
  return ERROR_MESSAGES.hasOwnProperty(errorType) ? ERROR_MESSAGES[errorType] : ERROR_MESSAGES[ERROR_TYPES.GENERIC];
}

/**
 * Extracts context information from an error
 * @param {Error} error - The error object
 * @param {object} errorInfo - React error info with component stack
 * @param {string} boundaryName - Name of the error boundary that caught the error
 * @returns {object} Error context object
 */
export function extractErrorContext(error, errorInfo = null, boundaryName = 'unknown') {
  const context = {
    error: {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
      name: error?.name || 'Error'
    },
    errorInfo: {
      componentStack: errorInfo?.componentStack || ''
    },
    context: {
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      environment: process.env.NODE_ENV || 'development',
      boundaryName: boundaryName,
      errorType: classifyError(error)
    }
  };

  return context;
}

/**
 * Formats error information for display (sanitized for production)
 * @param {Error} error - The error object
 * @param {boolean} isDevelopment - Whether running in development mode
 * @returns {object} Formatted error information
 */
export function formatErrorForDisplay(error, isDevelopment = false) {
  const errorType = classifyError(error);
  const messageConfig = getErrorMessage(errorType);

  const formatted = {
    type: errorType,
    title: messageConfig.title,
    description: messageConfig.description,
    actions: messageConfig.actions
  };

  // Only include technical details in development
  if (isDevelopment) {
    formatted.technicalDetails = {
      message: error?.message,
      name: error?.name,
      stack: error?.stack
    };
  }

  return formatted;
}
