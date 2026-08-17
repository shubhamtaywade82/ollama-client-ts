/**
 * Tool definition, handler, and execution types.
 */

import type { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export interface ToolExecutionContext {
  readonly signal?: AbortSignal | undefined;
}

export type ToolHandler<TParams, TResult> = (
  params: TParams,
  context: ToolExecutionContext,
) => Promise<TResult> | TResult;

export interface Tool<TParams = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<TParams>;
  readonly execute: ToolHandler<TParams, TResult>;
  readonly definition: ToolDefinition;
  /**
   * Per-tool execution timeout in milliseconds, overriding the registry's default.
   * Pass `0` to explicitly disable timeout enforcement for this tool.
   */
  readonly timeoutMs?: number | undefined;
}

export interface ToolExecutionSuccess {
  readonly toolName: string;
  readonly success: true;
  readonly result: unknown;
  readonly outputString: string;
}

export interface ToolExecutionFailure {
  readonly toolName: string;
  readonly success: false;
  readonly error: Error;
  readonly outputString: string;
}

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;
