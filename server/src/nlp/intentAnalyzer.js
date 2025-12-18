import { EntityExtractor } from './entityExtractor.js';

const INTENT_PATTERNS = [
  {
    key: 'price_query',
    regex: /(price|cost|value|worth|quote|btc|eth|\$)/i,
    tools: ['get_crypto_price'],
  },
  {
    key: 'gas_query',
    regex: /(gas|fee|gwei|transaction fee|network fee)/i,
    tools: ['get_gas_prices'],
  },
  {
    key: 'lending_query',
    regex: /(lend|borrow|apy|yield|interest|rate)/i,
    tools: ['get_lending_rates'],
  },
  {
    key: 'swap_query',
    regex: /(swap|trade|exchange|dex)/i,
    tools: ['get_crypto_price', 'get_gas_prices'],
  },
];

export class IntentAnalyzer {
  constructor(options = {}) {
    this.entityExtractor =
      options.entityExtractor || new EntityExtractor(options);
  }

  analyze(userMessage = '') {
    const text = userMessage || '';
    const lower = text.toLowerCase();

    // Determine primary intent
    let primary = 'general_info';
    let confidence = 0.3;
    let suggestedTools = [];

    for (const pattern of INTENT_PATTERNS) {
      if (pattern.regex.test(lower)) {
        primary = pattern.key;
        confidence = 0.8;
        suggestedTools = pattern.tools;
        break;
      }
    }

    // Ambiguity: if no intent strongly matched or message is very short
    const ambiguous = primary === 'general_info' || text.trim().length < 5;

    const entities = this.entityExtractor.extract(text);

    return {
      primary,
      confidence,
      suggested_tools: suggestedTools,
      entities,
      ambiguous,
    };
  }
}
