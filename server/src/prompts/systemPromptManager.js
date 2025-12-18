import { logger } from '../utils/logger.js';

/**
 * SystemPromptManager handles the creation and management of system prompts
 * for LLM interactions, including tool injection and context-specific prompts.
 */
export class SystemPromptManager {
  constructor(config = {}) {
    this.prompts = new Map();
    this.config = {
      defaultContext: 'defi_assistant',
      includeToolExamples: true,
      includeEducationalGuidance: true,
      ...config,
    };

    this.initializePrompts();

    logger.info('SystemPromptManager initialized', {
      defaultContext: this.config.defaultContext,
      promptCount: this.prompts.size,
    });
  }

  /**
   * Initialize default system prompts for different contexts
   */
  initializePrompts() {
    // Main DeFi assistant system prompt
    this.prompts.set('defi_assistant', {
      identity: {
        role: 'DeFi Assistant',
        expertise: [
          'cryptocurrency markets and pricing',
          'blockchain networks and gas fees',
          'DeFi protocols and lending rates',
          'token swapping and DEX operations',
          'yield farming and liquidity provision',
        ],
        personality: 'knowledgeable, helpful, and educational',
      },
      corePrompt: this.createDeFiAssistantPrompt(),
      toolGuidelines: this.createToolUsageGuidelines(),
      responsePatterns: this.createResponsePatterns(),
      lastUpdated: Date.now(),
    });

    // Fallback prompt for error scenarios
    this.prompts.set('fallback', {
      identity: {
        role: 'Assistant',
        expertise: ['general assistance'],
        personality: 'helpful and apologetic',
      },
      corePrompt: this.createFallbackPrompt(),
      toolGuidelines: '',
      responsePatterns: this.createBasicResponsePatterns(),
      lastUpdated: Date.now(),
    });
  }

  /**
   * Create the comprehensive DeFi assistant system prompt
   */
  createDeFiAssistantPrompt() {
    return `You are a knowledgeable DeFi (Decentralized Finance) assistant with expertise in cryptocurrency, blockchain networks, and DeFi protocols. Your role is to help users understand and interact with the decentralized finance ecosystem.

## Your Identity and Expertise

You are an expert in:
- Cryptocurrency markets and real-time price analysis
- Blockchain networks and transaction fee optimization
- DeFi protocols including lending, borrowing, and yield farming
- Token swapping and decentralized exchange operations
- Risk assessment and portfolio management in DeFi

## Your Communication Style

- Provide accurate, current information using available tools
- Explain complex DeFi concepts in accessible language
- Include educational context to help users understand implications
- Maintain a helpful, professional, and encouraging tone
- Format data clearly and suggest relevant actions when appropriate

## Core Responsibilities

1. **Real-Time Data Provision**: Always use tools for current market data, prices, and network conditions
2. **Educational Guidance**: Explain the context and implications of data you provide
3. **Risk Awareness**: Help users understand potential risks and best practices
4. **Actionable Insights**: Provide specific, actionable recommendations when appropriate`;
  }

  /**
   * Create tool usage guidelines section
   */
  createToolUsageGuidelines() {
    return `## Tool Usage Guidelines

### When to Use Tools

**ALWAYS use tools when users ask for:**
- Current cryptocurrency prices or market data
- Gas fees or transaction costs for any blockchain
- Lending rates or APY information from DeFi protocols
- Real-time network status or congestion information

### Tool Selection Logic

- **get_crypto_price**: For questions about cryptocurrency prices, market caps, or price changes
- **get_gas_prices**: For questions about transaction fees, network costs, or optimal gas settings
- **get_lending_rates**: For questions about earning yields, borrowing costs, or protocol comparisons

### Parameter Guidelines

- Use clear, standard symbols (BTC, ETH, USDC) for cryptocurrency queries
- Specify networks explicitly (ethereum, polygon, arbitrum) for gas price queries
- Include relevant protocols (aave, compound, maker) for lending rate queries
- Always include market data context when available

### Tool Result Integration

- Present numerical data clearly with proper formatting
- Explain what the data means in practical terms
- Provide context about market conditions or network status
- Suggest follow-up actions or related information when helpful`;
  }

  /**
   * Create response pattern guidelines
   */
  createResponsePatterns() {
    return `## Response Patterns

### Data Presentation
- Format prices with appropriate currency symbols and precision
- Use clear units for gas prices (gwei, USD cost estimates)
- Present percentage changes with context (24h, 7d trends)
- Include timestamps to indicate data freshness

### Educational Content
- Explain technical terms when first mentioned
- Provide context about why certain metrics matter
- Suggest best practices for transaction timing or protocol selection
- Include relevant warnings about risks or market volatility

### Error Handling
- If tools fail, explain what went wrong in simple terms
- Suggest alternative approaches or manual verification methods
- Maintain helpful tone even when data is unavailable
- Provide general guidance when specific data cannot be retrieved

### UI Integration
- Suggest relevant UI components when data visualization would be helpful
- Recommend interactive elements for complex operations
- Consider user workflow when suggesting next steps`;
  }

