import { logger } from '../utils/logger.js';

export class ToolCallValidator {
  /**
   * Validates a list of tool calls from the LLM.
   * @param {Array} toolCalls - Array of tool call objects
   * @returns {Array} - Array of valid tool calls
   * @throws {ToolError} - If critical validation fails
   */
  static validate(toolCalls) {
    if (!Array.isArray(toolCalls)) {
      logger.warn('Tool calls must be an array', {
        received: typeof toolCalls,
      });
      return [];
    }

    const validCalls = [];
    const errors = [];

    for (const call of toolCalls) {
      const validationResult = this.validateSingleCall(call);
      if (validationResult.valid) {
        validCalls.push(call);
      } else {
        errors.push({ call, error: validationResult.error });
        logger.warn('Dropped malformed tool call', {
          call,
          error: validationResult.error,
        });
      }
    }

    if (errors.length > 0 && validCalls.length === 0) {
      // If all calls failed, we might want to throw or return structured error info
      // For now, we just log. The empty array will effectively be a no-op which is safer than crashing.
      logger.error('All tool calls failed validation', {
        errorCount: errors.length,
      });
    }

    return validCalls;
  }

  /**
   * Validates a single tool call structure.
   * OpenAI format: { id: "call_...", type: "function", function: { name: "...", arguments: "..." } }
   * Internal format might be normalized to: { id: "...", name: "...", parameters: {...} }
   */
  static validateSingleCall(call) {
    if (!call || typeof call !== 'object') {
      return { valid: false, error: 'Tool call must be an object' };
    }

    // Check for ID (crucial for OpenAI sequencing)
    if (!call.id || typeof call.id !== 'string') {
      return { valid: false, error: 'Missing or invalid tool call ID' };
    }

    // Check for name.
    // If it's raw OpenAI format, name is in call.function.name
    // If it's already normalized by LLMInterface, it might be in call.name
    let name = call.name;
    if (!name && call.function && typeof call.function === 'object') {
      name = call.function.name;
    }

    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Missing or invalid tool name' };
    }

    // We don't strictly validate parameters here as that's done by the registry per-tool.
    // We just ensure the structure is sound enough to attempt execution.

    return { valid: true };
  }
}
