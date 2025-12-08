import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import ChatInterface from '../../../src/components/Chat/ChatInterface';
import MockAgentService from '../../../src/services/mockAgentService';
import { AgentServiceClient } from '../../../src/services/agentServiceClient';

// Mock both services
jest.mock('../../../src/services/mockAgentService');
jest.mock('../../../src/services/agentServiceClient');

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock AgentServiceClient to fail connection and fallback to MockAgentService
    AgentServiceClient.mockImplementation(() => ({
      connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
      disconnect: jest.fn(),
      onConnectionChange: jest.fn(),
      onError: jest.fn(),
      sendMessage: jest.fn().mockRejectedValue(new Error('Connection closed')),
      isAgentServiceClient: true // Add identifier for fallback logic
    }));
    
    // Default mock implementation with zero delay for fast tests
    // Return immediately without any delay
    MockAgentService.mockImplementation(() => ({
      sendMessage: jest.fn().mockResolvedValue({
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Response',
        timestamp: Date.now()
      })
    }));
  });

  afterEach(() => {
    cleanup();
  });

  // **Feature: chat-agent-ui, Property 2: User message addition**
  // **Validates: Requirements 2.1**
  describe('Property 2: User message addition', () => {
    it('should add user message with correct role and content for any non-empty text input', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random non-empty strings (excluding whitespace-only)
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => s.trim().length > 0),
          async (inputText) => {
            const { container } = render(<ChatInterface />);

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const input = container.querySelector('.chat-input');
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const sendButton = container.querySelector('.chat-send-button');

            // Type the message
            fireEvent.change(input, { target: { value: inputText } });

            // Submit the message
            fireEvent.click(sendButton);

            // Wait for the user message to appear (should be immediate)
            await waitFor(() => {
              // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
              const messageBubbles = container.querySelectorAll('.message-bubble.user');
              const found = Array.from(messageBubbles).some(bubble => 
                bubble.textContent === inputText
              );
              expect(found).toBe(true);
            }, { timeout: 500 });

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 3: Input field clearing after submission**
  // **Validates: Requirements 2.2**
  describe('Property 3: Input field clearing after submission', () => {
    it('should clear input field after any message submission', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random non-empty strings
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => s.trim().length > 0),
          async (inputText) => {
            const { container } = render(<ChatInterface />);

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const input = container.querySelector('.chat-input');
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const sendButton = container.querySelector('.chat-send-button');

            // Type the message
            fireEvent.change(input, { target: { value: inputText } });

            // Verify input has the value
            expect(input.value).toBe(inputText);

            // Submit the message
            fireEvent.click(sendButton);

            // Input should be cleared immediately (synchronous operation)
            expect(input.value).toBe('');

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 7: Assistant message addition**
  // **Validates: Requirements 3.2**
  describe('Property 7: Assistant message addition', () => {
    it('should add assistant message to stream for any agent response', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random user messages and assistant responses
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (userMessage, assistantResponse) => {
            // Mock the agent service to return our test response immediately
            MockAgentService.mockImplementation(() => ({
              sendMessage: jest.fn().mockResolvedValue({
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                role: 'assistant',
                content: assistantResponse,
                timestamp: Date.now()
              })
            }));

            const { container } = render(<ChatInterface />);

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const input = container.querySelector('.chat-input');
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const sendButton = container.querySelector('.chat-send-button');

            // Send user message
            fireEvent.change(input, { target: { value: userMessage } });
            fireEvent.click(sendButton);

            // Wait for assistant response to appear (should be fast with mocked service)
            await waitFor(() => {
              // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
              const assistantBubbles = container.querySelectorAll('.message-bubble.assistant');
              const found = Array.from(assistantBubbles).some(bubble => 
                bubble.textContent === assistantResponse
              );
              expect(found).toBe(true);
            }, { timeout: 500 });

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: chat-agent-ui, Property 10: Error message display**
  // **Validates: Requirements 3.5**
  describe('Property 10: Error message display', () => {
    it('should display error message for any error condition', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random error messages
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => s.trim().length > 0),
          fc.string({ minLength: 5, maxLength: 100 }),
          async (userMessage, errorMessage) => {
            // Mock the agent service to throw an error immediately
            MockAgentService.mockImplementation(() => ({
              sendMessage: jest.fn().mockRejectedValue(new Error(errorMessage))
            }));

            const { container } = render(<ChatInterface />);

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const input = container.querySelector('.chat-input');
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
            const sendButton = container.querySelector('.chat-send-button');

            // Send user message
            fireEvent.change(input, { target: { value: userMessage } });
            fireEvent.click(sendButton);

            // Wait for error message to appear (should be fast with mocked service)
            await waitFor(() => {
              // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
              const errorBubbles = container.querySelectorAll('.message-bubble.assistant');
              const found = Array.from(errorBubbles).some(bubble => 
                bubble.textContent.toLowerCase().includes('sorry, i encountered an error')
              );
              expect(found).toBe(true);
            }, { timeout: 500 });

            cleanup();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle full flow: user input → loading → agent response → display', async () => {
      // Mock agent service with a specific response (immediate resolution)
      const mockResponse = {
        id: 'test-response-id',
        role: 'assistant',
        content: 'Test agent response',
        timestamp: Date.now()
      };

      // Update the mock to return the expected response for fallback service
      MockAgentService.mockImplementation(() => ({
        sendMessage: jest.fn().mockResolvedValue(mockResponse)
      }));

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Type and send message
      fireEvent.change(input, { target: { value: 'Hello agent' } });
      fireEvent.click(sendButton);

      // Input should be cleared
      expect(input).toHaveValue('');

      // Input should be disabled during loading
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();

      // Wait for response (should be from fallback service with [Offline Mode] prefix)
      await waitFor(() => {
        expect(screen.getByText('[Offline Mode] Test agent response')).toBeInTheDocument();
      });

      // Input should be enabled again
      expect(input).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });

    it('should handle error: service error → error message display', async () => {
      // Mock agent service to throw error immediately
      MockAgentService.mockImplementation(() => ({
        sendMessage: jest.fn().mockRejectedValue(new Error('Network error'))
      }));

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send message
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/sorry, i encountered an error/i)).toBeInTheDocument();
      });

      // Should be able to send another message
      expect(input).not.toBeDisabled();
    });

    it('should prevent empty input submission', () => {
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Try to submit empty input
      fireEvent.click(sendButton);

      // No messages should be displayed (only welcome message)
      const welcomeMessage = screen.getByText(/welcome/i);
      expect(welcomeMessage).toBeInTheDocument();

      // Try whitespace-only input
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(sendButton);

      // Still only welcome message
      const messages = screen.queryAllByText((content, element) => {
        return element.classList.contains('message-content');
      });
      expect(messages.length).toBe(0);
    });

    it('should maintain conversation history across multiple messages', async () => {
      const mockSendMessage = jest.fn((message) => 
        Promise.resolve({
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: `Response to: ${message}`,
          timestamp: Date.now()
        })
      );

      MockAgentService.mockImplementation(() => ({
        sendMessage: mockSendMessage
      }));

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send first message
      fireEvent.change(input, { target: { value: 'First message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('[Offline Mode] Response to: First message')).toBeInTheDocument();
      });

      // Send second message
      fireEvent.change(input, { target: { value: 'Second message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('[Offline Mode] Response to: Second message')).toBeInTheDocument();
      });

      // Verify both messages are still visible
      const allMessages = screen.getAllByText(/First message|Second message|Response to:/);
      expect(allMessages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant messages
    });

    it('should render UI intents when included in agent response', async () => {
      // Mock agent service with UI intent (immediate resolution)
      MockAgentService.mockImplementation(() => ({
        sendMessage: jest.fn().mockResolvedValue({
          id: 'test-response-id',
          role: 'assistant',
          content: 'Here are the current gas prices:',
          timestamp: Date.now(),
          uiIntent: {
            type: 'RENDER_COMPONENT',
            component: 'NetworkStatus',
            props: {}
          }
        })
      }));

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Send message
      fireEvent.change(input, { target: { value: 'Show gas prices' } });
      fireEvent.click(sendButton);

      // Wait for response with UI intent (should have [Offline Mode] prefix)
      await waitFor(() => {
        expect(screen.getByText('[Offline Mode] Here are the current gas prices:')).toBeInTheDocument();
      });

      // The GenerativeUIRenderer should attempt to render the component
      // (The actual component rendering is tested in GenerativeUIRenderer tests)
    });
  });
});
