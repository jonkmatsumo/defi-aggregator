import { jest } from '@jest/globals';
import fc from 'fast-check';
import { SystemPromptManager } from '../../src/prompts/systemPromptManager.js';

// Mock the logger to suppress output during tests
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('SystemPromptManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 1: System prompt initialization completeness', () => {
    /**
     * Feature: ai-agent-response-improvement, Property 1: System prompt initialization completeness
     * Validates: Requirements 1.1
     */
    test('should provide a detailed system prompt that defines the agent\'s role as a DeFi assistant', async () => {
      await fc.assert(fc.property(
        fc.record({
          defaultContext: fc.constantFrom('defi_assistant', 'fallback'),
          includeToolExamples: fc.boolean(),
          includeEducationalGuidance: fc.boolean()
        }),
        (config) => {
          const manager = new SystemPromptManager(config);
          
          // Validate that initialization creates required prompts
          const validation = manager.validatePromptCompleteness('defi_assistant');
          
          // System prompt should be complete and valid
          expect(validation.valid).toBe(true);
          expect(validation.missing).toHaveLength(0);
          
          // Should have proper identity definition
          const metadata = manager.getPromptMetadata('defi_assistant');
          expect(metadata).toBeDefined();
          expect(metadata.identity).toBeDefined();
          expect(metadata.identity.role).toBe('DeFi Assistant');
          expect(metadata.identity.expertise).toBeInstanceOf(Array);
          expect(metadata.identity.expertise.length).toBeGreaterThan(0);
          
          // Core prompt should be substantial and contain DeFi context
          const systemPrompt = manager.getSystemPrompt('defi_assistant');
          expect(systemPrompt).toBeDefined();
          expect(typeof systemPrompt).toBe('string');
          expect(systemPrompt.length).toBeGreaterThan(100);
          
          // Should contain DeFi-specific content
          const promptLower = systemPrompt.toLowerCase();
          expect(promptLower).toMatch(/defi|decentralized finance/);
          expect(promptLower).toMatch(/cryptocurrency|crypto/);
          expect(promptLower).toMatch(/blockchain/);
          
          // Should define role clearly
          expect(promptLower).toMatch(/assistant|expert|role/);
          
          // Should have required sections for completeness
          expect(metadata.hasToolGuidelines).toBe(true);
          expect(metadata.hasResponsePatterns).toBe(true);
        }
      ), { numRuns: 100 });
    });

    test('should initialize with fallback prompt when main prompt fails', async () => {
      await fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (invalidContext) => {
          const manager = new SystemPromptManager();
          
          // Should handle invalid context gracefully
          const prompt = manager.getSystemPrompt(invalidContext);
          expect(prompt).toBeDefined();
          expect(typeof prompt).toBe('string');
          expect(prompt.length).toBeGreaterThan(0);
          
          // Should use fallback prompt
          const fallbackPrompt = manager.getSystemPrompt('fallback');
          expect(prompt).toBe(fallbackPrompt);
        }
      ), { numRuns: 100 });
    });

    test('should maintain prompt completeness across different configurations', async () => {
      await fc.assert(fc.property(
        fc.record({
          defaultContext: fc.constantFrom('defi_assistant', 'fallback'),
          includeToolExamples: fc.boolean(),
          includeEducationalGuidance: fc.boolean()
        }),
        (config) => {
          const manager = new SystemPromptManager(config);
          
          // All available contexts should have complete prompts
          const contexts = manager.getAvailableContexts();
          expect(contexts).toBeInstanceOf(Array);
          expect(contexts.length).toBeGreaterThan(0);
          
          for (const context of contexts) {
            const prompt = manager.getSystemPrompt(context);
            expect(prompt).toBeDefined();
            expect(typeof prompt).toBe('string');
            expect(prompt.length).toBeGreaterThan(50);
            
            const metadata = manager.getPromptMetadata(context);
            expect(metadata).toBeDefined();
            expect(metadata.identity).toBeDefined();
            expect(metadata.identity.role).toBeDefined();
            expect(metadata.promptLength).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 2: System prompt tool instruction inclusion', () => {
    /**
     * Feature: ai-agent-response-improvement, Property 2: System prompt tool instruction inclusion
     * Validates: Requirements 1.2
     */
    test('should contain specific instructions for using available tools to fetch real-time data', async () => {
      await fc.assert(fc.property(
        fc.array(fc.record({
          name: fc.constantFrom('get_crypto_price', 'get_gas_prices', 'get_lending_rates'),
          description: fc.string({ minLength: 10, maxLength: 200 }),
          parameters: fc.record({
            type: fc.constant('object'),
            properties: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.record({
                type: fc.constantFrom('string', 'number', 'boolean'),
                description: fc.string({ minLength: 5, maxLength: 100 })
              })
            ),
            required: fc.array(fc.string({ minLength: 1, maxLength: 20 }))
          })
        }), { minLength: 1, maxLength: 5 }),
        (toolDefinitions) => {
          const manager = new SystemPromptManager();
          
          // Validate tool instruction inclusion
          const validation = manager.validateToolInstructions('defi_assistant');
          expect(validation.valid).toBe(true);
          expect(validation.missing).toHaveLength(0);
          expect(validation.hasToolGuidelines).toBe(true);
          
          // Format prompt with tools
          const promptWithTools = manager.formatPromptWithTools(toolDefinitions, 'defi_assistant');
          expect(promptWithTools).toBeDefined();
          expect(typeof promptWithTools).toBe('string');
          
          // Should contain tool-specific instructions
          const promptLower = promptWithTools.toLowerCase();
          expect(promptLower).toMatch(/tool|function/);
          expect(promptLower).toMatch(/real-time|current/);
          
          // Should include specific tool guidance
          expect(promptLower).toMatch(/price|gas|lending/);
          
          // Should contain tool definitions
          for (const tool of toolDefinitions) {
            expect(promptWithTools).toContain(tool.name);
            expect(promptWithTools).toContain(tool.description);
          }
          
          // Should have guidelines section
          expect(promptLower).toMatch(/guideline|instruction|usage/);
        }
      ), { numRuns: 100 });
    });

    test('should handle empty tool definitions gracefully', async () => {
      await fc.assert(fc.property(
        fc.constantFrom([], null, undefined),
        (emptyTools) => {
          const manager = new SystemPromptManager();
          
          // Should still provide valid prompt without tools
          const prompt = manager.formatPromptWithTools(emptyTools, 'defi_assistant');
          expect(prompt).toBeDefined();
          expect(typeof prompt).toBe('string');
          expect(prompt.length).toBeGreaterThan(100);
          
          // Should still contain tool usage guidelines
          const validation = manager.validateToolInstructions('defi_assistant');
          expect(validation.hasToolGuidelines).toBe(true);
        }
      ), { numRuns: 100 });
    });

    test('should include tool parameter examples and formatting guidance', async () => {
      await fc.assert(fc.property(
        fc.array(fc.record({
          name: fc.string({ minLength: 5, maxLength: 30 }),
          description: fc.string({ minLength: 10, maxLength: 200 }),
          parameters: fc.record({
            type: fc.constant('object'),
            properties: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.record({
                type: fc.constantFrom('string', 'number', 'boolean'),
                description: fc.string({ minLength: 5, maxLength: 100 }),
                examples: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }))
              })
            ),
            required: fc.array(fc.string({ minLength: 1, maxLength: 20 }))
          })
        }), { minLength: 1, maxLength: 3 }),
        (toolDefinitions) => {
          const manager = new SystemPromptManager();
          
          const promptWithTools = manager.formatPromptWithTools(toolDefinitions, 'defi_assistant');
          
          // Should include basic tool information
          for (const tool of toolDefinitions) {
            expect(promptWithTools).toContain(tool.name);
          }
          
          // Check parameter formatting for tools that have parameters
          const toolsWithParams = toolDefinitions.filter(tool => 
            tool.parameters && tool.parameters.properties && 
            Object.keys(tool.parameters.properties).length > 0
          );
          
          // Verify parameter information is included
          toolsWithParams.forEach(tool => {
            const paramEntries = Object.entries(tool.parameters.properties);
            
            paramEntries.forEach(([paramName, paramDef]) => {
              const cleanParamName = paramName.trim() || 'parameter';
              expect(promptWithTools).toContain(cleanParamName);
              
              // Check for required/optional indication
              const isRequired = tool.parameters.required?.includes(paramName);
              const escapedParamName = cleanParamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              
              const requiredPattern = new RegExp(`${escapedParamName}.*required`, 'i');
              const optionalPattern = new RegExp(`${escapedParamName}.*optional`, 'i');
              
              const hasRequiredMatch = promptWithTools.match(requiredPattern);
              const hasOptionalMatch = promptWithTools.match(optionalPattern);
              
              // Should match the appropriate pattern
              expect(isRequired ? hasRequiredMatch : hasOptionalMatch).toBeTruthy();
              
              // Check examples if they exist
              const examples = paramDef.examples;
              const validExamples = examples && Array.isArray(examples) ? examples : [];
              
              validExamples.forEach(example => {
                expect(promptWithTools).toContain(example);
              });
            });
          });
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 3: System prompt expertise specification', () => {
    /**
     * Feature: ai-agent-response-improvement, Property 3: System prompt expertise specification
     * Validates: Requirements 1.3
     */
    test('should specify the agent\'s expertise in cryptocurrency, DeFi protocols, and blockchain operations', async () => {
      await fc.assert(fc.property(
        fc.record({
          defaultContext: fc.constantFrom('defi_assistant'),
          includeToolExamples: fc.boolean(),
          includeEducationalGuidance: fc.boolean()
        }),
        (config) => {
          const manager = new SystemPromptManager(config);
          
          // Validate expertise specification
          const validation = manager.validateExpertiseSpecification('defi_assistant');
          expect(validation.valid).toBe(true);
          expect(validation.missing).toHaveLength(0);
          expect(validation.expertiseCount).toBeGreaterThan(0);
          
          // Check specific expertise areas
          const expertise = validation.expertise;
          const expertiseText = expertise.join(' ').toLowerCase();
          
          // Should include cryptocurrency expertise
          expect(expertiseText).toMatch(/cryptocurrency|crypto/);
          
          // Should include DeFi expertise
          expect(expertiseText).toMatch(/defi|decentralized finance/);
          
          // Should include blockchain expertise
          expect(expertiseText).toMatch(/blockchain/);
          
          // Core prompt should mention expertise
          const systemPrompt = manager.getSystemPrompt('defi_assistant');
          const promptLower = systemPrompt.toLowerCase();
          expect(promptLower).toMatch(/expert|expertise/);
          
          // Should contain all three required areas in prompt or expertise list
          const allContent = (systemPrompt + ' ' + expertiseText).toLowerCase();
          expect(allContent).toMatch(/cryptocurrency|crypto/);
          expect(allContent).toMatch(/defi|decentralized finance/);
          expect(allContent).toMatch(/blockchain/);
        }
      ), { numRuns: 100 });
    });

    test('should maintain expertise specification consistency across prompt updates', async () => {
      await fc.assert(fc.property(
        fc.record({
          identity: fc.record({
            role: fc.string({ minLength: 5, maxLength: 50 }),
            expertise: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { minLength: 3, maxLength: 10 }),
            personality: fc.string({ minLength: 5, maxLength: 50 })
          }),
          corePrompt: fc.string({ minLength: 100, maxLength: 1000 }),
          toolGuidelines: fc.string({ minLength: 50, maxLength: 500 }),
          responsePatterns: fc.string({ minLength: 50, maxLength: 500 })
        }),
        (promptUpdate) => {
          const manager = new SystemPromptManager();
          
          // Update prompt with new content
          manager.updatePrompt('test_context', promptUpdate);
          
          // Validate updated prompt maintains structure
          const metadata = manager.getPromptMetadata('test_context');
          expect(metadata).toBeDefined();
          expect(metadata.identity).toBeDefined();
          expect(metadata.identity.role).toBe(promptUpdate.identity.role);
          expect(metadata.identity.expertise).toEqual(promptUpdate.identity.expertise);
          expect(metadata.identity.personality).toBe(promptUpdate.identity.personality);
          
          // Should have updated timestamp
          expect(metadata.lastUpdated).toBeGreaterThan(0);
          
          // Prompt should be retrievable
          const prompt = manager.getSystemPrompt('test_context');
          expect(prompt).toBe(promptUpdate.corePrompt);
        }
      ), { numRuns: 100 });
    });

    test('should provide comprehensive expertise coverage for DeFi operations', async () => {
      await fc.assert(fc.property(
        fc.constant('defi_assistant'),
        (context) => {
          const manager = new SystemPromptManager();
          
          const metadata = manager.getPromptMetadata(context);
          const expertise = metadata.identity.expertise;
          
          // Should cover key DeFi areas
          const expertiseText = expertise.join(' ').toLowerCase();
          
          // Core DeFi concepts
          expect(expertiseText).toMatch(/defi|decentralized finance|protocol/);
          
          // Market and pricing
          expect(expertiseText).toMatch(/market|price|pricing/);
          
          // Network operations
          expect(expertiseText).toMatch(/blockchain|network|gas|fee/);
          
          // DeFi operations
          expect(expertiseText).toMatch(/lending|swap|yield|liquidity/);
          
          // Should have multiple expertise areas
          expect(expertise.length).toBeGreaterThanOrEqual(3);
          
          // Each expertise area should be substantial
          for (const area of expertise) {
            expect(area.length).toBeGreaterThan(10);
            expect(typeof area).toBe('string');
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Integration Tests', () => {
    test('should integrate all properties for complete system prompt functionality', async () => {
      const manager = new SystemPromptManager();
      
      // Test completeness
      const completeness = manager.validatePromptCompleteness('defi_assistant');
      expect(completeness.valid).toBe(true);
      
      // Test tool instructions
      const toolInstructions = manager.validateToolInstructions('defi_assistant');
      expect(toolInstructions.valid).toBe(true);
      
      // Test expertise specification
      const expertise = manager.validateExpertiseSpecification('defi_assistant');
      expect(expertise.valid).toBe(true);
      
      // Test with real tool definitions
      const mockTools = [
        {
          name: 'get_crypto_price',
          description: 'Get current cryptocurrency prices',
          parameters: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Crypto symbol' },
              currency: { type: 'string', description: 'Fiat currency' }
            },
            required: ['symbol']
          }
        }
      ];
      
      const fullPrompt = manager.formatPromptWithTools(mockTools, 'defi_assistant');
      expect(fullPrompt).toContain('get_crypto_price');
      expect(fullPrompt).toContain('DeFi');
      expect(fullPrompt).toContain('tool');
    });
  });
});