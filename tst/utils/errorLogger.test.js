/**
 * Tests for errorLogger utility
 */

import * as fc from "fast-check";
import {
  logError,
  formatErrorForLogging,
  sendToExternalService,
  configureExternalLogging,
  testErrorLogging,
} from "../../src/utils/errorLogger.js";

// Mock console methods
const originalConsole = { ...console };
beforeEach(() => {
  console.group = jest.fn();
  console.groupEnd = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
  jest.clearAllMocks();
  // Reset external logging config
  configureExternalLogging({ enabled: false });
});

// Mock fetch for external logging tests
global.fetch = jest.fn();

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

// Mock window.ethereum for wallet context
const mockEthereum = {
  selectedAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  chainId: "0x1", // Ethereum mainnet
};

describe("errorLogger", () => {
  describe("formatErrorForLogging", () => {
    it("should format error with all required context", () => {
      const error = new Error("Test error message");
      const errorInfo = {
        componentStack: "\n    in TestComponent\n    in ErrorBoundary",
      };
      const boundaryName = "test-boundary";

      const formatted = formatErrorForLogging(error, errorInfo, boundaryName);

      expect(formatted).toHaveProperty("error");
      expect(formatted).toHaveProperty("errorInfo");
      expect(formatted).toHaveProperty("context");
      expect(formatted).toHaveProperty("logLevel", "error");
      expect(formatted).toHaveProperty("source", "error-boundary");
      expect(formatted).toHaveProperty("sessionId");
      expect(formatted).toHaveProperty("user");

      expect(formatted.error.message).toBe("Test error message");
      expect(formatted.context.boundaryName).toBe("test-boundary");
      expect(formatted.context.timestamp).toBeGreaterThan(0);
      expect(formatted.context.url).toBe("http://localhost/");
      expect(formatted.context.environment).toBe("test");
    });

    it("should handle missing errorInfo gracefully", () => {
      const error = new Error("Test error");
      const formatted = formatErrorForLogging(error, null, "test-boundary");

      expect(formatted.errorInfo.componentStack).toBe("");
    });

    it("should handle missing error gracefully", () => {
      const formatted = formatErrorForLogging(null, null, "test-boundary");

      expect(formatted.error.message).toBe("Unknown error");
      expect(formatted.error.name).toBe("Error");
    });
  });

  describe("logError", () => {
    it("should log error message to console", async () => {
      const error = new Error("Test console logging");
      const errorInfo = {
        componentStack: "\n    in TestComponent",
      };

      await logError(error, errorInfo, "console-test");

      expect(console.group).toHaveBeenCalledWith(
        "🚨 Error Boundary: console-test"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error Message:",
        "Test console logging"
      );
      expect(console.groupEnd).toHaveBeenCalled();
    });

    it("should log stack trace when available", async () => {
      const error = new Error("Test with stack");
      error.stack = "Error: Test with stack\n    at test.js:1:1";

      await logError(error, null, "stack-test");

      expect(console.error).toHaveBeenCalledWith("Stack Trace:", error.stack);
    });

    it("should log component stack when available", async () => {
      const error = new Error("Test component stack");
      const errorInfo = {
        componentStack: "\n    in TestComponent\n    in ErrorBoundary",
      };

      await logError(error, errorInfo, "component-test");

      expect(console.error).toHaveBeenCalledWith(
        "Component Stack:",
        errorInfo.componentStack
      );
    });

    it("should include timestamp in logs", async () => {
      const error = new Error("Test timestamp");

      await logError(error, null, "timestamp-test");

      expect(console.error).toHaveBeenCalledWith(
        "Timestamp:",
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });

    it("should log URL and user agent", async () => {
      const error = new Error("Test context");

      await logError(error, null, "context-test");

      expect(console.error).toHaveBeenCalledWith("URL:", "http://localhost/");
      expect(console.error).toHaveBeenCalledWith(
        "User Agent:",
        expect.any(String)
      );
    });

    it("should log wallet information when available", async () => {
      // Store original ethereum if it exists
      const originalEthereum = window.ethereum;

      // Mock window.ethereum
      window.ethereum = mockEthereum;

      const error = new Error("Test wallet context");

      await logError(error, null, "wallet-test");

      expect(console.error).toHaveBeenCalledWith(
        "Wallet Address:",
        mockEthereum.selectedAddress
      );
      expect(console.error).toHaveBeenCalledWith("Chain ID:", 1);

      // Restore original
      if (originalEthereum) {
        window.ethereum = originalEthereum;
      } else {
        delete window.ethereum;
      }
    });

    it("should handle logging errors gracefully", async () => {
      // Mock logToConsole to throw by mocking console.group
      const originalConsoleGroup = console.group;
      console.group = jest.fn(() => {
        throw new Error("Console error");
      });

      const error = new Error("Test error handling");

      // Should not throw, but should log the logging error
      await logError(error, null, "error-test");

      // Should have logged the error in the logging system
      expect(console.error).toHaveBeenCalledWith(
        "Error in error logging system:",
        expect.any(Error)
      );

      // Restore
      console.group = originalConsoleGroup;
    });
  });

  describe("sendToExternalService", () => {
    beforeEach(() => {
      fetch.mockClear();
    });

    it("should not send when external logging is disabled", async () => {
      const errorData = { error: { message: "test" } };

      await sendToExternalService(errorData);

      expect(fetch).not.toHaveBeenCalled();
    });

    it("should send error data when external logging is configured", async () => {
      configureExternalLogging({
        endpoint: "https://api.example.com/errors",
        apiKey: "test-key",
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const errorData = { error: { message: "test external logging" } };

      await sendToExternalService(errorData);

      expect(fetch).toHaveBeenCalledWith(
        "https://api.example.com/errors",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-key",
          }),
          body: JSON.stringify(errorData),
        })
      );
    });

    it("should handle external service errors gracefully", async () => {
      configureExternalLogging({
        endpoint: "https://api.example.com/errors",
      });

      fetch.mockRejectedValueOnce(new Error("Network error"));

      const errorData = { error: { message: "test error handling" } };

      // Should not throw
      await expect(sendToExternalService(errorData)).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(
        "Error sending to external logging service:",
        "Network error"
      );
    });

    it("should handle non-ok responses gracefully", async () => {
      configureExternalLogging({
        endpoint: "https://api.example.com/errors",
      });

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const errorData = { error: { message: "test 500 error" } };

      await sendToExternalService(errorData);

      expect(console.warn).toHaveBeenCalledWith(
        "Failed to send error to external service:",
        500,
        "Internal Server Error"
      );
    });

    it("should timeout requests after configured timeout", async () => {
      configureExternalLogging({
        endpoint: "https://api.example.com/errors",
        timeout: 100,
      });

      // Mock fetch to simulate an aborted request
      fetch.mockImplementationOnce(() =>
        Promise.reject(new Error("The operation was aborted"))
      );

      const errorData = { error: { message: "test timeout" } };

      await sendToExternalService(errorData);

      expect(console.warn).toHaveBeenCalledWith(
        "Error sending to external logging service:",
        "The operation was aborted"
      );
    });
  });

  describe("configureExternalLogging", () => {
    it("should configure external logging with all options", () => {
      const config = {
        endpoint: "https://api.example.com/errors",
        apiKey: "test-api-key",
        timeout: 10000,
      };

      configureExternalLogging(config);

      // Test that configuration is applied by trying to send
      const errorData = { error: { message: "test config" } };
      sendToExternalService(errorData);

      expect(fetch).toHaveBeenCalledWith(
        config.endpoint,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${config.apiKey}`,
          }),
        })
      );
    });

    it("should use default timeout when not specified", () => {
      const config = {
        endpoint: "https://api.example.com/errors",
        apiKey: "test-key",
      };

      // Should not throw and should use default timeout
      expect(() => configureExternalLogging(config)).not.toThrow();
    });
  });

  describe("testErrorLogging", () => {
    it("should create and log a test error", async () => {
      await testErrorLogging("Custom test message", "test-boundary");

      expect(console.group).toHaveBeenCalledWith(
        "🚨 Error Boundary: test-boundary"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error Message:",
        "Custom test message"
      );
    });

    it("should use default values when no parameters provided", async () => {
      await testErrorLogging();

      expect(console.group).toHaveBeenCalledWith(
        "🚨 Error Boundary: test-boundary"
      );
      expect(console.error).toHaveBeenCalledWith(
        "Error Message:",
        "Test error"
      );
    });
  });

  describe("session management", () => {
    it("should create session ID when none exists", async () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const error = new Error("Test session creation");
      await logError(error, null, "session-test");

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        "error-boundary-session-id",
        expect.stringMatching(/^session-\d+-[a-z0-9]+$/)
      );
    });

    it("should reuse existing session ID", async () => {
      const existingSessionId = "session-123-abc";
      mockSessionStorage.getItem.mockReturnValue(existingSessionId);

      const error = new Error("Test session reuse");
      const formatted = formatErrorForLogging(error, null, "session-test");

      expect(formatted.sessionId).toBe(existingSessionId);
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });
  });

  // Feature: error-boundary, Property 6: Error Message Logging
  // **Validates: Requirements 2.1**
  describe("Property 6: Error Message Logging", () => {
    it("should log error message to console for any error", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.option(fc.string(), { nil: null }),
          fc.string({ minLength: 1 }),
          async (errorMessage, componentStack, boundaryName) => {
            // Reset mocks for each iteration
            console.error.mockClear();
            console.group.mockClear();
            console.groupEnd.mockClear();

            // Create error with the generated message
            const error = new Error(errorMessage);
            const errorInfo = componentStack ? { componentStack } : null;

            // Log the error
            await logError(error, errorInfo, boundaryName);

            // Verify that console.error was called with the error message
            expect(console.error).toHaveBeenCalledWith(
              "Error Message:",
              errorMessage
            );

            // Verify that console logging was initiated
            expect(console.group).toHaveBeenCalled();
            expect(console.groupEnd).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: error-boundary, Property 7: Stack Trace Logging
  // **Validates: Requirements 2.2**
  describe("Property 7: Stack Trace Logging", () => {
    it("should log component stack trace to console for any error", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          async (errorMessage, componentStack, boundaryName) => {
            // Reset mocks for each iteration
            console.error.mockClear();
            console.group.mockClear();
            console.groupEnd.mockClear();

            // Create error with the generated message
            const error = new Error(errorMessage);
            const errorInfo = { componentStack };

            // Log the error
            await logError(error, errorInfo, boundaryName);

            // Verify that console.error was called with the component stack
            expect(console.error).toHaveBeenCalledWith(
              "Component Stack:",
              componentStack
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: error-boundary, Property 8: Timestamp Inclusion
  // **Validates: Requirements 2.3**
  describe("Property 8: Timestamp Inclusion", () => {
    it("should include timestamp in error logs for any error", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.option(fc.string(), { nil: null }),
          fc.string({ minLength: 1 }),
          async (errorMessage, componentStack, boundaryName) => {
            // Reset mocks for each iteration
            console.error.mockClear();
            console.group.mockClear();
            console.groupEnd.mockClear();

            // Create error with the generated message
            const error = new Error(errorMessage);
            const errorInfo = componentStack ? { componentStack } : null;

            // Log the error
            await logError(error, errorInfo, boundaryName);

            // Verify that console.error was called with a timestamp
            // The timestamp should be in ISO format
            const timestampCall = console.error.mock.calls.find(
              call => call[0] === "Timestamp:"
            );
            expect(timestampCall).toBeDefined();
            expect(timestampCall[1]).toMatch(
              /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: error-boundary, Property 9: Context Logging
  // **Validates: Requirements 2.4**
  describe("Property 9: Context Logging", () => {
    it("should log URL and user agent for any error", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.option(fc.string(), { nil: null }),
          fc.string({ minLength: 1 }),
          async (errorMessage, componentStack, boundaryName) => {
            // Reset mocks for each iteration
            console.error.mockClear();
            console.group.mockClear();
            console.groupEnd.mockClear();

            // Create error with the generated message
            const error = new Error(errorMessage);
            const errorInfo = componentStack ? { componentStack } : null;

            // Log the error
            await logError(error, errorInfo, boundaryName);

            // Verify that console.error was called with URL
            expect(console.error).toHaveBeenCalledWith(
              "URL:",
              expect.any(String)
            );

            // Verify that console.error was called with User Agent
            expect(console.error).toHaveBeenCalledWith(
              "User Agent:",
              expect.any(String)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: error-boundary, Property 10: Conditional External Logging
  // **Validates: Requirements 2.5**
  describe("Property 10: Conditional External Logging", () => {
    it("should send to external service only when configured", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.option(fc.string(), { nil: null }),
          fc.string({ minLength: 1 }),
          fc.boolean(),
          async (
            errorMessage,
            componentStack,
            boundaryName,
            shouldConfigure
          ) => {
            // Reset mocks and configuration for each iteration
            fetch.mockClear();
            console.error.mockClear();
            console.group.mockClear();
            console.groupEnd.mockClear();

            // Configure external logging based on the boolean
            if (shouldConfigure) {
              configureExternalLogging({
                endpoint: "https://api.example.com/errors",
                apiKey: "test-key",
              });

              // Mock successful response
              fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
              });
            } else {
              // Disable external logging
              configureExternalLogging({ enabled: false });
            }

            // Create error with the generated message
            const error = new Error(errorMessage);
            const errorInfo = componentStack ? { componentStack } : null;

            // Log the error
            await logError(error, errorInfo, boundaryName);

            // Verify that fetch was called only when configured
            // Use a single assertion that checks the expected behavior
            const fetchCallCount = fetch.mock.calls.length;
            const expectedCallCount = shouldConfigure ? 1 : 0;
            expect(fetchCallCount).toBe(expectedCallCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
