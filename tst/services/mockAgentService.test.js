import { MockAgentService } from '../../src/services/mockAgentService';
import fc from 'fast-check';

describe('MockAgentService', () => {
  let mockAgentService;

  beforeEach(() => {
    mockAgentService = new MockAgentService();
  });

  describe('Property-Based Tests', () => {
    // **Feature: chat-agent-ui, Property 16: Mock service response structure**
    // **Validates: Requirements 6.1**
    it('should always return a response with text content field for any user message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }), // Generate random non-empty strings
          fc.array(fc.record({
            id: fc.string(),
            role: fc.constantFrom('user', 'assistant'),
            content: fc.string(),
            timestamp: fc.integer({ min: 0 })
          }), { maxLength: 20 }), // Generate random conversation history
          async (message, history) => {
            const response = await mockAgentService.sendMessage(message, history);
            
            // Verify response has required structure
            expect(response).toBeDefined();
            expect(response).toHaveProperty('id');
            expect(response).toHaveProperty('role');
            expect(response).toHaveProperty('content');
            expect(response).toHaveProperty('timestamp');
            
            // Verify role is 'assistant'
            expect(response.role).toBe('assistant');
            
            // Verify content is a non-empty string (text content field)
            expect(typeof response.content).toBe('string');
            expect(response.content.length).toBeGreaterThan(0);
            
            // Verify id is a string
            expect(typeof response.id).toBe('string');
            expect(response.id.length).toBeGreaterThan(0);
            
            // Verify timestamp is a number
            expect(typeof response.timestamp).toBe('number');
            expect(response.timestamp).toBeGreaterThan(0);
            
            // uiIntent is optional, but if present should have correct structure
            // Validate uiIntent structure - always assert to avoid conditional expects
            const uiIntentIsValid = !response.uiIntent || (
              response.uiIntent &&
              typeof response.uiIntent === 'object' &&
              response.uiIntent.type === 'RENDER_COMPONENT' &&
              typeof response.uiIntent.component === 'string' &&
              response.uiIntent.component.length > 0
            );
            expect(uiIntentIsValid).toBe(true);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    }, 60000); // Increase timeout for property test with delays (100 runs * ~300ms avg = ~30s)

    // **Feature: chat-agent-ui, Property 17: Pattern-based UI intent generation**
    // **Validates: Requirements 6.2**
    it('should return appropriate UI intent for messages matching predefined patterns', async () => {
      // Define pattern mappings from design document
      const patternMappings = [
        { keywords: ['gas', 'fee'], component: 'NetworkStatus' },
        { keywords: ['swap', 'exchange', 'trade'], component: 'TokenSwap' },
        { keywords: ['lend', 'lending', 'apy', 'earn'], component: 'LendingSection' },
        { keywords: ['balance', 'asset', 'portfolio'], component: 'YourAssets' },
        { keywords: ['perpetual', 'perp', 'leverage'], component: 'PerpetualsSection' },
        { keywords: ['activity', 'history', 'transaction'], component: 'RecentActivity' }
      ];

      await fc.assert(
        fc.asyncProperty(
          // Generate a pattern mapping and a keyword from that pattern
          fc.integer({ min: 0, max: patternMappings.length - 1 }),
          fc.string({ minLength: 0, maxLength: 100 }), // Random prefix
          fc.string({ minLength: 0, maxLength: 100 }), // Random suffix
          fc.constantFrom('lower', 'upper', 'mixed'), // Case variation
          async (patternIndex, prefix, suffix, caseVariation) => {
            const pattern = patternMappings[patternIndex];
            // Pick a random keyword from the pattern
            const keyword = pattern.keywords[Math.floor(Math.random() * pattern.keywords.length)];
            
            // Apply case variation
            let finalKeyword = keyword;
            if (caseVariation === 'upper') {
              finalKeyword = keyword.toUpperCase();
            } else if (caseVariation === 'mixed') {
              finalKeyword = keyword.split('').map((c, i) => 
                i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
            }
            
            // Construct message with keyword embedded
            const message = `${prefix} ${finalKeyword} ${suffix}`.trim();
            
            // Skip empty messages (edge case)
            if (message.length === 0) {
              return true;
            }
            
            const response = await mockAgentService.sendMessage(message, []);
            
            // Verify that a UI intent was returned
            expect(response.uiIntent).toBeDefined();
            expect(response.uiIntent).not.toBeNull();
            
            // Verify the UI intent has correct structure
            expect(response.uiIntent.type).toBe('RENDER_COMPONENT');
            expect(response.uiIntent.component).toBe(pattern.component);
            expect(response.uiIntent.props).toBeDefined();
            expect(typeof response.uiIntent.props).toBe('object');
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    }, 60000); // Increase timeout for property test with delays

    // **Feature: chat-agent-ui, Property 18: Conversation history accumulation**
    // **Validates: Requirements 6.4**
    it('should maintain conversation history correctly across multiple messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a sequence of messages (2-5 messages to keep test time reasonable)
          fc.array(
            fc.string({ minLength: 1, maxLength: 200 }),
            { minLength: 2, maxLength: 5 }
          ),
          async (messages) => {
            // Start with empty history
            let history = [];
            
            // Send each message and accumulate history
            for (let i = 0; i < messages.length; i++) {
              const userMessage = messages[i];
              
              // Create user message object
              const userMessageObj = {
                id: `user_${i}`,
                role: 'user',
                content: userMessage,
                timestamp: Date.now() + i
              };
              
              // Add user message to history
              history.push(userMessageObj);
              
              // Send message with current history
              const response = await mockAgentService.sendMessage(userMessage, history);
              
              // Verify response is valid
              expect(response).toBeDefined();
              expect(response.role).toBe('assistant');
              expect(response.content).toBeDefined();
              
              // Add assistant response to history
              history.push(response);
              
              // Verify history accumulation
              // History should contain all previous messages (user + assistant pairs)
              expect(history.length).toBe((i + 1) * 2);
              
              // Verify history structure - alternating user/assistant messages
              for (let j = 0; j < history.length; j++) {
                const expectedRole = j % 2 === 0 ? 'user' : 'assistant';
                expect(history[j].role).toBe(expectedRole);
                expect(history[j].content).toBeDefined();
                expect(typeof history[j].content).toBe('string');
                expect(history[j].id).toBeDefined();
                expect(history[j].timestamp).toBeDefined();
              }
            }
            
            // Final verification: history should contain all messages
            expect(history.length).toBe(messages.length * 2);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    }, 180000); // Increase timeout for property test with multiple sequential calls (100 runs * 5 msgs * 300ms avg = ~150s)
  });

  describe('Unit Tests', () => {
    describe('Pattern Matching', () => {
      it('should return NetworkStatus component for gas-related messages', async () => {
        const testMessages = ['gas', 'gas price', 'check fees', 'what are the fees?'];
        
        for (const message of testMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.uiIntent).toBeDefined();
          expect(response.uiIntent.component).toBe('NetworkStatus');
          expect(response.content).toBe('Here are the current gas prices:');
        }
      });

      it('should return TokenSwap component for swap-related messages', async () => {
        const testMessages = ['swap', 'exchange tokens', 'trade ETH', 'I want to swap'];
        
        for (const message of testMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.uiIntent).toBeDefined();
          expect(response.uiIntent.component).toBe('TokenSwap');
          expect(response.content).toBe('I can help you swap tokens:');
        }
      });

      it('should return LendingSection component for lending-related messages', async () => {
        const testMessages = ['lend', 'lending rates', 'what is the apy?', 'earn interest'];
        
        for (const message of testMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.uiIntent).toBeDefined();
          expect(response.uiIntent.component).toBe('LendingSection');
          expect(response.content).toBe('Here are the current lending rates:');
        }
      });

      it('should return YourAssets component for balance-related messages', async () => {
        const testMessages = ['balance', 'my assets', 'show portfolio', 'check my balance'];
        
        for (const message of testMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.uiIntent).toBeDefined();
          expect(response.uiIntent.component).toBe('YourAssets');
          expect(response.content).toBe('Here are your current assets:');
        }
      });

      it('should return PerpetualsSection component for perpetual-related messages', async () => {
        const testMessages = ['perpetual', 'open a perp', 'leverage trading', 'use leverage'];
        
        for (const message of testMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.uiIntent).toBeDefined();
          expect(response.uiIntent.component).toBe('PerpetualsSection');
          expect(response.content).toBe('You can open leveraged positions here:');
        }
      });

      it('should return RecentActivity component for activity-related messages', async () => {
        const testMessages = ['activity', 'transaction history', 'recent transactions', 'show history'];
        
        for (const message of testMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.uiIntent).toBeDefined();
          expect(response.uiIntent.component).toBe('RecentActivity');
          expect(response.content).toBe("Here's your recent activity:");
        }
      });
    });

    describe('Default Response', () => {
      it('should return default response for unrecognized input', async () => {
        const unrecognizedMessages = [
          'hello',
          'what can you do?',
          'random text',
          'xyz123',
          'tell me a joke'
        ];
        
        for (const message of unrecognizedMessages) {
          const response = await mockAgentService.sendMessage(message, []);
          expect(response.content).toBe('I can help you with swaps, checking gas prices, viewing your assets, and more. What would you like to do?');
          expect(response.uiIntent).toBeUndefined();
        }
      });

      it('should not include uiIntent for unrecognized messages', async () => {
        const response = await mockAgentService.sendMessage('unrecognized message', []);
        expect(response.uiIntent).toBeUndefined();
      });
    });

    describe('Response Delay', () => {
      it('should have response delay within expected range (200-400ms)', async () => {
        const message = 'test message';
        const startTime = Date.now();
        
        await mockAgentService.sendMessage(message, []);
        
        const endTime = Date.now();
        const delay = endTime - startTime;
        
        // Response should take between 200ms and 400ms
        expect(delay).toBeGreaterThanOrEqual(200);
        expect(delay).toBeLessThan(500); // Allow small buffer for execution time
      });

      it('should have consistent delay across multiple calls', async () => {
        const delays = [];
        
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();
          await mockAgentService.sendMessage('test', []);
          const endTime = Date.now();
          delays.push(endTime - startTime);
        }
        
        // All delays should be within expected range
        delays.forEach(delay => {
          expect(delay).toBeGreaterThanOrEqual(200);
          expect(delay).toBeLessThan(500);
        });
      });
    });

    describe('Response Structure', () => {
      it('should always include required fields in response', async () => {
        const response = await mockAgentService.sendMessage('test message', []);
        
        expect(response).toHaveProperty('id');
        expect(response).toHaveProperty('role');
        expect(response).toHaveProperty('content');
        expect(response).toHaveProperty('timestamp');
        
        expect(typeof response.id).toBe('string');
        expect(response.role).toBe('assistant');
        expect(typeof response.content).toBe('string');
        expect(typeof response.timestamp).toBe('number');
      });

      it('should generate unique IDs for each response', async () => {
        const response1 = await mockAgentService.sendMessage('test 1', []);
        const response2 = await mockAgentService.sendMessage('test 2', []);
        
        expect(response1.id).not.toBe(response2.id);
      });

      it('should include uiIntent with correct structure when pattern matches', async () => {
        const response = await mockAgentService.sendMessage('swap tokens', []);
        
        expect(response.uiIntent).toBeDefined();
        expect(response.uiIntent.type).toBe('RENDER_COMPONENT');
        expect(response.uiIntent.component).toBe('TokenSwap');
        expect(response.uiIntent.props).toBeDefined();
        expect(typeof response.uiIntent.props).toBe('object');
      });
    });
  });
});
