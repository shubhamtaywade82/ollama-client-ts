/**
 * Type-safe tool definition helper.
 */

import type { z } from 'zod';
import { zodToJsonSchema } from '../schema/zod.js';
import type { Tool, ToolHandler } from './types.js';
import type { ToolProperty } from '../types.js';

export interface DefineToolOptions<TParams, TResult> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<TParams>;
  readonly execute: ToolHandler<TParams, TResult>;
  /**
   * Per-tool execution timeout in milliseconds, overriding the registry's default.
   * Pass `0` to explicitly disable timeout enforcement for this tool.
   */
  readonly timeoutMs?: number | undefined;
}

/**
 * Creates a strongly-typed Tool definition with automatic JSON Schema conversion.
 */
export function defineTool<TParams, TResult>(
  options: DefineToolOptions<TParams, TResult>,
): Tool<TParams, TResult> {
  const jsonSchema = zodToJsonSchema(options.schema);
  const properties = (jsonSchema['properties'] ?? {}) as Record<string, ToolProperty>;
  const required = (jsonSchema['required'] ?? []) as string[];

  return {
    name: options.name,
    description: options.description,
    schema: options.schema,
    execute: options.execute,
    timeoutMs: options.timeoutMs,
    definition: {
      type: 'function',
      function: {
        name: options.name,
        description: options.description,
        parameters: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    },
  };
}
