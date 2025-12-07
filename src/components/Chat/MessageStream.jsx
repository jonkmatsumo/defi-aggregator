import React, { useEffect, useRef } from 'react';
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
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.welcomeIcon}>💬</div>
          <h2 style={styles.welcomeTitle}>Welcome to DeFi Chat</h2>
          <p style={styles.welcomeText}>
            I can help you with swaps, checking gas prices, viewing your assets, and more.
          </p>
          <p style={styles.welcomeText}>
            What would you like to do?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.messageList}>
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isUser={message.role === 'user'}
          />
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingBubble}>
              <div style={styles.loadingDots}>
                <span style={styles.dot}></span>
                <span style={styles.dot}></span>
                <span style={styles.dot}></span>
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

const styles = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column'
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 'min-content'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    padding: '40px 20px'
  },
  welcomeIcon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  welcomeTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  welcomeText: {
    fontSize: '16px',
    color: '#a0aec0',
    lineHeight: '1.6',
    maxWidth: '500px',
    margin: '8px 0'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '16px',
    width: '100%'
  },
  loadingBubble: {
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: '12px',
    borderBottomLeftRadius: '4px',
    padding: '12px 20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
  },
  loadingDots: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#667eea',
    animation: 'pulse 1.4s ease-in-out infinite',
    animationDelay: 'calc(var(--i) * 0.2s)'
  }
};

// Add CSS animation for loading dots
const styleSheet = document.styleSheets[0];
const keyframes = `
  @keyframes pulse {
    0%, 60%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    30% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

try {
  styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
} catch (e) {
  // Animation already exists or browser doesn't support
}

// Apply animation delay to dots
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .loading-dot:nth-child(1) { animation-delay: 0s; }
    .loading-dot:nth-child(2) { animation-delay: 0.2s; }
    .loading-dot:nth-child(3) { animation-delay: 0.4s; }
  `;
  document.head.appendChild(style);
}

export default MessageStream;
