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
    <div className="chat-input-container">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className="chat-input"
      />
      <button
        onClick={handleSendClick}
        disabled={disabled}
        className="chat-send-button"
      >
        Send
      </button>
    </div>
  );
};

export default ChatInput;
