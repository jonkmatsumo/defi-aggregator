import React from 'react';
import { APIError } from '../services/apiClient';

/**
 * ErrorState Component
 * 
 * Displays a user-friendly error state with contextual messaging
 * and retry functionality. Designed for API/data fetching errors.
 * 
 * @param {Object} props - Component props
 * @param {Error|string} props.error - Error object or message
 * @param {Function} props.onRetry - Function to retry the operation
 * @param {string} props.title - Custom error title
 * @param {boolean} props.compact - Use compact layout
 */
const ErrorState = ({
  error,
  onRetry,
  title,
  compact = false
}) => {
  // Parse error information
  const errorInfo = getErrorInfo(error);
  const displayTitle = title || errorInfo.title;

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }}>
        <span style={{ fontSize: '20px' }}>{errorInfo.icon}</span>
        <span style={{
          color: '#fca5a5',
          fontSize: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {errorInfo.message}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
      borderRadius: '16px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      textAlign: 'center'
    }}>
      {/* Error icon */}
      <div style={{
        width: '64px',
        height: '64px',
        background: 'rgba(239, 68, 68, 0.15)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        border: '2px solid rgba(239, 68, 68, 0.2)'
      }}>
        <span style={{ fontSize: '32px' }}>{errorInfo.icon}</span>
      </div>

      {/* Error title */}
      <h3 style={{
        color: '#fca5a5',
        fontSize: '18px',
        fontWeight: '600',
        margin: '0 0 8px 0',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {displayTitle}
      </h3>

      {/* Error message */}
      <p style={{
        color: '#a0aec0',
        fontSize: '14px',
        margin: '0 0 20px 0',
        maxWidth: '300px',
        lineHeight: '1.5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        {errorInfo.message}
      </p>

      {/* Suggestions */}
      {errorInfo.suggestions && errorInfo.suggestions.length > 0 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          width: '100%',
          maxWidth: '320px'
        }}>
          <p style={{
            color: '#e2e8f0',
            fontSize: '13px',
            fontWeight: '500',
            margin: '0 0 8px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            Things to try:
          </p>
          <ul style={{
            color: '#a0aec0',
            fontSize: '13px',
            margin: 0,
            paddingLeft: '20px',
            textAlign: 'left',
            lineHeight: '1.6',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            {errorInfo.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.2)';
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};

/**
 * Get error information for display
 * @param {Error|string} error - Error to parse
 * @returns {Object} Error info with icon, title, message, suggestions
 */
function getErrorInfo(error) {
  const defaultInfo = {
    icon: '⚠️',
    title: 'Something went wrong',
    message: 'An unexpected error occurred.',
    suggestions: ['Try again in a few moments', 'Refresh the page']
  };

  if (!error) {
    return defaultInfo;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      ...defaultInfo,
      message: error
    };
  }

  // Handle APIError instances
  if (error instanceof APIError) {
    if (error.isNetworkError()) {
      return {
        icon: '🔌',
        title: 'Connection Error',
        message: error.getUserMessage(),
        suggestions: [
          'Check your internet connection',
          'The server might be temporarily unavailable',
          'Try again in a few moments'
        ]
      };
    }

    if (error.isTimeout()) {
      return {
        icon: '⏱️',
        title: 'Request Timeout',
        message: error.getUserMessage(),
        suggestions: [
          'The server is taking too long to respond',
          'Try again with a smaller request',
          'Check your network speed'
        ]
      };
    }

    if (error.isServerError()) {
      return {
        icon: '🔧',
        title: 'Server Error',
        message: error.getUserMessage(),
        suggestions: [
          'The server is experiencing issues',
          'This is usually temporary',
          'Try again in a few minutes'
        ]
      };
    }

    if (error.status === 429) {
      return {
        icon: '⏳',
        title: 'Rate Limited',
        message: error.getUserMessage(),
        suggestions: [
          'You\'ve made too many requests',
          'Wait a moment before trying again',
          'Reduce the frequency of requests'
        ]
      };
    }

    if (error.status === 404) {
      return {
        icon: '🔍',
        title: 'Not Found',
        message: error.getUserMessage(),
        suggestions: [
          'The requested data doesn\'t exist',
          'Check if the parameters are correct',
          'The resource may have been removed'
        ]
      };
    }

    return {
      ...defaultInfo,
      message: error.getUserMessage()
    };
  }

  // Handle generic Error instances
  if (error instanceof Error) {
    return {
      ...defaultInfo,
      message: error.message || defaultInfo.message
    };
  }

  return defaultInfo;
}

export default ErrorState;
export { getErrorInfo };

