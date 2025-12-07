import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import MessageStream from '../../../src/components/Chat/MessageStream';

// Mock scrollIntoView since it's not implemented in jsdom
Element.prototype.scrollIntoView = jest.fn();

describe('MessageStream', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    Element.prototype.scrollIntoView.mockClear();
  });

  // **Feature: chat-agent-ui, Property 5: Auto-scroll to newest message**
  // **Validates: Requirements 2.4**
  describe('Property 5: Auto-scroll to newest message', () => {
    it('should trigger scroll behavior when messages are added', () => {
      fc.assert(
        fc.property(
          // Generate random message arrays (1-10 messages)
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              role: fc.constantFrom('user', 'assistant'),
              content: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
              timestamp: fc.integer({ min: 1000000000000, max: Date.now() })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (messages) => {
            // Ensure unique IDs
            const uniqueMessages = messages.map((msg, index) => ({
              ...msg,
              id: `${msg.id}-${index}`
            }));

            const { rerender } = render(
              <MessageStream messages={uniqueMessages} isLoading={false} />
            );

            // scrollIntoView should be called after initial render
            expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
            
            // Clear the mock to test adding a new message
            Element.prototype.scrollIntoView.mockClear();

            // Add a new message
            const newMessage = {
              id: `new-msg-${Date.now()}`,
              role: 'assistant',
              content: 'New message',
              timestamp: Date.now()
            };

            rerender(
              <MessageStream messages={[...uniqueMessages, newMessage]} isLoading={false} />
            );

            // scrollIntoView should be called again when messages change
            expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 6: Loading indicator display**
  // **Validates: Requirements 3.1**
  describe('Property 6: Loading indicator display', () => {
    it('should display loading indicator when isLoading is true', () => {
      fc.assert(
        fc.property(
          // Generate random message arrays (0-10 messages)
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              role: fc.constantFrom('user', 'assistant'),
              content: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
              timestamp: fc.integer({ min: 1000000000000, max: Date.now() })
            }),
            { minLength: 0, maxLength: 10 }
          ),
          fc.boolean(),
          (messages, isLoading) => {
            // Ensure unique IDs
            const uniqueMessages = messages.map((msg, index) => ({
              ...msg,
              id: `${msg.id}-${index}`
            }));

            const { container } = render(
              <MessageStream messages={uniqueMessages} isLoading={isLoading} />
            );

            // Check for loading indicator using container query
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const loadingDots = container.querySelectorAll('.loading-dot');

            if (isLoading) {
              // Loading indicator should be present when isLoading is true (regardless of message count)
              // The component shows the message-list div (not the welcome state) when isLoading is true
              // eslint-disable-next-line jest/no-conditional-expect
              expect(loadingDots.length).toBe(3);
            } else {
              // Loading indicator should not be present when isLoading is false
              // eslint-disable-next-line jest/no-conditional-expect
              expect(loadingDots.length).toBe(0);
            }

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should show welcome message when messages array is empty and not loading', () => {
      render(<MessageStream messages={[]} isLoading={false} />);

      expect(screen.getByText('Welcome to DeFi Chat')).toBeInTheDocument();
      expect(screen.getByText(/I can help you with swaps, checking gas prices/)).toBeInTheDocument();
      expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
    });

    it('should render messages in order', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          timestamp: 1000000000000
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Second message',
          timestamp: 1000000001000
        },
        {
          id: 'msg-3',
          role: 'user',
          content: 'Third message',
          timestamp: 1000000002000
        }
      ];

      render(<MessageStream messages={messages} isLoading={false} />);

      // Verify all messages are rendered
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();

      // Verify they appear in the correct order in the DOM
      const messageElements = screen.getAllByText(/message/i);
      expect(messageElements[0].textContent).toContain('First');
      expect(messageElements[1].textContent).toContain('Second');
      expect(messageElements[2].textContent).toContain('Third');
    });

    it('should display loading indicator when isLoading is true', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: Date.now()
        }
      ];

      const { container } = render(<MessageStream messages={messages} isLoading={true} />);

      // Check for loading indicator elements
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const loadingDots = container.querySelectorAll('.loading-dot');
      expect(loadingDots.length).toBe(3); // Should have 3 loading dots
    });

    it('should not display loading indicator when isLoading is false', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: Date.now()
        }
      ];

      const { container } = render(<MessageStream messages={messages} isLoading={false} />);

      // Check that loading indicator is not present
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const loadingDots = container.querySelectorAll('.loading-dot');
      expect(loadingDots.length).toBe(0);
    });

    it('should not show welcome message when there are messages', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now()
        }
      ];

      render(<MessageStream messages={messages} isLoading={false} />);

      expect(screen.queryByText('Welcome to DeFi Chat')).not.toBeInTheDocument();
    });

    it('should not show welcome message when loading', () => {
      render(<MessageStream messages={[]} isLoading={true} />);

      expect(screen.queryByText('Welcome to DeFi Chat')).not.toBeInTheDocument();
    });

    it('should call scrollIntoView when messages change', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          timestamp: Date.now()
        }
      ];

      const { rerender } = render(<MessageStream messages={messages} isLoading={false} />);

      // Clear previous calls
      Element.prototype.scrollIntoView.mockClear();

      // Add a new message
      const updatedMessages = [
        ...messages,
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Second message',
          timestamp: Date.now()
        }
      ];

      rerender(<MessageStream messages={updatedMessages} isLoading={false} />);

      // scrollIntoView should be called with smooth behavior
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('should call scrollIntoView when isLoading changes', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: Date.now()
        }
      ];

      const { rerender } = render(<MessageStream messages={messages} isLoading={false} />);

      // Clear previous calls
      Element.prototype.scrollIntoView.mockClear();

      // Change loading state
      rerender(<MessageStream messages={messages} isLoading={true} />);

      // scrollIntoView should be called
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });
});
