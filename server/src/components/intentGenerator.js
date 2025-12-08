import { logger } from '../utils/logger.js';

export class ComponentIntentGenerator {
  constructor() {
    this.patterns = new Map();
    this.toolComponentMap = new Map();
    this.initializePatterns();
    this.initializeToolComponentMap();
  }

  initializePatterns() {
    // Pattern-based component intent generation for backward compatibility
    // These patterns match the mockAgentService behavior
    this.patterns.set(/gas.*price|fee/i, {
      component: 'NetworkStatus',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResults) => ({
        prices: toolResults?.result?.prices || {},
        network: toolResults?.result?.network || 'ethereum'
      })
    });

    this.patterns.set(/swap|exchange|trade/i, {
      component: 'TokenSwap',
      type: 'RENDER_COMPONENT',
      propsGenerator: () => ({})
    });

    this.patterns.set(/lend|lending|apy|earn/i, {
      component: 'LendingSection',
      type: 'RENDER_COMPONENT',
      propsGenerator: () => ({})
    });

    this.patterns.set(/balance|asset|portfolio/i, {
      component: 'YourAssets',
      type: 'RENDER_COMPONENT',
      propsGenerator: () => ({})
    });

    this.patterns.set(/perpetual|perp|leverage/i, {
      component: 'PerpetualsSection',
      type: 'RENDER_COMPONENT',
      propsGenerator: () => ({})
    });

    this.patterns.set(/activity|history|transaction/i, {
      component: 'RecentActivity',
      type: 'RENDER_COMPONENT',
      propsGenerator: () => ({})
    });

    logger.info('Component intent patterns initialized', { 
      patternCount: this.patterns.size 
    });
  }

  initializeToolComponentMap() {
    // Map tool names to their corresponding UI components
    this.toolComponentMap.set('get_gas_prices', {
      component: 'NetworkStatus',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResult) => ({
        prices: toolResult.result?.prices || {},
        network: toolResult.result?.network || 'ethereum',
        timestamp: toolResult.result?.timestamp
      })
    });

    this.toolComponentMap.set('get_token_balance', {
      component: 'YourAssets',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResult) => ({
        balances: toolResult.result?.balances || [],
        address: toolResult.result?.address,
        timestamp: toolResult.result?.timestamp
      })
    });

    this.toolComponentMap.set('get_lending_rates', {
      component: 'LendingSection',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResult) => ({
        rates: toolResult.result?.rates || [],
        protocols: toolResult.result?.protocols || [],
        timestamp: toolResult.result?.timestamp
      })
    });

    logger.info('Tool component mappings initialized', { 
      toolCount: this.toolComponentMap.size 
    });
  }

  generateIntent(toolResults, userMessage, llmResponse) {
    logger.debug('Generating component intent', { 
      hasToolResults: !!toolResults,
      toolResultsLength: Array.isArray(toolResults) ? toolResults.length : 0,
      messageLength: userMessage?.length || 0,
      responseLength: llmResponse?.length || 0
    });

    // Analyze tool results for component needs
    if (toolResults && Array.isArray(toolResults) && toolResults.length > 0) {
      const intents = [];
      
      for (const toolResult of toolResults) {
        const intent = this.generateIntentFromToolResult(toolResult);
        if (intent) {
          intents.push(intent);
        }
      }
      
      if (intents.length > 0) {
        logger.debug('Generated intents from tool results', { 
          intentCount: intents.length,
          components: intents.map(i => i.component)
        });
        return intents;
      }
    }

    // Analyze LLM response for component rendering needs
    const llmBasedIntents = this.analyzeResponseForComponents(llmResponse, userMessage);
    if (llmBasedIntents && llmBasedIntents.length > 0) {
      logger.debug('Generated intents from LLM response analysis', { 
        intentCount: llmBasedIntents.length,
        components: llmBasedIntents.map(i => i.component)
      });
      return llmBasedIntents;
    }

    // Fallback to pattern-based matching for backward compatibility
    const patternBasedIntents = this.generatePatternBasedIntent(userMessage);
    if (patternBasedIntents && patternBasedIntents.length > 0) {
      logger.debug('Generated intents from pattern matching', { 
        intentCount: patternBasedIntents.length,
        components: patternBasedIntents.map(i => i.component)
      });
      return patternBasedIntents;
    }

    logger.debug('No component intents generated');
    return null;
  }

  generateIntentFromToolResult(toolResult) {
    if (!toolResult || !toolResult.success) {
      return null;
    }

    const mapping = this.toolComponentMap.get(toolResult.toolName);
    if (!mapping) {
      logger.debug('No component mapping for tool', { toolName: toolResult.toolName });
      return null;
    }

    const props = mapping.propsGenerator ? mapping.propsGenerator(toolResult) : {};
    
    return {
      type: mapping.type,
      component: mapping.component,
      props: props
    };
  }

  analyzeResponseForComponents(llmResponse, userMessage) {
    if (!llmResponse || typeof llmResponse !== 'string') {
      return null;
    }

    const intents = [];
    const lowerResponse = llmResponse.toLowerCase();
    const lowerMessage = (userMessage || '').toLowerCase();

    // Analyze response content for component indicators
    // Look for mentions of specific financial concepts that should trigger components

    // Gas/network related
    if (lowerResponse.includes('gas') || lowerResponse.includes('network') || 
        lowerResponse.includes('fee') || lowerMessage.includes('gas')) {
      intents.push({
        type: 'RENDER_COMPONENT',
        component: 'NetworkStatus',
        props: {}
      });
    }

    // Trading/swap related
    if (lowerResponse.includes('swap') || lowerResponse.includes('trade') || 
        lowerResponse.includes('exchange') || lowerMessage.includes('swap')) {
      intents.push({
        type: 'RENDER_COMPONENT',
        component: 'TokenSwap',
        props: {}
      });
    }

    // Lending related
    if (lowerResponse.includes('lend') || lowerResponse.includes('apy') || 
        lowerResponse.includes('earn') || lowerResponse.includes('yield')) {
      intents.push({
        type: 'RENDER_COMPONENT',
        component: 'LendingSection',
        props: {}
      });
    }

    // Portfolio/balance related
    if (lowerResponse.includes('balance') || lowerResponse.includes('asset') || 
        lowerResponse.includes('portfolio') || lowerResponse.includes('wallet')) {
      intents.push({
        type: 'RENDER_COMPONENT',
        component: 'YourAssets',
        props: {}
      });
    }

    // Remove duplicates based on component name
    const uniqueIntents = intents.filter((intent, index, self) => 
      index === self.findIndex(i => i.component === intent.component)
    );

    return uniqueIntents.length > 0 ? uniqueIntents : null;
  }

  generatePatternBasedIntent(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
      return null;
    }

    const lowerMessage = userMessage.toLowerCase();

    for (const [pattern, config] of this.patterns.entries()) {
      if (pattern.test(lowerMessage)) {
        logger.debug('Pattern matched for component intent', { 
          pattern: pattern.toString(),
          component: config.component 
        });
        
        const props = config.propsGenerator ? config.propsGenerator() : {};
        
        return [{
          type: config.type,
          component: config.component,
          props: props
        }];
      }
    }

    return null;
  }

  // Support multiple component intents in a single response
  generateMultipleIntents(intentRequests) {
    if (!Array.isArray(intentRequests)) {
      return null;
    }

    const intents = [];
    
    for (const request of intentRequests) {
      if (request.component && typeof request.component === 'string') {
        intents.push({
          type: request.type || 'RENDER_COMPONENT',
          component: request.component,
          props: request.props || {}
        });
      }
    }

    return intents.length > 0 ? intents : null;
  }
}