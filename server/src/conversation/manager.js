import { v4 as uuidv4 } from 'uuid';
import { logger, logError } from '../utils/logger.js';
import { ConversationError, classifyError } from '../utils/errors.js';
import { agentResponseFormatter } from '../utils/agentResponseFormatter.js';
import { IntentAnalyzer } from '../nlp/intentAnalyzer.js';

export class ConversationManager {
  constructor(llmInterface, toolRegistry, componentIntentGenerator, options = {}) {
    this.llmInterface = llmInterface;
    this.toolRegistry = toolRegistry;
    this.componentIntentGenerator = componentIntentGenerator;
    this.systemPromptManager = options.systemPromptManager || null;
    this.intentAnalyzer = options.intentAnalyzer || new IntentAnalyzer();
    this.sessions = new Map(); // sessionId -> ConversationSession
    this.toolResultCache = new Map(); // cacheKey -> { result, cachedAt }
    
    // Configuration options
    this.options = {
      maxHistoryLength: options.maxHistoryLength || 100,
      sessionTimeoutMs: options.sessionTimeoutMs || 30 * 60 * 1000, // 30 minutes
      cleanupIntervalMs: options.cleanupIntervalMs || 5 * 60 * 1000, // 5 minutes
      toolResultTTL: options.toolResultTTL || 2 * 60 * 1000, // 2 minutes
      maxToolResults: options.maxToolResults || 50,
      ...options
    };

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredToolResults();
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

      // Analyze user intent to inform downstream handling
      const intentAnalysis = this.intentAnalyzer.analyze(userMessage);

      // Get available tools
      const availableTools = this.toolRegistry.getToolDefinitions();

      // Prepare system prompt with tool integration
      let systemPrompt = null;
      if (this.systemPromptManager) {
        systemPrompt = this.systemPromptManager.formatPromptWithTools(availableTools, 'defi_assistant');
        logger.debug('System prompt prepared', {
          sessionId,
          promptLength: systemPrompt.length,
          toolCount: availableTools.length
        });
      }

      // Call LLM with message processing pipeline
      const llmResponse = await this.llmInterface.generateResponse(
        messages,
        availableTools,
        { sessionId, systemPrompt }
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
          { sessionId, followUp: true, systemPrompt }
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

      // Format tool results for user-friendly display
      const formattedToolResults = toolResults.length > 0 
        ? agentResponseFormatter.formatToolResults(toolResults)
        : undefined;

      // Create final assistant response
      const assistantResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: finalResponse.content,
        timestamp: Date.now(),
        uiIntents: uiIntents || undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        formattedResults: formattedToolResults,
        streaming: false,
        context: {
          intent: intentAnalysis,
          toolsUsed: toolResults.map(tr => tr.toolName)
        }
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
      const errorClassification = classifyError(error);
      logError(error, {
        sessionId,
        messageLength: userMessage.length,
        historyLength: messageHistory.length,
        classification: errorClassification
      });

      // Create user-friendly error response
      const userFriendlyMessage = this.getUserFriendlyErrorMessage(error, errorClassification);
      
      const errorResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: userFriendlyMessage.content,
        timestamp: Date.now(),
        error: {
          type: error.constructor.name,
          message: error.message,
          code: userFriendlyMessage.code,
          classification: errorClassification,
          retryable: userFriendlyMessage.retryable,
          suggestions: userFriendlyMessage.suggestions
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
        const parameters = toolCall.parameters || {};
        const cacheKey = this.generateToolCacheKey(sessionId, toolCall.name, parameters);

        // Serve from cache if fresh
        const cached = this.toolResultCache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < this.options.toolResultTTL) {
          logger.debug('Using cached tool result', { sessionId, toolName: toolCall.name });
          results.push({
            ...cached.result,
            fromCache: true,
            dataFreshness: 'cached'
          });
          continue;
        }

        const result = await this.toolRegistry.executeTool(
          toolCall.name,
          parameters
        );
        results.push(result);

        if (result.success) {
          this.toolResultCache.set(cacheKey, { result, cachedAt: Date.now() });
          this.enforceToolCacheLimit();
        }

        logger.debug('Tool executed', {
          sessionId,
          toolName: toolCall.name,
          success: result.success,
          executionTime: result.executionTime
        });

      } catch (error) {
        const errorClassification = classifyError(error);
        logError(error, {
          sessionId,
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          classification: errorClassification
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

    // Intelligent truncation: drop oldest non-tool messages first
    const trimmedMessages = this.trimMessages(allMessages, this.options.maxHistoryLength, session.sessionId);

    // Convert to LLM format (include tool calls and results for context)
    return trimmedMessages.map(msg => {
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

  getMetrics() {
    return this.getSessionStats();
  }

  trimMessages(messages, limit, sessionId) {
    if (messages.length <= limit) return messages;

    const trimmed = [...messages];
    while (trimmed.length > limit) {
      const idx = trimmed.findIndex(m => m.role !== 'tool' && !(m.toolCalls && m.toolCalls.length > 0));
      if (idx === -1) {
        trimmed.shift();
      } else {
        trimmed.splice(idx, 1);
      }
    }

    logger.debug('Trimmed conversation history', {
      sessionId,
      removedMessages: messages.length - trimmed.length,
      remainingMessages: trimmed.length
    });

    return trimmed;
  }

  generateToolCacheKey(sessionId, toolName, parameters) {
    return `${sessionId}:${toolName}:${JSON.stringify(parameters)}`;
  }

  enforceToolCacheLimit() {
    if (this.toolResultCache.size <= this.options.maxToolResults) return;
    const excess = this.toolResultCache.size - this.options.maxToolResults;
    for (let i = 0; i < excess; i++) {
      const oldestKey = this.toolResultCache.keys().next().value;
      if (oldestKey) this.toolResultCache.delete(oldestKey);
    }
  }

  cleanupExpiredToolResults() {
    const now = Date.now();
    let removed = 0;
    for (const [key, value] of this.toolResultCache.entries()) {
      if (now - value.cachedAt > this.options.toolResultTTL) {
        this.toolResultCache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug('Cleaned expired tool results', { removed, remaining: this.toolResultCache.size });
    }
  }

  analyzeUserIntent(userMessage) {
    const lower = (userMessage || '').toLowerCase();
    const intents = {
      price_query: /price|cost|value|worth|btc|eth|\$/.test(lower),
      gas_query: /gas|fee|gwei|transaction fee|network fee/.test(lower),
      lending_query: /lend|borrow|apy|yield|interest|rate/.test(lower),
      swap_query: /swap|trade|exchange|dex/.test(lower)
    };

    const primary = Object.entries(intents).find(([_, matched]) => matched)?.[0] || 'general_info';
    const confidence = primary === 'general_info' ? 0.3 : 0.8;
    const suggested_tools = [];
    if (primary === 'price_query') suggested_tools.push('get_crypto_price');
    if (primary === 'gas_query') suggested_tools.push('get_gas_prices');
    if (primary === 'lending_query') suggested_tools.push('get_lending_rates');
    if (primary === 'swap_query') suggested_tools.push('get_crypto_price', 'get_gas_prices');

    return { primary, confidence, suggested_tools };
  }

  /**
   * Generate user-friendly error message based on error type
   * @param {Error} error - The error that occurred
   * @param {Object} classification - Error classification
   * @returns {Object} User-friendly error details
   */
  getUserFriendlyErrorMessage(error, classification) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorType = classification?.type || 'unknown';

    // LLM-specific errors
    if (errorType === 'llm' || errorMessage.includes('api') || errorMessage.includes('openai')) {
      return {
        content: 'I\'m having trouble connecting to my language processing service right now. Please try again in a moment.',
        code: 'LLM_ERROR',
        retryable: true,
        suggestions: [
          'Wait a few seconds and try again',
          'If the problem persists, the service may be experiencing high demand'
        ]
      };
    }

    // Tool execution errors
    if (errorType === 'tool' || errorMessage.includes('tool')) {
      return {
        content: 'I encountered an issue while retrieving the data you requested. Let me know if you\'d like me to try again.',
        code: 'TOOL_ERROR',
        retryable: true,
        suggestions: [
          'Try asking for the same information again',
          'You can also try asking in a different way'
        ]
      };
    }

    // Rate limiting errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('429') || errorMessage.includes('too many')) {
      return {
        content: 'I\'m receiving too many requests right now. Please wait a moment before trying again.',
        code: 'RATE_LIMIT',
        retryable: true,
        suggestions: [
          'Wait about 30 seconds before trying again',
          'Try asking fewer questions at once'
        ]
      };
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        content: 'I\'m having trouble connecting to external services. This could be a temporary issue.',
        code: 'NETWORK_ERROR',
        retryable: true,
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments'
        ]
      };
    }

    // Validation errors
    if (errorType === 'validation' || errorMessage.includes('invalid') || errorMessage.includes('validation')) {
      return {
        content: 'I couldn\'t understand some of the information in your request. Could you please rephrase or check the details?',
        code: 'VALIDATION_ERROR',
        retryable: false,
        suggestions: [
          'Make sure wallet addresses are valid Ethereum addresses',
          'Check that token symbols are correct (e.g., ETH, BTC, USDC)',
          'Verify network names are supported (e.g., ethereum, polygon)'
        ]
      };
    }

    // Session errors
    if (errorType === 'session' || errorMessage.includes('session')) {
      return {
        content: 'There was an issue with your conversation session. Please try starting a new conversation.',
        code: 'SESSION_ERROR',
        retryable: false,
        suggestions: [
          'Refresh the page to start a new session',
          'Clear your browser cache if the issue persists'
        ]
      };
    }

    // Default error response
    return {
      content: 'I apologize, but I encountered an unexpected error processing your message. Please try again.',
      code: 'UNKNOWN_ERROR',
      retryable: true,
      suggestions: [
        'Try asking your question again',
        'If the problem continues, please try again later'
      ]
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