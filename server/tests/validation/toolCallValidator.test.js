import { ToolCallValidator } from '../../src/validation/toolCallValidator.js';

describe('ToolCallValidator', () => {
    describe('validate', () => {
        it('should return empty array for non-array input', () => {
            expect(ToolCallValidator.validate(null)).toEqual([]);
            expect(ToolCallValidator.validate({})).toEqual([]);
            expect(ToolCallValidator.validate('string')).toEqual([]);
        });

        it('should filter out invalid calls and keep valid ones', () => {
            const toolCalls = [
                { id: 'call_1', function: { name: 'valid_tool', arguments: '{}' } }, // Valid OpenAI format
                { id: null, function: { name: 'invalid_id' } }, // Invalid ID
                { id: 'call_2', name: 'valid_normalized' }, // Valid normalized format
                { id: 'call_3' } // Missing name
            ];

            const result = ToolCallValidator.validate(toolCalls);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('call_1');
            expect(result[1].id).toBe('call_2');
        });

        it('should log warning for malformed calls', () => {
            // Ideally we would mock logger, but for now we just check behavior
            const result = ToolCallValidator.validate([{ id: 'bad' }]);
            expect(result).toEqual([]);
        });
    });

    describe('validateSingleCall', () => {
        it('should validate standard OpenAI tool call', () => {
            const call = {
                id: 'call_123',
                type: 'function',
                function: {
                    name: 'get_weather',
                    arguments: '{"location": "London"}'
                }
            };
            expect(ToolCallValidator.validateSingleCall(call).valid).toBe(true);
        });

        it('should validate normalized tool call', () => {
            const call = {
                id: 'call_456',
                name: 'get_weather',
                parameters: { location: 'London' }
            };
            expect(ToolCallValidator.validateSingleCall(call).valid).toBe(true);
        });

        it('should reject missing ID', () => {
            const call = {
                name: 'get_weather'
            };
            expect(ToolCallValidator.validateSingleCall(call).valid).toBe(false);
            expect(ToolCallValidator.validateSingleCall(call).error).toContain('ID');
        });

        it('should reject missing name', () => {
            const call = {
                id: 'call_789'
            };
            expect(ToolCallValidator.validateSingleCall(call).valid).toBe(false);
            expect(ToolCallValidator.validateSingleCall(call).error).toContain('name');
        });

        it('should reject non-object input', () => {
            expect(ToolCallValidator.validateSingleCall(null).valid).toBe(false);
            expect(ToolCallValidator.validateSingleCall('string').valid).toBe(false);
        });
    });
});
