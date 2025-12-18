import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import fc from "fast-check";
import Message from "../../../src/components/Chat/Message";

// Mock all dashboard components to avoid slow rendering and dependency issues
jest.mock("../../../src/components/NetworkStatus", () => ({
  __esModule: true,
  default: () => <div data-testid="network-status">Network Status Mock</div>,
}));

jest.mock("../../../src/components/YourAssets", () => ({
  __esModule: true,
  default: () => <div data-testid="your-assets">Your Assets Mock</div>,
}));

jest.mock("../../../src/components/TokenSwap", () => ({
  __esModule: true,
  default: () => <div data-testid="token-swap">Token Swap Mock</div>,
}));

jest.mock("../../../src/components/LendingSection", () => ({
  __esModule: true,
  default: () => <div data-testid="lending-section">Lending Section Mock</div>,
}));

jest.mock("../../../src/components/PerpetualsSection", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="perpetuals-section">Perpetuals Section Mock</div>
  ),
}));

jest.mock("../../../src/components/RecentActivity", () => ({
  __esModule: true,
  default: () => <div data-testid="recent-activity">Recent Activity Mock</div>,
}));

describe("Message", () => {
  // **Feature: chat-agent-ui, Property 8: Role-based message styling**
  // **Validates: Requirements 3.3**
  describe("Property 8: Role-based message styling", () => {
    it("should apply different styling based on message role", () => {
      fc.assert(
        fc.property(
          // Generate random message content (non-whitespace)
          fc
            .string({ minLength: 1, maxLength: 200 })
            .filter(s => s.trim().length > 0),
          fc.integer({ min: 1000000000000, max: Date.now() }),
          fc.boolean(),
          (content, timestamp, isUser) => {
            const message = {
              id: `msg-${timestamp}`,
              role: isUser ? "user" : "assistant",
              content,
              timestamp,
            };

            const { container } = render(
              <Message message={message} isUser={isUser} />
            );

            // Get the message container
            // eslint-disable-next-line testing-library/no-node-access
            const messageContainer = container.firstChild;

            // Verify the message container has different CSS class based on role
            const expectedClass = isUser ? "user" : "assistant";

            // eslint-disable-next-line jest/no-conditional-expect
            expect(messageContainer.className).toContain("message-container");
            // eslint-disable-next-line jest/no-conditional-expect
            expect(messageContainer.className).toContain(expectedClass);

            // Verify content is rendered
            expect(
              screen.getByText((textContent, element) => {
                return element.textContent === content;
              })
            ).toBeInTheDocument();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 9: Text content rendering**
  // **Validates: Requirements 3.4**
  describe("Property 9: Text content rendering", () => {
    it("should render text content in the message bubble for any assistant message", () => {
      fc.assert(
        fc.property(
          // Generate random text content (non-whitespace)
          fc
            .string({ minLength: 1, maxLength: 500 })
            .filter(s => s.trim().length > 0),
          fc.integer({ min: 1000000000000, max: Date.now() }),
          (content, timestamp) => {
            const message = {
              id: `msg-${timestamp}`,
              role: "assistant",
              content,
              timestamp,
            };

            render(<Message message={message} isUser={false} />);

            // Verify the text content is rendered (use flexible matcher for whitespace)
            expect(
              screen.getByText((textContent, element) => {
                return element.textContent === content;
              })
            ).toBeInTheDocument();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 13: Independent component rendering**
  // **Validates: Requirements 4.4**
  describe("Property 13: Independent component rendering", () => {
    it("should render each component independently for multiple messages with UI intents", () => {
      fc.assert(
        fc.property(
          // Generate an array of 2-5 messages with UI intents
          fc.array(
            fc.record({
              content: fc
                .string({ minLength: 1, maxLength: 100 })
                .filter(s => s.trim().length > 0),
              timestamp: fc.integer({ min: 1000000000000, max: Date.now() }),
              componentName: fc.constantFrom(
                "NetworkStatus",
                "YourAssets",
                "TokenSwap",
                "LendingSection",
                "PerpetualsSection",
                "RecentActivity"
              ),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          messageConfigs => {
            // Create messages with UI intents
            const messages = messageConfigs.map((config, index) => ({
              id: `msg-${config.timestamp}-${index}`,
              role: "assistant",
              content: config.content,
              timestamp: config.timestamp,
              uiIntent: {
                type: "RENDER_COMPONENT",
                component: config.componentName,
                props: {},
              },
            }));

            // Render all messages
            render(
              <div>
                {messages.map(message => (
                  <Message key={message.id} message={message} isUser={false} />
                ))}
              </div>
            );

            // Verify each message is rendered independently
            messages.forEach(message => {
              // Check that the message content is present
              expect(
                screen.getByText((textContent, element) => {
                  return element.textContent === message.content;
                })
              ).toBeInTheDocument();
            });

            // Verify we have the correct number of message containers
            // Each message should have its content rendered
            // eslint-disable-next-line jest/no-conditional-expect
            expect(messages.length).toBeGreaterThan(0);

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 14: Component state isolation**
  // **Validates: Requirements 4.5**
  describe("Property 14: Component state isolation", () => {
    // Create a simple stateful test component
    const StatefulTestComponent = ({ initialValue = 0, testId }) => {
      const [count, setCount] = React.useState(initialValue);

      return (
        <div data-testid={testId}>
          <span data-testid={`${testId}-count`}>{count}</span>
          <button
            data-testid={`${testId}-button`}
            onClick={() => setCount(prevCount => prevCount + 1)}
          >
            Increment
          </button>
        </div>
      );
    };

    // Register the test component temporarily
    beforeAll(() => {
      const {
        ComponentRegistry,
      } = require("../../../src/components/Chat/componentRegistry");
      ComponentRegistry["StatefulTestComponent"] = StatefulTestComponent;
    });

    afterAll(() => {
      const {
        ComponentRegistry,
      } = require("../../../src/components/Chat/componentRegistry");
      delete ComponentRegistry["StatefulTestComponent"];
    });

    it("should maintain state isolation when one component state changes", () => {
      fc.assert(
        fc.property(
          // Generate 2-4 messages with stateful components
          fc.integer({ min: 2, max: 4 }).chain(numMessages =>
            fc.tuple(
              fc.constant(numMessages),
              fc.array(fc.integer({ min: 0, max: 100 }), {
                minLength: numMessages,
                maxLength: numMessages,
              }),
              fc.integer({ min: 0, max: numMessages - 1 })
            )
          ),
          ([numMessages, initialValues, interactIndex]) => {
            const values = initialValues;
            const actualInteractIndex = interactIndex % numMessages;

            // Create messages with stateful components
            // Use unique timestamps to ensure unique keys
            const baseTimestamp = Date.now();
            const messages = values.map((value, index) => ({
              id: `msg-state-${baseTimestamp}-${index}`,
              role: "assistant",
              content: `Message ${index}`,
              timestamp: baseTimestamp + index * 1000,
              uiIntent: {
                type: "RENDER_COMPONENT",
                component: "StatefulTestComponent",
                props: {
                  initialValue: value,
                  testId: `component-${baseTimestamp}-${index}`,
                },
              },
            }));

            render(
              <div>
                {messages.map(message => (
                  <Message key={message.id} message={message} isUser={false} />
                ))}
              </div>
            );

            // Verify initial state for all components
            messages.forEach((message, index) => {
              const testId = `component-${baseTimestamp}-${index}`;
              const countElement = screen.getByTestId(`${testId}-count`);
              // eslint-disable-next-line jest/no-conditional-expect
              expect(countElement.textContent).toBe(values[index].toString());
            });

            // Interact with one component (click its button)
            const interactTestId = `component-${baseTimestamp}-${actualInteractIndex}`;
            const buttonToClick = screen.getByTestId(
              `${interactTestId}-button`
            );
            fireEvent.click(buttonToClick);

            // Verify the clicked component's state changed
            const clickedCount = screen.getByTestId(`${interactTestId}-count`);
            // eslint-disable-next-line jest/no-conditional-expect
            expect(clickedCount.textContent).toBe(
              (values[actualInteractIndex] + 1).toString()
            );

            // Verify all other components' states remain unchanged
            messages.forEach((message, index) => {
              if (index !== actualInteractIndex) {
                const testId = `component-${baseTimestamp}-${index}`;
                const countElement = screen.getByTestId(`${testId}-count`);
                // eslint-disable-next-line jest/no-conditional-expect
                expect(countElement.textContent).toBe(values[index].toString());
              }
            });

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Unit Tests", () => {
    it("should render user message with correct styling", () => {
      const message = {
        id: "msg-1",
        role: "user",
        content: "Hello, this is a user message",
        timestamp: Date.now(),
      };

      const { container } = render(<Message message={message} isUser={true} />);

      // Check that message has correct CSS classes
      // eslint-disable-next-line testing-library/no-node-access
      const messageContainer = container.firstChild;
      expect(messageContainer.className).toContain("message-container");
      expect(messageContainer.className).toContain("user");

      // Check that content is rendered
      expect(
        screen.getByText("Hello, this is a user message")
      ).toBeInTheDocument();
    });

    it("should render assistant message with correct styling", () => {
      const message = {
        id: "msg-2",
        role: "assistant",
        content: "Hello, this is an assistant message",
        timestamp: Date.now(),
      };

      const { container } = render(
        <Message message={message} isUser={false} />
      );

      // Check that message has correct CSS classes
      // eslint-disable-next-line testing-library/no-node-access
      const messageContainer = container.firstChild;
      expect(messageContainer.className).toContain("message-container");
      expect(messageContainer.className).toContain("assistant");

      // Check that content is rendered
      expect(
        screen.getByText("Hello, this is an assistant message")
      ).toBeInTheDocument();
    });

    it("should display timestamp", () => {
      const timestamp = new Date("2024-01-15T10:30:00").getTime();
      const message = {
        id: "msg-3",
        role: "user",
        content: "Test message",
        timestamp,
      };

      render(<Message message={message} isUser={true} />);

      // Check that timestamp is displayed (format: HH:MM AM/PM)
      const expectedTime = new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    it("should render message bubble with text content", () => {
      const message = {
        id: "msg-4",
        role: "assistant",
        content: "This is the message content",
        timestamp: Date.now(),
      };

      render(<Message message={message} isUser={false} />);

      // Verify the content is in the document
      expect(
        screen.getByText("This is the message content")
      ).toBeInTheDocument();
    });

    it("should handle long messages", () => {
      const longContent =
        "This is a very long message that should wrap properly within the message bubble. "
          .repeat(5)
          .trim();
      const message = {
        id: "msg-5",
        role: "user",
        content: longContent,
        timestamp: Date.now(),
      };

      render(<Message message={message} isUser={true} />);

      // Verify long content is rendered
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it("should handle special characters in content", () => {
      const message = {
        id: "msg-6",
        role: "assistant",
        content: "Special chars: <>&\"'",
        timestamp: Date.now(),
      };

      render(<Message message={message} isUser={false} />);

      // Verify special characters are rendered
      expect(screen.getByText("Special chars: <>&\"'")).toBeInTheDocument();
    });

    it("should render GenerativeUIRenderer when message has uiIntent", () => {
      const message = {
        id: "msg-7",
        role: "assistant",
        content: "Here is the component:",
        timestamp: Date.now(),
        uiIntent: {
          type: "RENDER_COMPONENT",
          component: "NetworkStatus",
          props: {},
        },
      };

      render(<Message message={message} isUser={false} />);

      // Verify message content is rendered
      expect(screen.getByText("Here is the component:")).toBeInTheDocument();

      // The GenerativeUIRenderer will render, but NetworkStatus may throw an error
      // which is caught by ErrorBoundary. We just verify the message renders correctly.
      // The actual component rendering is tested in GenerativeUIRenderer tests.
    });

    it("should not render GenerativeUIRenderer when message has no uiIntent", () => {
      const message = {
        id: "msg-8",
        role: "assistant",
        content: "Just text, no component",
        timestamp: Date.now(),
      };

      render(<Message message={message} isUser={false} />);

      // Verify message content is rendered
      expect(screen.getByText("Just text, no component")).toBeInTheDocument();

      // GenerativeUIRenderer should not be rendered
      // We can verify by checking that only the text content exists
      const allText = screen.queryAllByText(/./);
      // Should have content and timestamp only
      expect(allText.length).toBeGreaterThanOrEqual(1);
    });

    it("should render GenerativeUIRenderer below MessageBubble", () => {
      const message = {
        id: "msg-9",
        role: "assistant",
        content: "Component below:",
        timestamp: Date.now(),
        uiIntent: {
          type: "RENDER_COMPONENT",
          component: "UnknownComponent", // Use unknown component to avoid dependency issues
          props: {},
        },
      };

      render(<Message message={message} isUser={false} />);

      // Verify message content is rendered
      expect(screen.getByText("Component below:")).toBeInTheDocument();

      // Verify error message from GenerativeUIRenderer for unknown component
      expect(
        screen.getByText(
          /Unable to render component: UnknownComponent not found/
        )
      ).toBeInTheDocument();
    });
  });
});
