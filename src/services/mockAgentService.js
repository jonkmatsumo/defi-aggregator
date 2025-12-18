/**
 * Mock Agent Service
 *
 * Simulates an agent backend for testing the chat UI without LLM integration.
 * Provides pattern-based responses with UI intents for component rendering.
 */

/**
 * Generate a unique ID for messages
 */
function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simulate network delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine UI intent based on message content
 */
function determineUIIntent(message) {
  const lowerMessage = message.toLowerCase();

  // Gas/fees pattern
  if (lowerMessage.includes("gas") || lowerMessage.includes("fee")) {
    return {
      type: "RENDER_COMPONENT",
      component: "NetworkStatus",
      props: {},
    };
  }

  // Swap/trade pattern
  if (
    lowerMessage.includes("swap") ||
    lowerMessage.includes("exchange") ||
    lowerMessage.includes("trade")
  ) {
    return {
      type: "RENDER_COMPONENT",
      component: "TokenSwap",
      props: {},
    };
  }

  // Lend/APY pattern
  if (
    lowerMessage.includes("lend") ||
    lowerMessage.includes("lending") ||
    lowerMessage.includes("apy") ||
    lowerMessage.includes("earn")
  ) {
    return {
      type: "RENDER_COMPONENT",
      component: "LendingSection",
      props: {},
    };
  }

  // Balance/assets pattern
  if (
    lowerMessage.includes("balance") ||
    lowerMessage.includes("asset") ||
    lowerMessage.includes("portfolio")
  ) {
    return {
      type: "RENDER_COMPONENT",
      component: "YourAssets",
      props: {},
    };
  }

  // Perpetual/leverage pattern
  if (
    lowerMessage.includes("perpetual") ||
    lowerMessage.includes("perp") ||
    lowerMessage.includes("leverage")
  ) {
    return {
      type: "RENDER_COMPONENT",
      component: "PerpetualsSection",
      props: {},
    };
  }

  // Activity/history pattern
  if (
    lowerMessage.includes("activity") ||
    lowerMessage.includes("history") ||
    lowerMessage.includes("transaction")
  ) {
    return {
      type: "RENDER_COMPONENT",
      component: "RecentActivity",
      props: {},
    };
  }

  // No matching pattern
  return null;
}

/**
 * Generate response text based on message content
 */
function generateResponse(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("gas") || lowerMessage.includes("fee")) {
    return "Here are the current gas prices:";
  }

  if (
    lowerMessage.includes("swap") ||
    lowerMessage.includes("exchange") ||
    lowerMessage.includes("trade")
  ) {
    return "I can help you swap tokens:";
  }

  if (
    lowerMessage.includes("lend") ||
    lowerMessage.includes("lending") ||
    lowerMessage.includes("apy") ||
    lowerMessage.includes("earn")
  ) {
    return "Here are the current lending rates:";
  }

  if (
    lowerMessage.includes("balance") ||
    lowerMessage.includes("asset") ||
    lowerMessage.includes("portfolio")
  ) {
    return "Here are your current assets:";
  }

  if (
    lowerMessage.includes("perpetual") ||
    lowerMessage.includes("perp") ||
    lowerMessage.includes("leverage")
  ) {
    return "You can open leveraged positions here:";
  }

  if (
    lowerMessage.includes("activity") ||
    lowerMessage.includes("history") ||
    lowerMessage.includes("transaction")
  ) {
    return "Here's your recent activity:";
  }

  // Default response
  return "I can help you with swaps, checking gas prices, viewing your assets, and more. What would you like to do?";
}

/**
 * AgentService Interface
 *
 * Abstract interface for agent communication.
 * Can be implemented by both mock and real LLM services.
 */
class AgentService {
  /**
   * Send a message to the agent and receive a response
   * @param {string} message - The user's message
   * @param {Array} history - Array of previous ChatMessage objects
   * @returns {Promise<Object>} Agent response with id, role, content, timestamp, and optional uiIntent
   */
  async sendMessage(message, history) {
    throw new Error("sendMessage must be implemented by subclass");
  }
}

/**
 * MockAgentService
 *
 * Mock implementation of AgentService for testing and development.
 * Uses pattern matching to simulate intelligent responses.
 */
class MockAgentService extends AgentService {
  /**
   * Create a new MockAgentService
   * @param {Object} options - Configuration options
   * @param {number} options.minDelay - Minimum delay in ms (default: 200)
   * @param {number} options.maxDelay - Maximum delay in ms (default: 400)
   */
  constructor(options = {}) {
    super();
    this.minDelay = options.minDelay !== undefined ? options.minDelay : 200;
    this.maxDelay = options.maxDelay !== undefined ? options.maxDelay : 400;
  }

  /**
   * Send a message and receive a mock response
   * @param {string} message - The user's message
   * @param {Array} history - Array of previous ChatMessage objects (maintained for future use)
   * @returns {Promise<Object>} Mock agent response
   */
  async sendMessage(message, history = []) {
    // Simulate network delay - configurable for testing
    if (this.maxDelay > 0) {
      const delayMs =
        this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
      await delay(delayMs);
    }

    // Generate response based on message content
    const content = generateResponse(message);
    const uiIntent = determineUIIntent(message);

    // Build response object
    const response = {
      id: generateId(),
      role: "assistant",
      content: content,
      timestamp: Date.now(),
    };

    // Only include uiIntent if one was determined
    if (uiIntent) {
      response.uiIntent = uiIntent;
    }

    return response;
  }
}

// Export the service class and interface
export { AgentService, MockAgentService };
export default MockAgentService;
