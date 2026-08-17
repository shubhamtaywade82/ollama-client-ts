/**
 * Synthetic tool-call ID generation.
 *
 * Ollama's native `/api/chat` protocol does not assign an identifier to a tool call —
 * see the {@link ToolCall} docs in `../types.js`. To let consumers correlate a tool
 * result back to its call the way OpenAI's `tool_call_id` does (useful for logging,
 * OpenAI-shaped transcripts, or just not having to track array position by hand), the
 * SDK synthesizes a stable client-side `id` the first time it sees a tool call that
 * doesn't already have one, and reuses that same id everywhere that call is referenced
 * (the streamed `tool_call` event, the final aggregated message, `ToolExecutionResult`,
 * and the `role: 'tool'` history entry `Agent` appends). It has no meaning to Ollama or
 * the model itself — it's purely a client-side bookkeeping aid.
 *
 * Uses the global Web Crypto `crypto.randomUUID()` (available in Node 20+, browsers, and
 * every Edge runtime this SDK targets) rather than `node:crypto`, which would break Edge
 * Runtime compatibility (see ADR 0006).
 */

import type { ToolCall } from '../types.js';

export function generateToolCallId(): string {
  return `call_${crypto.randomUUID()}`;
}

/**
 * Returns `toolCalls` with every entry guaranteed to have an `id`, generating one for any
 * entry that lacks it. Entries that already have an `id` (e.g. re-processed calls) are
 * left untouched so ids stay stable across repeated calls on the same data.
 */
export function ensureToolCallIds(
  toolCalls: readonly ToolCall[] | undefined,
): readonly ToolCall[] | undefined {
  if (!toolCalls || toolCalls.length === 0) {
    return toolCalls;
  }
  return toolCalls.map((tc) => (tc.id !== undefined ? tc : { ...tc, id: generateToolCallId() }));
}
