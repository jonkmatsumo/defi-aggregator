import GenerativeUIRenderer from "./GenerativeUIRenderer";

const MessageBubble = ({ content, isUser }) => {
  return (
    <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
      {content}
    </div>
  );
};

const Message = ({ message, isUser }) => {
  const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`message-container ${isUser ? "user" : "assistant"}`}>
      <div className="message-content">
        <MessageBubble content={message.content} isUser={isUser} />
        <div className={`message-timestamp ${isUser ? "user" : "assistant"}`}>
          {formatTimestamp(message.timestamp)}
        </div>
        {message.uiIntent && (
          <GenerativeUIRenderer uiIntent={message.uiIntent} />
        )}
      </div>
    </div>
  );
};

export default Message;
