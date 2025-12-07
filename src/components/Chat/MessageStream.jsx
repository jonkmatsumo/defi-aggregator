import { useEffect, useRef } from 'react';
import Message from './Message';

const MessageStream = ({ messages, isLoading }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Empty state with welcome message
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="message-stream">
        <div className="empty-state">
          <div className="welcome-icon">💬</div>
          <h2 className="welcome-title">Welcome to DeFi Chat</h2>
          <p className="welcome-text">
            I can help you with swaps, checking gas prices, viewing your assets, and more.
          </p>
          <p className="welcome-text">
            What would you like to do?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-stream">
      <div className="message-list">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isUser={message.role === 'user'}
          />
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-container">
            <div className="loading-bubble">
              <div className="loading-dots">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </div>
            </div>
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageStream;
