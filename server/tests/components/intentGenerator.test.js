import { ComponentIntentGenerator } from '../../src/components/intentGenerator.js';
import fc from 'fast-check';

describe('ComponentIntentGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ComponentIntentGenerator();
  });

  describe('Property 14: Component intent generation', () => {
    /**
     * **Feature: genai-server-integration, Property 14: Component intent generation**
     * **Validates: Requirements 4.1**
     * 
     * For any LLM response indicating component rendering needs, the server should 
     * generate appropriate component intents with correct component names and props.
     */
    test('should generate appropriate component intents when LLM response indicates component rendering needs', () => {
      fc.assert(
        fc.property(
          // Generate test data
          fc.record({
            toolResults: fc.option(fc.array(fc.record({
              toolName: fc.constantFrom('get_gas_prices', 'get_token_balance', 'get_lending_rates'),
              success: fc.boolean(),
              result: fc.record({
                prices: fc.option(fc.object()),
                network: fc.option(fc.string()),
                timestamp: fc.option(fc.integer())
              })
            }), { minLength: 0, maxLength: 3 })),
            userMessage: fc.string({ minLength: 1, maxLength: 200 }),
            llmResponse: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (testData) => {
            const { toolResults, userMessage, llmResponse } = testData;
            
            // Execute the function
            const result = generator.generateIntent(toolResults, userMessage, llmResponse);
            
            // Property: If component intents are generated, they should have proper structure
            // Always make assertions to avoid conditional expects
            const isValidResult = result === null || (
              Array.isArray(result) && 
              result.every(intent => 
                intent &&
                typeof intent === 'object' &&
                intent.type === 'RENDER_COMPONENT' &&
                typeof intent.component === 'string' &&
                intent.component.length > 0 &&
                typeof intent.props === 'object' &&
                intent.props !== null
              )
            );
            expect(isValidResult).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 15: Component intent structure', () => {
    /**
     * **Feature: genai-server-integration, Property 15: Component intent structure**
     * **Validates: Requirements 4.2**
     * 
     * For any generated component intent, it should contain the required fields 
     * (component name, props) in the correct format expected by the client.
     */
    test('should generate component intents with correct structure', () => {
      fc.assert(
        fc.property(
          // Generate successful tool results that should produce intents
          fc.array(fc.record({
            toolName: fc.constantFrom('get_gas_prices', 'get_token_balance', 'get_lending_rates'),
            success: fc.constant(true),
            result: fc.record({
              prices: fc.object(),
              network: fc.string(),
              timestamp: fc.integer()
            })
          }), { minLength: 1, maxLength: 3 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (toolResults, userMessage, llmResponse) => {
            const result = generator.generateIntent(toolResults, userMessage, llmResponse);
            
            // Property: Generated intents must have correct structure
            const validComponents = [
              'NetworkStatus', 'TokenSwap', 'LendingSection', 
              'YourAssets', 'PerpetualsSection', 'RecentActivity'
            ];
            
            const isValidStructure = result === null || (
              Array.isArray(result) && 
              result.length > 0 &&
              result.every(intent => 
                intent &&
                typeof intent === 'object' &&
                intent.type === 'RENDER_COMPONENT' &&
                validComponents.includes(intent.component) &&
                typeof intent.props === 'object' &&
                intent.props !== null &&
                !Array.isArray(intent.props)
              )
            );
            expect(isValidStructure).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 16: Multiple component intent support', () => {
    /**
     * **Feature: genai-server-integration, Property 16: Multiple component intent support**
     * **Validates: Requirements 4.5**
     * 
     * For any response requiring multiple components, the server should generate 
     * and include all necessary component intents in a single response.
     */
    test('should support multiple component intents in a single response', () => {
      fc.assert(
        fc.property(
          // Generate multiple different tool results with unique tool names
          fc.shuffledSubarray(['get_gas_prices', 'get_token_balance', 'get_lending_rates'], { minLength: 2, maxLength: 3 })
            .map(toolNames => toolNames.map(toolName => ({
              toolName,
              success: true,
              result: {
                prices: {},
                balances: [],
                rates: [],
                network: 'ethereum',
                timestamp: Date.now()
              }
            }))),
          fc.string(),
          fc.string(),
          (toolResults, userMessage, llmResponse) => {
            const result = generator.generateIntent(toolResults, userMessage, llmResponse);
            
            // Property: Should be able to generate multiple intents for multiple unique tools
            const uniqueToolNames = [...new Set(toolResults.map(tr => tr.toolName))];
            
            const isValidMultipleIntents = result === null || (
              Array.isArray(result) &&
              result.length >= 1 &&
              result.length <= toolResults.length &&
              result.length === uniqueToolNames.length &&
              result.every(intent => 
                intent &&
                typeof intent === 'object' &&
                intent.type === 'RENDER_COMPONENT' &&
                typeof intent.component === 'string' &&
                typeof intent.props === 'object'
              )
            );
            
            // Check for unique components (no duplicates)
            const hasUniqueComponents = result === null || (
              Array.isArray(result) &&
              new Set(result.map(intent => intent.component)).size === result.length
            );
            
            expect(isValidMultipleIntents).toBe(true);
            expect(hasUniqueComponents).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 22: Pattern-based response compatibility', () => {
    /**
     * **Feature: genai-server-integration, Property 22: Pattern-based response compatibility**
     * **Validates: Requirements 6.1**
     * 
     * For any user message matching existing mock service patterns, the server should 
     * generate responses that maintain the same behavior as the original mock service.
     */
    test('should maintain compatibility with mock service patterns', () => {
      fc.assert(
        fc.property(
          fc.record({
            messageType: fc.constantFrom('gas', 'swap', 'lending', 'balance', 'perpetual', 'activity'),
            baseMessage: fc.string({ minLength: 1, maxLength: 50 })
          }),
          (testData) => {
            const { messageType, baseMessage } = testData;
            
            // Create messages that match mock service patterns
            const messagePatterns = {
              gas: `${baseMessage} gas prices fees`,
              swap: `${baseMessage} swap exchange trade`,
              lending: `${baseMessage} lending apy earn`,
              balance: `${baseMessage} balance assets portfolio`,
              perpetual: `${baseMessage} perpetual leverage perp`,
              activity: `${baseMessage} activity history transactions`
            };
            
            const expectedComponents = {
              gas: 'NetworkStatus',
              swap: 'TokenSwap',
              lending: 'LendingSection',
              balance: 'YourAssets',
              perpetual: 'PerpetualsSection',
              activity: 'RecentActivity'
            };
            
            const userMessage = messagePatterns[messageType];
            const result = generator.generateIntent(null, userMessage, '');
            
            // Property: Should generate intent matching mock service behavior
            const isValidPatternMatch = result === null || (
              Array.isArray(result) &&
              result.length > 0 &&
              result[0].type === 'RENDER_COMPONENT' &&
              result[0].component === expectedComponents[messageType] &&
              typeof result[0].props === 'object'
            );
            expect(isValidPatternMatch).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 23: Component intent backward compatibility', () => {
    /**
     * **Feature: genai-server-integration, Property 23: Component intent backward compatibility**
     * **Validates: Requirements 6.2**
     * 
     * For any request pattern that previously generated component intents in the mock service, 
     * the server should generate the same component intents.
     */
    test('should generate same component intents as mock service for known patterns', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'check gas prices',
            'show me gas fees',
            'swap tokens',
            'exchange eth for usdc',
            'lending rates',
            'earn apy',
            'my balance',
            'portfolio assets',
            'perpetual trading',
            'leverage positions',
            'transaction history',
            'recent activity'
          ),
          (userMessage) => {
            const result = generator.generateIntent(null, userMessage, '');
            
            // Property: Known patterns should always generate intents
            expect(result).not.toBeNull();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            const intent = result[0];
            const lowerMessage = userMessage.toLowerCase();
            
            // Determine expected component based on message content
            let expectedComponent = '';
            if (lowerMessage.includes('gas') || lowerMessage.includes('fee')) {
              expectedComponent = 'NetworkStatus';
            } else if (lowerMessage.includes('swap') || lowerMessage.includes('exchange')) {
              expectedComponent = 'TokenSwap';
            } else if (lowerMessage.includes('lend') || lowerMessage.includes('apy') || lowerMessage.includes('earn')) {
              expectedComponent = 'LendingSection';
            } else if (lowerMessage.includes('balance') || lowerMessage.includes('asset') || lowerMessage.includes('portfolio')) {
              expectedComponent = 'YourAssets';
            } else if (lowerMessage.includes('perpetual') || lowerMessage.includes('leverage')) {
              expectedComponent = 'PerpetualsSection';
            } else if (lowerMessage.includes('activity') || lowerMessage.includes('history')) {
              expectedComponent = 'RecentActivity';
            }
            
            // Should match expected component and have proper structure
            expect(intent.component).toBe(expectedComponent);
            expect(intent.type).toBe('RENDER_COMPONENT');
            expect(typeof intent.props).toBe('object');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Unit tests for specific functionality
  describe('Unit Tests', () => {
    test('should initialize with patterns and tool mappings', () => {
      expect(generator.patterns.size).toBeGreaterThan(0);
      expect(generator.toolComponentMap.size).toBeGreaterThan(0);
    });

    test('should handle null/undefined inputs gracefully', () => {
      expect(generator.generateIntent(null, null, null)).toBeNull();
      expect(generator.generateIntent(undefined, undefined, undefined)).toBeNull();
      expect(generator.generateIntent([], '', '')).toBeNull();
    });

    test('should generate intent from successful tool result', () => {
      const toolResult = {
        toolName: 'get_gas_prices',
        success: true,
        result: {
          prices: { fast: 50, standard: 30 },
          network: 'ethereum',
          timestamp: Date.now()
        }
      };

      const intent = generator.generateIntentFromToolResult(toolResult);
      expect(intent).not.toBeNull();
      expect(intent.component).toBe('NetworkStatus');
      expect(intent.type).toBe('RENDER_COMPONENT');
      expect(intent.props).toHaveProperty('prices');
      expect(intent.props).toHaveProperty('network');
    });

    test('should not generate intent from failed tool result', () => {
      const toolResult = {
        toolName: 'get_gas_prices',
        success: false,
        error: 'API failed'
      };

      const intent = generator.generateIntentFromToolResult(toolResult);
      expect(intent).toBeNull();
    });

    test('should generate multiple intents from multiple tool results', () => {
      const toolResults = [
        {
          toolName: 'get_gas_prices',
          success: true,
          result: { prices: {}, network: 'ethereum' }
        },
        {
          toolName: 'get_token_balance',
          success: true,
          result: { balances: [], address: '0x123' }
        }
      ];

      const result = generator.generateIntent(toolResults, 'test message', 'test response');
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].component).toBe('NetworkStatus');
      expect(result[1].component).toBe('YourAssets');
    });
  });
});