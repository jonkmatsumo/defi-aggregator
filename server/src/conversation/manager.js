import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { ConversationError } from '../utils/errors.js';

export class ConversationManager {
  constructor(llmInterface, toolRegistry, componentIntentGenerator, options = {}) {
    this.llmInterface = llmInterface;
    this.toolRegistry = toolRegistry;
    this.componentIntentGenerator = componentIntentGenerator;
    this.sessions = new Map(); // sessionId -> ConversationSession
    
    // Configuration options
    this.options = {
      maxHistoryLength: options.maxHistoryLength || 100,
      sessionTimeoutMs: options.sessionTimeoutMs || 30 * 60 * 1000, // 30 minutes
      cleanupIntervalMs: options.cleanupIntervalMs || 5 * 60 * 1000, // 5 minutes
      ...options
    };

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.options.cleanupIntervalMs);

    logger.info('ConversationManager initialized', {
      maxHistoryLength: this.options.maxHistoryLength,
      sessionTimeoutMs: this.options.sessionTimeoutMs
    });
  }

  async processMessage(sessionId, userMessage, messageHistory = []) {
    try {
      logger.info('Processing message', { 
        sessionId, 
        messageLength: userMessage.length,
        historyLength: messageHistory.length
      });

      // Get or create session
      let session = this.getSession(sessionId);
      if (!session) {
        session = this.createSession(sessionId);
        logger.info('Created new conversation session', { sessionId });
      }

      // Update session activity
      session.lastActivity = Date.now();

      // Add user message to session history
      const userMessageObj = {
        id: uuidv4(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      };

      this.addMessageToSession(session, userMessageObj);

      // Prepare messages for LLM (combine session history with provided history)
      const messages = this.prepareMessagesForLLM(session, messageHistory);

      // Get available tools
      const availableTools = this.toolRegistry.getToolDefinitions();

      // Call LLM with message processing pipeline
      const llmResponse = await this.llmInterface.generateResponse(
        messages,
        availableTools,
        { sessionId }
      );

      logger.debug('LLM response received', { 
        sessionId,
        hasToolCalls: !!(llmResponse.toolCalls && llmResponse.toolCalls.length > 0),
        responseLength: llmResponse.content?.length || 0
      });

      // Execute tool calls if present
      let toolResults = [];
      let finalResponse = llmResponse;
      
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        toolResults = await this.executeToolCalls(sessionId, llmResponse.toolCalls);
        
        // Add tool call message to session history
        const toolCallMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: llmResponse.content,
          timestamp: Date.now(),
          toolCalls: llmResponse.toolCalls
        };
        this.addMessageToSession(session, toolCallMessage);

        // Add tool results as tool messages
        for (const toolResult of toolResults) {
          const toolMessage = {
            id: uuidv4(),
            role: 'tool',
            content: JSON.stringify(toolResult.result),
            timestamp: Date.now(),
            tool_call_id: toolResult.toolName, // Use tool name as ID
            name: toolResult.toolName
          };
          this.addMessageToSession(session, toolMessage);
        }

        // Get updated messages for follow-up LLM call
        const updatedMessages = this.prepareMessagesForLLM(session, messageHistory);
        
        // Call LLM again with tool results to get final response
        finalResponse = await this.llmInterface.generateResponse(
          updatedMessages,
          availableTools,
          { sessionId, followUp: true }
        );

        logger.debug('Follow-up LLM response after tool execution', {
          sessionId,
          toolCount: toolResults.length,
          finalResponseLength: finalResponse.content?.length || 0
        });
      }

      // Generate component intents based on final response
      const uiIntents = this.componentIntentGenerator.generateIntent(
        toolResults,
        userMessage,
        finalResponse.content
      );

      // Create final assistant response
      const assistantResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: finalResponse.content,
        timestamp: Date.now(),
        uiIntents: uiIntents || undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        streaming: false
      };

      // Add assistant response to session history
      this.addMessageToSession(session, assistantResponse);

      logger.info('Message processed successfully', {
        sessionId,
        responseId: assistantResponse.id,
        hasUiIntents: !!(assistantResponse.uiIntents),
        hasToolResults: !!(assistantResponse.toolResults),
        toolCount: toolResults.length
      });

      return assistantResponse;

    } catch (error) {
      logger.error('Error processing message', {
        sessionId,
        error: error.message,
        stack: error.stack
      });

      // Create error response
      const errorResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your message. Please try again.',
        timestamp: Date.now(),
        error: {
          type: error.constructor.name,
          message: error.message
        }
      };

      // Try to add error response to session if session exists
      const session = this.getSession(sessionId);
      if (session) {
        this.addMessageToSession(session, errorResponse);
      }

      return errorResponse;
    }
  }

  async executeToolCalls(sessionId, toolCalls) {
    const results = [];

    logger.debug('Executing tool calls', { 
      sessionId, 
      toolCount: toolCalls.length,
      tools: toolCalls.map(tc => tc.name)
    });

    for (const toolCall of toolCalls) {
      try {
        const result = await this.toolRegistry.executeTool(
          toolCall.name,
          toolCall.parameters || {}
        );
        results.push(result);

        logger.debug('Tool executed', {
          sessionId,
          toolName: toolCall.name,
          success: result.success,
          executionTime: result.executionTime
        });

      } catch (error) {
        logger.error('Tool execution failed', {
          sessionId,
          toolName: toolCall.name,
          error: error.message
        });

        results.push({
          toolName: toolCall.name,
          parameters: toolCall.parameters || {},
          result: null,
          executionTime: 0,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  prepareMessagesForLLM(session, additionalHistory = []) {
    // Combine session history with additional history, avoiding duplicates
    const allMessages = [...additionalHistory];
    
    // Add session messages that aren't already in additional history
    for (const sessionMessage of session.messages) {
      const isDuplicate = additionalHistory.some(msg => 
        msg.id === sessionMessage.id || 
        (msg.content === sessionMessage.content && 
         msg.role === sessionMessage.role &&
         Math.abs(msg.timestamp - sessionMessage.timestamp) < 1000)
      );
      
      if (!isDuplicate) {
        allMessages.push(sessionMessage);
      }
    }

    // Sort by timestamp to maintain chronological order
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Limit history length to prevent token overflow
    if (allMessages.length > this.options.maxHistoryLength) {
      const excess = allMessages.length - this.options.maxHistoryLength;
      allMessages.splice(0, excess);
      
      logger.debug('Trimmed conversation history', {
        sessionId: session.sessionId,
        removedMessages: excess,
        remainingMessages: allMessages.length
      });
    }

    // Convert to LLM format (include tool calls and results for context)
    return allMessages.map(msg => {
      const llmMessage = {
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      };

      // Include tool calls if present (for assistant messages)
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        llmMessage.tool_calls = msg.toolCalls;
      }

      // Include tool results if present (for assistant messages)
      if (msg.toolResults && msg.toolResults.length > 0) {
        // Add tool results as system messages for LLM context
        llmMessage.tool_results = msg.toolResults;
      }

      return llmMessage;
    });
  }

  addMessageToSession(session, message) {
    session.messages.push(message);
    session.lastActivity = Date.now();

    // Trim session history if it gets too long
    if (session.messages.length > this.options.maxHistoryLength) {
      const excess = session.messages.length - this.options.maxHistoryLength;
      session.messages.splice(0, excess);
      
      logger.debug('Trimmed session history', {
        sessionId: session.sessionId,
        removedMessages: excess,
        remainingMessages: session.messages.length
      });
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  createSession(sessionId, userId = null) {
    if (this.sessions.has(sessionId)) {
      throw new ConversationError(`Session ${sessionId} already exists`);
    }

    const session = {
      sessionId,
      userId,
      messages: [],
      context: {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
      toolState: {}
    };
    
    this.sessions.set(sessionId, session);
    
    logger.info('Created conversation session', {
      sessionId,
      userId,
      totalSessions: this.sessions.size
    });
    
    return session;
  }

  deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info('Deleted conversation session', {
        sessionId,
        remainingSessions: this.sessions.size
      });
    }
    return deleted;
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.options.sessionTimeoutMs) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.deleteSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.info('Cleaned up expired sessions', {
        expiredCount: expiredSessions.length,
        remainingSessions: this.sessions.size
      });
    }
  }

  getSessionStats() {
    const now = Date.now();
    let totalMessages = 0;
    let activeSessions = 0;

    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;
      if (now - session.lastActivity < this.options.sessionTimeoutMs) {
        activeSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalMessages,
      averageMessagesPerSession: this.sessions.size > 0 ? totalMessages / this.sessions.size : 0
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.sessions.clear();
    
    logger.info('ConversationManager destroyed');
  }
}