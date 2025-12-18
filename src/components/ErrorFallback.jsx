import React from "react";
import { formatErrorForDisplay } from "../utils/errorClassifier";

/**
 * ErrorFallback Component
 *
 * Displays a user-friendly error UI when an error boundary catches an error.
 * Provides error type-specific messaging, recovery actions, and maintains
 * application styling consistency.
 *
 * @param {Object} props - Component props
 * @param {Error} props.error - The error that was caught
 * @param {Object} props.errorInfo - React error info with component stack
 * @param {Function} props.resetError - Function to reset the error state
 * @param {boolean} props.isDevelopment - Whether running in development mode
 */
const ErrorFallback = ({
  error,
  errorInfo,
  resetError,
  isDevelopment = false,
}) => {
  const errorDisplay = formatErrorForDisplay(error, isDevelopment);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: "400px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(20px, 4vw, 40px)",
        background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
        borderRadius: "clamp(12px, 2vw, 16px)",
        border: "1px solid #4a5568",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          top: "0",
          right: "0",
          width: "clamp(80px, 15vw, 120px)",
          height: "clamp(80px, 15vw, 120px)",
          background:
            "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)",
          borderRadius: "50%",
          transform: "translate(30%, -30%)",
        }}
      ></div>

      <div
        style={{
          maxWidth: "clamp(400px, 80vw, 600px)",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            width: "clamp(48px, 8vw, 64px)",
            height: "clamp(48px, 8vw, 64px)",
            background:
              "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto clamp(16px, 3vw, 24px) auto",
            border: "2px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          <span
            style={{
              fontSize: "clamp(24px, 4vw, 32px)",
              color: "#ef4444",
            }}
          >
            ⚠️
          </span>
        </div>

        {/* Error Title */}
        <h2
          style={{
            color: "white",
            fontSize: "clamp(20px, 3.5vw, 28px)",
            fontWeight: "700",
            margin: "0 0 clamp(8px, 1.5vw, 12px) 0",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {errorDisplay.title}
        </h2>

        {/* Error Description */}
        <p
          style={{
            color: "#a0aec0",
            fontSize: "clamp(14px, 2vw, 16px)",
            fontWeight: "400",
            margin: "0 0 clamp(20px, 3vw, 32px) 0",
            textAlign: "center",
            lineHeight: "1.6",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          }}
        >
          {errorDisplay.description}
        </p>

        {/* Action Steps */}
        {errorDisplay.actions && errorDisplay.actions.length > 0 && (
          <div
            style={{
              background: "rgba(102, 126, 234, 0.05)",
              borderRadius: "clamp(8px, 1.5vw, 12px)",
              padding: "clamp(16px, 2.5vw, 20px)",
              marginBottom: "clamp(20px, 3vw, 32px)",
              border: "1px solid rgba(102, 126, 234, 0.1)",
            }}
          >
            <h3
              style={{
                color: "#e2e8f0",
                fontSize: "clamp(14px, 2vw, 16px)",
                fontWeight: "600",
                margin: "0 0 clamp(10px, 1.5vw, 12px) 0",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              What you can do:
            </h3>
            <ul
              style={{
                color: "#a0aec0",
                fontSize: "clamp(13px, 1.8vw, 15px)",
                margin: "0",
                paddingLeft: "clamp(18px, 3vw, 24px)",
                lineHeight: "1.8",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
              }}
            >
              {errorDisplay.actions.map((action, index) => (
                <li
                  key={index}
                  style={{ marginBottom: "clamp(4px, 0.8vw, 8px)" }}
                >
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "clamp(12px, 2vw, 16px)",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={resetError}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "clamp(8px, 1.5vw, 12px)",
              padding: "clamp(10px, 1.5vw, 14px) clamp(20px, 3vw, 28px)",
              fontSize: "clamp(14px, 2vw, 16px)",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxShadow: "0 4px 6px rgba(102, 126, 234, 0.2)",
            }}
            onMouseEnter={e => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 12px rgba(102, 126, 234, 0.3)";
            }}
            onMouseLeave={e => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 6px rgba(102, 126, 234, 0.2)";
            }}
          >
            Try Again
          </button>

          <button
            onClick={handleReload}
            style={{
              background: "transparent",
              color: "#667eea",
              border: "2px solid #667eea",
              borderRadius: "clamp(8px, 1.5vw, 12px)",
              padding: "clamp(10px, 1.5vw, 14px) clamp(20px, 3vw, 28px)",
              fontSize: "clamp(14px, 2vw, 16px)",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
            onMouseEnter={e => {
              e.target.style.background = "rgba(102, 126, 234, 0.1)";
              e.target.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.target.style.background = "transparent";
              e.target.style.transform = "translateY(0)";
            }}
          >
            Reload Page
          </button>
        </div>

        {/* Development Mode - Technical Details */}
        {isDevelopment && errorDisplay.technicalDetails && (
          <details
            style={{
              marginTop: "clamp(24px, 4vw, 32px)",
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: "clamp(8px, 1.5vw, 12px)",
              padding: "clamp(12px, 2vw, 16px)",
              border: "1px solid #4a5568",
            }}
          >
            <summary
              style={{
                color: "#e2e8f0",
                fontSize: "clamp(13px, 1.8vw, 15px)",
                fontWeight: "600",
                cursor: "pointer",
                marginBottom: "clamp(8px, 1.5vw, 12px)",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              Technical Details (Development Only)
            </summary>
            <div
              style={{
                color: "#a0aec0",
                fontSize: "clamp(12px, 1.6vw, 14px)",
                fontFamily:
                  'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
                lineHeight: "1.6",
              }}
            >
              <div style={{ marginBottom: "clamp(8px, 1.5vw, 12px)" }}>
                <strong style={{ color: "#e2e8f0" }}>Error:</strong>{" "}
                {errorDisplay.technicalDetails.name}
              </div>
              <div style={{ marginBottom: "clamp(8px, 1.5vw, 12px)" }}>
                <strong style={{ color: "#e2e8f0" }}>Message:</strong>{" "}
                {errorDisplay.technicalDetails.message}
              </div>
              {errorDisplay.technicalDetails.stack && (
                <div>
                  <strong style={{ color: "#e2e8f0" }}>Stack Trace:</strong>
                  <pre
                    style={{
                      marginTop: "clamp(6px, 1vw, 8px)",
                      padding: "clamp(8px, 1.5vw, 12px)",
                      background: "rgba(0, 0, 0, 0.4)",
                      borderRadius: "clamp(4px, 0.8vw, 6px)",
                      overflow: "auto",
                      fontSize: "clamp(11px, 1.4vw, 13px)",
                      lineHeight: "1.4",
                      maxHeight: "clamp(150px, 25vh, 200px)",
                    }}
                  >
                    {errorDisplay.technicalDetails.stack}
                  </pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div style={{ marginTop: "clamp(12px, 2vw, 16px)" }}>
                  <strong style={{ color: "#e2e8f0" }}>Component Stack:</strong>
                  <pre
                    style={{
                      marginTop: "clamp(6px, 1vw, 8px)",
                      padding: "clamp(8px, 1.5vw, 12px)",
                      background: "rgba(0, 0, 0, 0.4)",
                      borderRadius: "clamp(4px, 0.8vw, 6px)",
                      overflow: "auto",
                      fontSize: "clamp(11px, 1.4vw, 13px)",
                      lineHeight: "1.4",
                      maxHeight: "clamp(150px, 25vh, 200px)",
                    }}
                  >
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorFallback;