  /**
   * Create fallback prompt for error scenarios
   */
  createFallbackPrompt() {
    return `You are a helpful assistant. I apologize, but I'm currently experiencing some technical difficulties that prevent me from accessing real-time data or using my specialized tools.

I can still help with:
- General information about DeFi concepts and protocols
- Explanations of cryptocurrency and blockchain terminology
- Best practices for DeFi operations and risk management
- Educational content about decentralized finance

For current prices, gas fees, or real-time data, I recommend checking reliable sources like CoinGecko, Etherscan, or official protocol websites until my tools are restored.`;
  }

  /**
   * Create basic response patterns for fallback scenarios
   */
  createBasicResponsePatterns() {
    return `## Response Guidelines
- Acknowledge limitations clearly and apologetically
- Provide helpful general information when possible
- Suggest alternative sources for real-time data
- Maintain educational value even without tools`;
  }

  /**
   * Get system prompt for a specific context
   */
  getSystemPrompt(context = null) {
    const promptContext = context || this.config.defaultContext;
    const promptData = this.prompts.get(promptContext);

    if (!promptData) {
      logger.warn('System prompt not found, using fallback', {
        requestedContext: promptContext,
        availableContexts: Array.from(this.prompts.keys()),
      });
      return (
        this.prompts.get('fallback')?.corePrompt ||
        'You are a helpful assistant.'
      );
    }

    return promptData.corePrompt;
  }

  /**
   * Format system prompt with tool definitions injected
   */
  formatPromptWithTools(toolDefinitions, context = null) {
    const promptContext = context || this.config.defaultContext;
    const promptData = this.prompts.get(promptContext);

    if (!promptData) {
      logger.warn(
        'System prompt not found for tool formatting, using fallback',
        {
          requestedContext: promptContext,
        }
      );
      return this.getSystemPrompt('fallback');
    }

    let fullPrompt = promptData.corePrompt;

    // Add tool guidelines if available
    if (promptData.toolGuidelines) {
      fullPrompt += '\n\n' + promptData.toolGuidelines;
    }

    // Add tool definitions if provided
    if (toolDefinitions && toolDefinitions.length > 0) {
      fullPrompt += '\n\n## Available Tools\n\n';
      fullPrompt +=
        'You have access to the following tools for real-time data:\n\n';

      for (const tool of toolDefinitions) {
        fullPrompt += `### ${tool.name}\n`;
        fullPrompt += `${tool.description}\n\n`;

        if (tool.parameters && tool.parameters.properties) {
          fullPrompt += 'Parameters:\n';
          for (const [paramName, paramDef] of Object.entries(
            tool.parameters.properties
          )) {
            // Clean parameter name for display
            const cleanParamName = paramName.trim() || 'parameter';
            const required = tool.parameters.required?.includes(paramName)
              ? ' (required)'
              : ' (optional)';
            fullPrompt += `- ${cleanParamName}${required}: ${paramDef.description || 'No description'}\n`;

            if (paramDef.examples && Array.isArray(paramDef.examples)) {
              fullPrompt += `  Examples: ${paramDef.examples.join(', ')}\n`;
            }
          }
          fullPrompt += '\n';
        }
      }
    }

    // Add response patterns if available
    if (promptData.responsePatterns) {
      fullPrompt += '\n\n' + promptData.responsePatterns;
    }

    logger.debug('System prompt formatted with tools', {
      context: promptContext,
      toolCount: toolDefinitions?.length || 0,
      promptLength: fullPrompt.length,
    });

    return fullPrompt;
  }

  /**
   * Update system prompt for a specific context
   */
  updatePrompt(context, promptContent) {
    if (typeof promptContent === 'string') {
      // Simple string update
      this.prompts.set(context, {
        identity: { role: 'Custom', expertise: [], personality: 'helpful' },
        corePrompt: promptContent,
        toolGuidelines: '',
        responsePatterns: '',
        lastUpdated: Date.now(),
      });
    } else {
      // Structured update
      const existing = this.prompts.get(context) || {};
      this.prompts.set(context, {
        ...existing,
        ...promptContent,
        lastUpdated: Date.now(),
      });
    }

    logger.info('System prompt updated', {
      context,
      promptLength: this.prompts.get(context).corePrompt.length,
    });
  }

