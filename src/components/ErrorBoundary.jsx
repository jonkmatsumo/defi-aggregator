import React, { Component } from "react";
import ErrorFallback from "./ErrorFallback";
import { logError } from "../utils/errorLogger";

/**
 * ErrorBoundary Component
 *
 * React error boundary that catches JavaScript errors in child component tree,
 * logs errors with full context, and displays a fallback UI.
 *
 * Features:
 * - Catches all errors in child components
 * - Logs errors with comprehensive context
 * - Displays user-friendly fallback UI
 * - Provides error recovery mechanisms
 * - Supports retry logic with exponential backoff
 * - Environment-aware behavior (development vs production)
 *
 * @example
 * <ErrorBoundary name="main-app">
 *   <App />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null,
    };

    // Bind methods
    this.resetErrorBoundary = this.resetErrorBoundary.bind(this);
  }

  /**
   * Static lifecycle method called when an error is thrown
   * Updates state to trigger fallback UI rendering
   *
   * @param {Error} error - The error that was thrown
   * @returns {object} New state object
   */
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: error,
    };
  }

  /**
   * Lifecycle method called after an error has been thrown
   * Handles error logging and invokes optional error callback
   *
   * @param {Error} error - The error that was thrown
   * @param {object} errorInfo - React error info with component stack
   */
  componentDidCatch(error, errorInfo) {
    const { onError, name = "unknown" } = this.props;
    const { errorCount, lastErrorTime } = this.state;

    // Calculate time since last error for retry logic
    const now = Date.now();
    const timeSinceLastError = lastErrorTime ? now - lastErrorTime : Infinity;

    // Update error count and timestamp
    const newErrorCount = timeSinceLastError < 5000 ? errorCount + 1 : 1;

    this.setState({
      errorInfo: errorInfo,
      errorCount: newErrorCount,
      lastErrorTime: now,
    });

    // Log error with full context (Requirements 2.1, 2.2, 2.3, 2.4)
    logError(error, errorInfo, name);

    // Call optional error callback if provided
    if (onError && typeof onError === "function") {
      try {
        onError(error, errorInfo);
      } catch (callbackError) {
        console.error("Error in error boundary callback:", callbackError);
      }
    }
  }

  /**
   * Resets the error boundary state to allow retry
   * Implements exponential backoff for repeated errors
   *
   * Requirements: 1.3, 1.4
   */
  resetErrorBoundary() {
    const { errorCount } = this.state;
    const { name = "unknown" } = this.props;

    // Implement exponential backoff for repeated errors
    // Max 3 retries: 1s, 2s, 4s
    const MAX_RETRIES = 3;

    if (errorCount >= MAX_RETRIES) {
      console.warn(
        `Error boundary "${name}" has reached maximum retry attempts (${MAX_RETRIES}). ` +
          "Please reload the page manually."
      );
      // Don't reset - require manual page reload
      return;
    }

    // Calculate backoff delay: 2^(errorCount-1) seconds
    const backoffDelay =
      errorCount > 0 ? Math.pow(2, errorCount - 1) * 1000 : 0;

    if (backoffDelay > 0) {
      console.log(
        `Error boundary "${name}" will retry in ${backoffDelay / 1000}s ` +
          `(attempt ${errorCount + 1}/${MAX_RETRIES})`
      );

      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
        });
      }, backoffDelay);
    } else {
      // First error - reset immediately
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  }

  /**
   * Renders children or fallback UI based on error state
   *
   * @returns {ReactNode} Children or fallback UI
   */
  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, isolate = false } = this.props;

    // Detect environment (Requirements 5.1, 5.2, 5.4, 5.5)
    const isDevelopment = process.env.NODE_ENV === "development";

    if (hasError) {
      // If custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Check if max retries reached
      const MAX_RETRIES = 3;
      const maxRetriesReached = errorCount >= MAX_RETRIES;

      // Render default fallback UI with error information
      return (
        <div style={isolate ? { minHeight: "200px" } : {}}>
          <ErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetErrorBoundary}
            isDevelopment={isDevelopment}
          />
          {maxRetriesReached && (
            <div
              style={{
                textAlign: "center",
                marginTop: "16px",
                padding: "12px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "8px",
                color: "#ef4444",
                fontSize: "14px",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              Maximum retry attempts reached. Please reload the page manually.
            </div>
          )}
        </div>
      );
    }

    // No error - render children normally (Requirement 3.5)
    return children;
  }
}

export default ErrorBoundary;
