import React, { useState, useEffect } from "react";
import MessageStream from "./MessageStream";
import ChatInput from "./ChatInput";
import { AgentServiceClient } from "../../services/agentServiceClient";
import MockAgentService from "../../services/mockAgentService";
import "./Chat.css";

const ChatInterface = () => {
  // Initialize state
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  // Determine server URL from environment or default to localhost
  const serverUrl =
    process.env.REACT_APP_GENAI_SERVER_URL || "ws://localhost:3001";

  // Instantiate agent service with fallback to mock
  const [agentService] = useState(() => {
    try {
      // Try to use real server first
      const client = new AgentServiceClient(serverUrl);

      // Set up connection status monitoring
      client.onConnectionChange(newState => {
        setConnectionStatus(newState);
      });

      // Set up error handling
      client.onError(error => {
        console.warn("AgentServiceClient error:", error);
        // Don't automatically fallback here, let individual requests handle it
      });

      return client;
    } catch (error) {
      console.warn(
        "Failed to initialize AgentServiceClient, using mock service:",
        error
      );
      return new MockAgentService();
    }
  });

  // Fallback service for when server is unavailable
  const [fallbackService] = useState(
    () => new MockAgentService({ minDelay: 0, maxDelay: 100 })
  );

  // Connect to server on component mount
  useEffect(() => {
    const connectToServer = async () => {
      if (agentService instanceof AgentServiceClient) {
        try {
          await agentService.connect();
        } catch (error) {
          console.warn("Failed to connect to server:", error);
          setConnectionStatus("error");
        }
      }
    };

    connectToServer();

    // Cleanup on unmount
    return () => {
      if (agentService instanceof AgentServiceClient) {
        agentService.disconnect();
      }
    };
  }, [agentService]);

  // Handle input change
  const handleInputChange = value => {
    setInputValue(value);
  };

  // Handle message submission with fallback support
  const handleSubmit = async () => {
    // Validate input is not empty/whitespace
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      return; // Prevent submission of empty messages
    }

    // Create user message
    const userMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: inputValue,
      timestamp: Date.now(),
    };

    // Add user message to messages array
    setMessages(prevMessages => [...prevMessages, userMessage]);

    // Clear input value
    setInputValue("");

    // Set loading state
    setIsLoading(true);

    try {
      let agentResponse;

      // Try primary service first
      try {
        agentResponse = await agentService.sendMessage(
          userMessage.content,
          messages
        );
      } catch (primaryError) {
        console.warn("Primary service failed, trying fallback:", primaryError);

        // If primary service fails and it's the real client, try fallback
        if (
          agentService.isAgentServiceClient ||
          agentService.constructor.name === "AgentServiceClient"
        ) {
          try {
            agentResponse = await fallbackService.sendMessage(
              userMessage.content,
              messages
            );

            // Add a note that we're using fallback
            agentResponse.content = `[Offline Mode] ${agentResponse.content}`;
          } catch (fallbackError) {
            console.warn("Fallback service also failed:", fallbackError);
            throw fallbackError;
          }
        } else {
          // If mock service fails, re-throw the error
          throw primaryError;
        }
      }

      // Add agent response to messages array
      setMessages(prevMessages => [...prevMessages, agentResponse]);
    } catch (err) {
      // Handle errors by adding error message to chat stream
      const errorMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: Date.now(),
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      // Set loading to false
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      {/* Connection Status Indicator */}
      {agentService instanceof AgentServiceClient && (
        <div className={`connection-status ${connectionStatus}`}>
          {connectionStatus === "connected" && "🟢 Connected to AI Server"}
          {connectionStatus === "connecting" && "🟡 Connecting..."}
          {connectionStatus === "reconnecting" && "🟡 Reconnecting..."}
          {connectionStatus === "disconnected" && "🔴 Disconnected"}
          {connectionStatus === "error" &&
            "🔴 Connection Error - Using Offline Mode"}
        </div>
      )}

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
