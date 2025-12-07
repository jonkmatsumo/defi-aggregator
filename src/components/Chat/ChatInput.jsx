import React from 'react';

const ChatInput = ({ value, onChange, onSubmit, disabled }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleSendClick = () => {
    onSubmit();
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        style={{
          ...styles.input,
          ...(disabled && styles.inputDisabled)
        }}
      />
      <button
        onClick={handleSendClick}
        disabled={disabled}
        style={{
          ...styles.sendButton,
          ...(disabled && styles.sendButtonDisabled)
        }}
      >
        Send
      </button>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
    borderTop: '1px solid #4a5568',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    background: '#1a202c',
    border: '1px solid #4a5568',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '16px',
    color: '#e2e8f0',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  },
  inputDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  sendButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease'
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  }
};

export default ChatInput;
