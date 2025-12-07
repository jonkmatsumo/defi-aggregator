import React, { useState } from 'react';
import MessageStream from './MessageStream';
import ChatInput from './ChatInput';
import MockAgentService from '../../services/mockAgentService';
import './Chat.css';

const ChatInterface = () => {
  // Initialize state
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);

  // Instantiate mock agent service
  const [agentService] = useState(() => new MockAgentService());

  // Handle input change
  const handleInputChange = (value) => {
    setInputValue(value);
  };

  // Handle message submission
  const handleSubmit = async () => {
    // Validate input is not empty/whitespace
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      return; // Prevent submission of empty messages
    }

    // Create user message
    const userMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    // Add user message to messages array
    setMessages(prevMessages => [...prevMessages, userMessage]);

    // Clear input value
    setInputValue('');

    // Clear any previous errors
    setError(null);

    // Set loading state
    setIsLoading(true);

    try {
      // Call agent service with message and history
      const agentResponse = await agentService.sendMessage(
        userMessage.content,
        messages
      );

      // Add agent response to messages array
      setMessages(prevMessages => [...prevMessages, agentResponse]);
    } catch (err) {
      // Handle errors by setting error state
      setError(err.message || 'An error occurred while processing your message');
      
      // Add error message to chat stream
      const errorMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      // Set loading to false
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      {/* Message Stream */}
      <MessageStream messages={messages} isLoading={isLoading} />
      
      {/* Chat Input */}
      <ChatInput
        value={inputValue}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={isLoading}
      />
    </div>
  );
};

export default ChatInterface;
