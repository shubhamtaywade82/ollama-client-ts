/**
 * Tool registry for managing definitions and executing model tool calls.
 */

import { OllamaNotFoundError, OllamaToolValidationError } from '../errors.js';
import type { ToolCall, ToolDefinition } from '../types.js';
import type { Tool, ToolExecutionContext, ToolExecutionResult } from './types.js';

export interface ToolRegistryOptions {
  readonly onError?: ((error: Error, toolCall: ToolCall) => string) | undefined;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool<never, unknown>>();
  private readonly onError?: ((error: Error, toolCall: ToolCall) => string) | undefined;

  constructor(options?: ToolRegistryOptions | undefined) {
    this.onError = options?.onError;
  }

  register(tool: Tool<never, unknown>): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  registerMany(tools: readonly Tool<never, unknown>[]): this {
    for (const tool of tools) {
      this.register(tool);
    }
    return this;
  }

  get(name: string): Tool<never, unknown> | undefined {
    return this.tools.get(name);
  }

  definitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async executeToolCall(
    toolCall: ToolCall,
    ctx: ToolExecutionContext = {},
  ): Promise<ToolExecutionResult> {
    const { name, arguments: args } = toolCall.function;
    const tool = this.tools.get(name);

    if (!tool) {
      const err = new OllamaNotFoundError(`Tool "${name}" is not registered in this registry`);
      return this.handleExecutionError(err, toolCall);
    }

    const parseResult = tool.schema.safeParse(args);
    if (!parseResult.success) {
      const err = new OllamaToolValidationError(`Tool "${name}" arguments validation failed`, {
        toolName: name,
        issues: parseResult.error.issues,
        cause: parseResult.error,
      });
      return this.handleExecutionError(err, toolCall);
    }

    try {
      const result = await tool.execute(parseResult.data, ctx);
      return {
        toolName: name,
        success: true,
        result,
        outputString: typeof result === 'string' ? result : JSON.stringify(result),
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return this.handleExecutionError(error, toolCall);
    }
  }

  async executeToolCalls(
    toolCalls: readonly ToolCall[],
    ctx: ToolExecutionContext = {},
  ): Promise<ToolExecutionResult[]> {
    return Promise.all(toolCalls.map((tc) => this.executeToolCall(tc, ctx)));
  }

  private handleExecutionError(error: Error, toolCall: ToolCall): ToolExecutionResult {
    const fallbackMessage = this.onError ? this.onError(error, toolCall) : error.message;
    return {
      toolName: toolCall.function.name,
      success: false,
      error,
      outputString: fallbackMessage,
    };
  }
}
