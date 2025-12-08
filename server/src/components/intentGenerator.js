import { logger } from '../utils/logger.js';

export class ComponentIntentGenerator {
  constructor() {
    this.patterns = new Map();
    this.initializePatterns();
  }

  initializePatterns() {
    // Pattern-based component intent generation for backward compatibility
    this.patterns.set(/gas.*price/i, {
      component: 'GasPriceDisplay',
      propsGenerator: (toolResults) => ({
        prices: toolResults?.result?.prices || {},
        network: toolResults?.result?.network || 'ethereum'
      })
    });

    logger.info('Component intent patterns initialized', { 
      patternCount: this.patterns.size 
    });
  }

  generateIntent(toolResults, userMessage, llmResponse) {
    logger.debug('Generating component intent', { 
      hasToolResults: !!toolResults,
      messageLength: userMessage?.length || 0,
      responseLength: llmResponse?.length || 0
    });

    // Analyze tool results for component needs
    if (toolResults && Array.isArray(toolResults)) {
      const intents = [];
      
      for (const toolResult of toolResults) {
        const intent = this.generateIntentFromToolResult(toolResult);
        if (intent) {
          intents.push(intent);
        }
      }
      
      if (intents.length > 0) {
        return intents;
      }
    }

    // Fallback to pattern-based matching
    return this.generatePatternBasedIntent(userMessage);
  }

  generateIntentFromToolResult(toolResult) {
    if (!toolResult.success) {
      return null;
    }

    switch (toolResult.toolName) {
    case 'get_gas_prices':
      return {
        component: 'GasPriceDisplay',
        props: {
          prices: toolResult.result.prices,
          network: toolResult.result.network,
          timestamp: toolResult.result.timestamp
        }
      };
      
    default:
      logger.debug('No component intent for tool', { toolName: toolResult.toolName });
      return null;
    }
  }

  generatePatternBasedIntent(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
      return null;
    }

    for (const [pattern, config] of this.patterns.entries()) {
      if (pattern.test(userMessage)) {
        logger.debug('Pattern matched for component intent', { 
          pattern: pattern.toString(),
          component: config.component 
        });
        
        return [{
          component: config.component,
          props: config.propsGenerator ? config.propsGenerator() : {}
        }];
      }
    }

    return null;
  }
}