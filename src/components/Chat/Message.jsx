import React from 'react';
import GenerativeUIRenderer from './GenerativeUIRenderer';

const MessageBubble = ({ content, isUser }) => {
  return (
    <div
      style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.assistantBubble)
      }}
    >
      {content}
    </div>
  );
};

const Message = ({ message, isUser }) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div
      style={{
        ...styles.messageContainer,
        ...(isUser ? styles.userMessageContainer : styles.assistantMessageContainer)
      }}
    >
      <div style={styles.messageContent}>
        <MessageBubble content={message.content} isUser={isUser} />
        <div
          style={{
            ...styles.timestamp,
            ...(isUser ? styles.userTimestamp : styles.assistantTimestamp)
          }}
        >
          {formatTimestamp(message.timestamp)}
        </div>
        {message.uiIntent && (
          <GenerativeUIRenderer uiIntent={message.uiIntent} />
        )}
      </div>
    </div>
  );
};

const styles = {
  messageContainer: {
    display: 'flex',
    marginBottom: '16px',
    width: '100%'
  },
  userMessageContainer: {
    justifyContent: 'flex-end'
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start'
  },
  messageContent: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '70%',
    gap: '4px'
  },
  bubble: {
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '15px',
    lineHeight: '1.5',
    wordWrap: 'break-word',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
  },
  userBubble: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    borderBottomRightRadius: '4px'
  },
  assistantBubble: {
    background: '#2d3748',
    color: '#e2e8f0',
    border: '1px solid #4a5568',
    borderBottomLeftRadius: '4px'
  },
  timestamp: {
    fontSize: '11px',
    color: '#a0aec0',
    paddingLeft: '4px',
    paddingRight: '4px'
  },
  userTimestamp: {
    textAlign: 'right'
  },
  assistantTimestamp: {
    textAlign: 'left'
  }
};

export default Message;
