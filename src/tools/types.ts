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

/**
 * A `Tool` of *any* parameter shape, for heterogeneous collections — i.e. what
 * `ToolRegistry` stores and accepts.
 *
 * `Tool<TParams>` is **invariant** in `TParams`, because `TParams` appears both
 * covariantly (`schema: z.ZodType<TParams>`) and contravariantly
 * (`execute: ToolHandler<TParams, …>`). That makes `Tool<never, unknown>` — the obvious-
 * looking "bottom" type for a mixed collection — assignable from *nothing*: a perfectly
 * ordinary `Tool<{ city: string }, string>` from `defineTool` is rejected by it. `any` is
 * the standard escape hatch for exactly this case, and it is confined to this one alias:
 * `defineTool` still infers `TParams` from the Zod schema and still type-checks `execute`
 * against it, so tool authoring keeps full type safety. Only the registry's *storage*
 * type is widened, and the registry never does anything with a tool's params beyond
 * handing `schema.safeParse`'s validated output straight back to that same tool's
 * `execute`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see doc comment above.
export type AnyTool = Tool<any, unknown>;

export interface ToolExecutionSuccess {
  readonly toolName: string;
  /** Echoes the originating {@link ToolCall.id}, if the call had one. */
  readonly toolCallId?: string | undefined;
  readonly success: true;
  readonly result: unknown;
  readonly outputString: string;
}

export interface ToolExecutionFailure {
  readonly toolName: string;
  /** Echoes the originating {@link ToolCall.id}, if the call had one. */
  readonly toolCallId?: string | undefined;
  readonly success: false;
  readonly error: Error;
  readonly outputString: string;
}

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;
