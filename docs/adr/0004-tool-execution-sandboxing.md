# ADR 0004: Tool Execution Sandboxing Model

## Status
Accepted

## Context
`Agent` and `ToolRegistry` let a model decide, from its own output, which registered
tool to call and with what arguments. Both the choice of tool and its arguments are
therefore attacker- or hallucination-influenced input from the SDK's perspective, even
though `execute` itself is trusted, developer-authored code. Left unbounded, this opens
three concrete failure modes:

1. A tool call that never resolves (a hung network request, a bug, or arguments crafted
   to trigger pathological behavior) stalls `Agent.run`'s single-threaded loop forever,
   since nothing previously enforced an upper bound on `tool.execute`'s duration.
2. A single assistant turn can request many tool calls at once; `executeToolCalls` ran
   them all via an unconditional `Promise.all`, so nothing bounded how many ran
   concurrently — a burst of parallel calls could exhaust outbound connections, rate
   limits, or memory simultaneously.
3. A tool's return value flows directly into `outputString`, which gets appended to the
   conversation history and sent back to the model on the next turn. An unbounded or
   adversarially large result inflates memory and token/context cost with no ceiling.

A full solution to "arbitrary code execution driven by untrusted input" is running each
tool call in a genuinely isolated environment — a `worker_thread` with
`resourceLimits.maxOldGenerationSizeMb`, a separate process, or a `vm` context — which
enforces real CPU and memory limits and can be forcibly terminated. That was considered
and rejected for this iteration; see Rationale.

## Decision
`ToolRegistry` (`src/tools/registry.ts`) adds three independent, opt-in controls,
matching the shape of `ToolRegistryOptions`:

- **`timeoutMs`** (registry-level default) / **`Tool.timeoutMs`** (per-tool override,
  set via `defineTool({ ..., timeoutMs })`): races `tool.execute(...)` against a timer.
  On expiry, the registry aborts an internally created `AbortSignal` passed to the tool
  via `ToolExecutionContext.signal`, and the call fails with `OllamaToolTimeoutError`
  (carrying `toolName` and `timeoutMs`). The tool's own promise is not discarded — it's
  given a `.catch(() => undefined)` so a late rejection doesn't surface as an unhandled
  rejection — but nothing forcibly stops the underlying work if the tool doesn't check
  `signal`.
- **`maxConcurrency`**: `executeToolCalls` runs a small pull-based worker pool (bounded
  number of workers pulling from a shared index) instead of unconditional `Promise.all`
  once the call count exceeds the limit; below the limit, behavior is unchanged.
- **`maxOutputChars`**: applied uniformly to both success (`outputString`) and failure
  (the `onError`-derived fallback message) paths via a shared `truncateOutput` helper,
  appending a `"[truncated N of M chars]"` marker. `result.result` (the raw, untruncated
  value) is left untouched for callers that need the full data outside the
  conversation-history path.

All three default to `undefined` (disabled), preserving existing behavior for current
consumers. Nothing is force-enabled by default.

## Rationale
- **Cooperative timeout over true isolation, for this iteration.** Moving `tool.execute`
  into a `worker_thread` would require it to be a value transferable/loadable across the
  thread boundary — effectively requiring tools to be defined as separate modules rather
  than inline closures, which is how every tool in this codebase and its examples is
  currently defined (`defineTool({ execute: async (...) => ... })`). That's a breaking
  change to the `Tool`/`defineTool` API surface, not an additive one, and was judged too
  large to bundle into a dependency/observability-focused release pass. The cooperative
  model (timer + `AbortSignal`) was chosen because it's additive, requires zero API
  changes for tools that don't opt in, and still solves the most common real-world case:
  I/O-bound tools (HTTP calls, file/database reads) that already respect `AbortSignal`
  get genuinely cancelled; CPU-bound tools at least stop blocking the *agent loop's*
  progress, even though the orphaned work keeps running to completion in the background.
- **Defaults are opt-in, not enforced, deliberately.** An enforced default timeout could
  silently break existing consumers whose tools legitimately run long (large file
  processing, slow upstream APIs) with no way to know why calls started failing after an
  upgrade. Given the package is pre-1.0 and behavior changes are expected to be called
  out explicitly rather than silently defaulted-on, the safer contract is: the mechanism
  ships, the policy (thresholds) is the application's decision informed by its own
  tools' expected latency and trust level.
- **`maxOutputChars` over a hard byte-limit or streaming truncation.** Character count is
  a simple, predictable proxy for both memory footprint and (roughly) token cost, and
  matches how the rest of the codebase already reasons about `outputString` (a single
  synchronous string, not a stream). A byte-accurate or token-accurate limit would need
  a tokenizer dependency for a marginal accuracy gain not worth the added dependency.
- **No enforced `.strict()` on tool schemas.** Zod's default "strip unknown keys"
  behavior is permissive but not unsafe by itself — `execute` only ever receives
  `parseResult.data`, which is the *validated* shape, so stripped extra keys can't smuggle
  unvalidated data into a tool. Forcing `.strict()` globally would be a behavior change
  for any existing schema that intentionally tolerates extra fields, so it's documented
  as guidance (README, "Tool Execution Safety & Sandboxing") rather than enforced.

## Consequences
- A tool that ignores `ToolExecutionContext.signal` and performs synchronous, CPU-bound
  work will still block the process past its configured `timeoutMs`; the registry will
  report a timeout failure to the agent loop at the correct time, but the orphaned work
  itself keeps consuming CPU until it naturally finishes. Tool authors doing
  CPU-intensive work are responsible for chunking it or checking `signal.aborted`
  themselves.
- There is still no per-tool memory ceiling. `maxOutputChars` bounds the *result* fed
  back into the conversation, not peak memory used while `execute` runs. A true memory
  limit remains dependent on the worker-thread/process-isolation redesign described
  above, which is out of scope here.
- Existing consumers see no behavior change until they explicitly set `timeoutMs`,
  `maxConcurrency`, or `maxOutputChars`.
