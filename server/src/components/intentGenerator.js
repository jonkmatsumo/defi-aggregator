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
        prices: toolResult.result?.gasPrices || toolResult.result?.prices || {},
        network: toolResult.result?.network || 'ethereum',
        transactionType: toolResult.result?.transaction_type || toolResult.result?.transactionType,
        timestamp: toolResult.result?.timestamp
      })
    });

    this.toolComponentMap.set('get_token_balance', {
      component: 'YourAssets',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResult) => ({
        balances: toolResult.result?.tokens || toolResult.result?.balances || [],
        address: toolResult.result?.address,
        network: toolResult.result?.network,
        totalUSD: toolResult.result?.totalUSD,
        timestamp: toolResult.result?.timestamp,
        dataFreshness: toolResult.dataFreshness
      })
    });

    this.toolComponentMap.set('get_lending_rates', {
      component: 'LendingSection',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResult) => ({
        rates: toolResult.result?.rates || toolResult.result?.protocols || [],
        protocols: toolResult.result?.protocols || [],
        token: toolResult.result?.token,
        timestamp: toolResult.result?.timestamp
      })
    });

    this.toolComponentMap.set('get_crypto_price', {
      component: 'PriceDisplay',
      type: 'RENDER_COMPONENT',
      propsGenerator: (toolResult) => ({
        symbol: toolResult.result?.symbol,
        price: toolResult.result?.price,
        currency: toolResult.result?.currency,
        change24h: toolResult.result?.change_24h,
        volume24h: toolResult.result?.volume_24h,
        marketCap: toolResult.result?.market_cap,
        timestamp: toolResult.result?.timestamp,
        source: toolResult.result?.source
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

      const contextualIntents = this.generateContextualIntents(userMessage, llmResponse);
      this.mergeIntents(intents, contextualIntents);
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
      const contextualIntents = this.generateContextualIntents(userMessage, llmResponse);
      this.mergeIntents(llmBasedIntents, contextualIntents);
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

  generateContextualIntents(userMessage, llmResponse) {
    const intents = [];
    const lowerMsg = (userMessage || '').toLowerCase();
    const lowerResp = (llmResponse || '').toLowerCase();

    const mentionsSwap = lowerMsg.includes('swap') || lowerResp.includes('swap') || lowerResp.includes('exchange');
    const mentionsGas = lowerMsg.includes('gas') || lowerResp.includes('gas') || lowerResp.includes('fee');
    const mentionsLending = lowerMsg.includes('lend') || lowerResp.includes('lend') || lowerResp.includes('apy') || lowerResp.includes('yield');
    const mentionsPrice = lowerMsg.includes('price') || lowerResp.includes('price') || lowerResp.includes('market');

    if (mentionsSwap) {
      intents.push({ type: 'RENDER_COMPONENT', component: 'TokenSwap', props: { suggestedFromQuery: userMessage } });
    }
    if (mentionsGas) {
      intents.push({ type: 'RENDER_COMPONENT', component: 'NetworkStatus', props: {} });
    }
    if (mentionsLending) {
      intents.push({ type: 'RENDER_COMPONENT', component: 'LendingSection', props: {} });
    }
    if (mentionsPrice) {
      intents.push({ type: 'RENDER_COMPONENT', component: 'PriceDisplay', props: {} });
    }

    return intents;
  }

  mergeIntents(target = [], additions = []) {
    if (!additions || additions.length === 0) return;
    for (const intent of additions) {
      const exists = target.find(i => i.component === intent.component && i.type === intent.type);
      if (!exists) target.push(intent);
    }
  }
}