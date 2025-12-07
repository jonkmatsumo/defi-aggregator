import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import Message from '../../../src/components/Chat/Message';

describe('Message', () => {
  // **Feature: chat-agent-ui, Property 8: Role-based message styling**
  // **Validates: Requirements 3.3**
  describe('Property 8: Role-based message styling', () => {
    it('should apply different styling based on message role', () => {
      fc.assert(
        fc.property(
          // Generate random message content (non-whitespace)
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1000000000000, max: Date.now() }),
          fc.boolean(),
          (content, timestamp, isUser) => {
            const message = {
              id: `msg-${timestamp}`,
              role: isUser ? 'user' : 'assistant',
              content,
              timestamp
            };

            const { container } = render(
              <Message message={message} isUser={isUser} />
            );

            // Get the message container
            // eslint-disable-next-line testing-library/no-node-access
            const messageContainer = container.firstChild;
            
            // Verify the message container has different alignment based on role
            // This is the key visual distinction we can reliably test
            const justifyContent = messageContainer.style.justifyContent;
            const expectedAlignment = isUser ? 'flex-end' : 'flex-start';
            
            // eslint-disable-next-line jest/no-conditional-expect
            expect(justifyContent).toBe(expectedAlignment);
            
            // Verify content is rendered
            expect(screen.getByText((textContent, element) => {
              return element.textContent === content;
            })).toBeInTheDocument();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 9: Text content rendering**
  // **Validates: Requirements 3.4**
  describe('Property 9: Text content rendering', () => {
    it('should render text content in the message bubble for any assistant message', () => {
      fc.assert(
        fc.property(
          // Generate random text content (non-whitespace)
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1000000000000, max: Date.now() }),
          (content, timestamp) => {
            const message = {
              id: `msg-${timestamp}`,
              role: 'assistant',
              content,
              timestamp
            };

            render(<Message message={message} isUser={false} />);

            // Verify the text content is rendered (use flexible matcher for whitespace)
            expect(screen.getByText((textContent, element) => {
              return element.textContent === content;
            })).toBeInTheDocument();

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should render user message with correct styling', () => {
      const message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, this is a user message',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={message} isUser={true} />);

      // Check that message is right-aligned
      // eslint-disable-next-line testing-library/no-node-access
      const messageContainer = container.firstChild;
      expect(messageContainer.style.justifyContent).toBe('flex-end');

      // Check that content is rendered
      expect(screen.getByText('Hello, this is a user message')).toBeInTheDocument();
    });

    it('should render assistant message with correct styling', () => {
      const message = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hello, this is an assistant message',
        timestamp: Date.now()
      };

      const { container } = render(<Message message={message} isUser={false} />);

      // Check that message is left-aligned
      // eslint-disable-next-line testing-library/no-node-access
      const messageContainer = container.firstChild;
      expect(messageContainer.style.justifyContent).toBe('flex-start');

      // Check that content is rendered
      expect(screen.getByText('Hello, this is an assistant message')).toBeInTheDocument();
    });

    it('should display timestamp', () => {
      const timestamp = new Date('2024-01-15T10:30:00').getTime();
      const message = {
        id: 'msg-3',
        role: 'user',
        content: 'Test message',
        timestamp
      };

      render(<Message message={message} isUser={true} />);

      // Check that timestamp is displayed (format: HH:MM AM/PM)
      const expectedTime = new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    it('should render message bubble with text content', () => {
      const message = {
        id: 'msg-4',
        role: 'assistant',
        content: 'This is the message content',
        timestamp: Date.now()
      };

      render(<Message message={message} isUser={false} />);

      // Verify the content is in the document
      expect(screen.getByText('This is the message content')).toBeInTheDocument();
    });

    it('should handle long messages', () => {
      const longContent = 'This is a very long message that should wrap properly within the message bubble. '.repeat(5).trim();
      const message = {
        id: 'msg-5',
        role: 'user',
        content: longContent,
        timestamp: Date.now()
      };

      render(<Message message={message} isUser={true} />);

      // Verify long content is rendered
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle special characters in content', () => {
      const message = {
        id: 'msg-6',
        role: 'assistant',
        content: 'Special chars: <>&"\'',
        timestamp: Date.now()
      };

      render(<Message message={message} isUser={false} />);

      // Verify special characters are rendered
      expect(screen.getByText('Special chars: <>&"\'')).toBeInTheDocument();
    });
  });
});