  /**
   * Get prompt metadata for a context
   */
  getPromptMetadata(context = null) {
    const promptContext = context || this.config.defaultContext;
    const promptData = this.prompts.get(promptContext);

    if (!promptData) {
      return null;
    }

    return {
      context: promptContext,
      identity: promptData.identity,
      lastUpdated: promptData.lastUpdated,
      hasToolGuidelines: !!promptData.toolGuidelines,
      hasResponsePatterns: !!promptData.responsePatterns,
      promptLength: promptData.corePrompt.length,
    };
  }

  /**
   * List all available prompt contexts
   */
  getAvailableContexts() {
    return Array.from(this.prompts.keys());
  }

  /**
   * Validate that a prompt contains required sections
   */
  validatePromptCompleteness(context = null) {
    const promptContext = context || this.config.defaultContext;
    const promptData = this.prompts.get(promptContext);

    if (!promptData) {
      return {
        valid: false,
        missing: ['prompt_data'],
        context: promptContext,
      };
    }

    const missing = [];

    // Check required sections
    if (!promptData.corePrompt || promptData.corePrompt.length < 100) {
      missing.push('core_prompt');
    }

    if (!promptData.identity || !promptData.identity.role) {
      missing.push('identity_role');
    }

    if (
      !promptData.identity ||
      !promptData.identity.expertise ||
      promptData.identity.expertise.length === 0
    ) {
      missing.push('expertise_areas');
    }

    // Check for DeFi-specific content in main prompt
    if (promptContext === 'defi_assistant') {
      const prompt = promptData.corePrompt.toLowerCase();
      if (
        !prompt.includes('defi') &&
        !prompt.includes('decentralized finance')
      ) {
        missing.push('defi_context');
      }

      if (!prompt.includes('cryptocurrency') && !prompt.includes('crypto')) {
        missing.push('cryptocurrency_expertise');
      }

      if (!prompt.includes('blockchain')) {
        missing.push('blockchain_expertise');
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      context: promptContext,
      promptLength: promptData.corePrompt.length,
      hasIdentity: !!promptData.identity,
      hasToolGuidelines: !!promptData.toolGuidelines,
      hasResponsePatterns: !!promptData.responsePatterns,
    };
  }

  /**
   * Check if tool instructions are properly included
   */
  validateToolInstructions(context = null) {
    const promptContext = context || this.config.defaultContext;
    const promptData = this.prompts.get(promptContext);

    if (!promptData) {
      return {
        valid: false,
        missing: ['prompt_data'],
        context: promptContext,
      };
    }

    const missing = [];
    const fullContent = (
      promptData.corePrompt +
      ' ' +
      (promptData.toolGuidelines || '')
    ).toLowerCase();

    // Check for tool usage instructions
    if (!fullContent.includes('tool') && !fullContent.includes('function')) {
      missing.push('tool_references');
    }

    if (
      !fullContent.includes('real-time') &&
      !fullContent.includes('current')
    ) {
      missing.push('real_time_data_instructions');
    }

    if (
      !fullContent.includes('price') &&
      !fullContent.includes('gas') &&
      !fullContent.includes('lending')
    ) {
      missing.push('specific_tool_guidance');
    }

    return {
      valid: missing.length === 0,
      missing,
      context: promptContext,
      hasToolGuidelines: !!promptData.toolGuidelines,
      toolGuidelinesLength: promptData.toolGuidelines?.length || 0,
    };
  }

  /**
   * Check if expertise areas are properly specified
   */
  validateExpertiseSpecification(context = null) {
    const promptContext = context || this.config.defaultContext;
    const promptData = this.prompts.get(promptContext);

    if (!promptData) {
      return {
        valid: false,
        missing: ['prompt_data'],
        context: promptContext,
      };
    }

    const missing = [];

    // Check identity expertise
    if (
      !promptData.identity ||
      !promptData.identity.expertise ||
      promptData.identity.expertise.length === 0
    ) {
      missing.push('expertise_list');
    }

    // Check for DeFi-specific expertise
    if (promptContext === 'defi_assistant' && promptData.identity?.expertise) {
      const expertise = promptData.identity.expertise.join(' ').toLowerCase();

      if (
        !expertise.includes('cryptocurrency') &&
        !expertise.includes('crypto')
      ) {
        missing.push('cryptocurrency_expertise');
      }

      if (
        !expertise.includes('defi') &&
        !expertise.includes('decentralized finance')
      ) {
        missing.push('defi_expertise');
      }

      if (!expertise.includes('blockchain')) {
        missing.push('blockchain_expertise');
      }
    }

    // Check if expertise is mentioned in core prompt
    const corePrompt = promptData.corePrompt.toLowerCase();
    if (!corePrompt.includes('expert') && !corePrompt.includes('expertise')) {
      missing.push('expertise_in_prompt');
    }

    return {
      valid: missing.length === 0,
      missing,
      context: promptContext,
      expertiseCount: promptData.identity?.expertise?.length || 0,
      expertise: promptData.identity?.expertise || [],
    };
  }
}
