# Changelog

All notable changes to `@shubhamtaywade82/ollama-client-ts` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-16

### Added

- **Core Ollama REST API Client:**
  - Full support for `chat`, `generate`, `embed`, `embeddings`, `ps`, and `version`.
  - Zero-runtime-dependency HTTP transport with native `fetch`, streaming NDJSON parsing, and binary body blob uploads.
  - Multi-endpoint high availability registry with circuit breaker failover, priority routing, and health checks.
  - Configurable exponential backoff with full jitter, retryable error predicates, and timeout signal propagation.
- **Model Lifecycle & Blob Management:**
  - `createModel`, `pullModel`, `pushModel`, `copyModel`, `deleteModel`, `listModels`, `showModel`.
  - Dedicated blob management endpoints: `createBlob` (`POST /api/blobs/:digest`) and `checkBlob` (`HEAD /api/blobs/:digest`).
- **Structured Outputs & Schema Validation:**
  - Seamless Zod schema conversion to JSON Schema, supporting both Zod v4 (native `z.toJSONSchema`) and Zod v3 (structural fallback).
  - Structured output parsing with resilient markdown code fence JSON extraction and strict validation errors (`OllamaToolValidationError`).
  - `zod` is a peer dependency (`^3.22.0 || ^4.0.0`) rather than a bundled dependency, so consumers don't end up with a duplicate copy in `node_modules`.
- **Reasoning & Thinking Tokens:**
  - Native parsing of reasoning traces (`<think>` tags and `message.thinking`) with dual stream events (`thinking` vs `token`).
- **Agentic Workflow & Tool Calling:**
  - Autonomous multi-turn agent execution loop (`Agent`).
  - Tool definition helper (`defineTool`) with Zod parameter schemas.
  - Tool registry with duplicate detection and execution error recovery.
  - Model Context Protocol (MCP) server integration (`createMcpToolSet`, `registerMcpTools`).
  - Opt-in tool execution sandboxing: per-tool/registry `timeoutMs` (cooperative cancellation via `AbortSignal`, surfaced as `OllamaToolTimeoutError`), `maxConcurrency` bounding parallel tool calls, and `maxOutputChars` truncating oversized tool output before it re-enters the conversation history. See [ADR 0004](./docs/adr/0004-tool-execution-sandboxing.md).
  - Synthetic, client-generated `tool_call_id` correlation: `ToolCall.id`, `Message.tool_call_id`, and `ToolExecutionResult.toolCallId` — Ollama's native protocol has no call ID, so the SDK synthesizes a stable one (`crypto.randomUUID()`, the Web Standard global, not `node:crypto`, to stay Edge-safe) the first time it sees a call without one, and reuses it consistently across the streamed `tool_call` event, the final aggregated message, the tool execution result, and the `role: 'tool'` history entry `Agent` appends. Execution/result correlation by array order still works exactly as before; `id` is an additive convenience. See [ADR 0007](./docs/adr/0007-synthetic-tool-call-ids.md).
- **Architecture Decision Records:** `docs/adr/` documents the rationale behind the circuit breaker failure model, the dual ESM/CJS packaging strategy, Zod v3/v4 dual support, the tool execution sandboxing model, OpenTelemetry instrumentation, Edge runtime CI verification, and synthetic tool-call IDs.
- **OpenTelemetry Instrumentation:** Automatic spans (`@opentelemetry/api` is an optional peer dependency, a no-op when absent or unconfigured) for HTTP requests, endpoint failover attempts, non-streaming `chat`/`generate` calls (using the Gen AI semantic conventions, including token usage), and `Agent` runs (`invoke_agent` → `ollama.agent.turn` → `execute_tool`). See [ADR 0005](./docs/adr/0005-opentelemetry-instrumentation.md).
- **Edge Runtime CI Verification:** `npm run verify:edge-runtime` bundles `dist/index.js` for a browser/edge platform with `esbuild` (failing on any `node:*` import, matching Cloudflare Workers/Vercel Edge Runtime's own bundlers) and runs a full `OllamaClient` + `Agent` + tool-calling round trip inside `@edge-runtime/vm`'s sandboxed Edge Runtime — a real V8 context exposing only Web Standard globals. Wired into CI as its own job and into `verify`/`prepublishOnly`. See [ADR 0006](./docs/adr/0006-edge-runtime-ci-and-benchmarks.md).
- **Benchmarks:** `npm run bench` (via `vitest bench`, no new dependency) covers NDJSON stream parsing, Zod schema conversion/structured output parsing, `ToolRegistry` dispatch overhead, and `OllamaClient.chat`'s end-to-end request pipeline overhead. Wired into CI as its own job.
- **Protocol Compatibility Bridges:**
  - OpenAI compatibility bridge (`/v1/chat/completions`, `/v1/models`), including `stream_options.include_usage` and `tools` (function calling) typing — both confirmed supported by Ollama's OpenAI-compat layer; `tool_choice`/`parallel_tool_calls` are deliberately not typed, since Ollama documents `tool_choice` as explicitly unsupported. `@remarks` JSDoc on `OpenAICompatClient` scopes it as a documented subset of the OpenAI API, not the full Responses API surface.
  - Anthropic compatibility bridge (`/v1/messages`), including `cache_control` typing on content blocks for prompt caching. `@remarks` JSDoc on `AnthropicCompatClient` scopes it as a subset of the Messages API (no tool use, extended thinking, citations, files, or Batches API).
- **Capability Detection Fixes:** `ModelCapabilities.supportsStructuredOutputRequest` is no longer hardcoded `true` — it's inferred `false` for endpoints classified as `cloud` by `inferRuntimeMode` (Ollama Cloud does not currently support structured outputs) and documented as a best-effort heuristic, not a guarantee, since Ollama doesn't expose this as a queryable capability. Added `supportsThinking`, derived from the model's reported `thinking` capability.
- **Fail-Fast `OllamaUnsupportedCapabilityError`:** `chat`/`chatStream`/`chatWithSchema` and `generate`/`generateStream`/`generateWithSchema` now throw this error _before making any network call_ when `format` is set against an endpoint inferred as Ollama Cloud, instead of sending a request Ollama Cloud is known to reject. `unsupported_capability` is included in `DEFAULT_FAILOVER_CODES`, so a multi-endpoint setup tries the next candidate (e.g. a local fallback) before the error ever reaches the caller — verified with a test asserting the rejected cloud endpoint's URL is never actually fetched.
- **`dimensions` on `embed()`:** `EmbedRequestOptions.dimensions` lets callers request truncated embedding vectors, matching Ollama's `/api/embed` parameter.
- **Environment Variable Fallbacks:** `OllamaClient`'s default single-endpoint `baseUrl`/`apiKey` fall back to `OLLAMA_HOST`/`OLLAMA_API_KEY` (the same variables the official `ollama` CLI and client libraries read) when not passed explicitly, matching the convention of other major LLM SDKs. Guarded to remain a no-op (not a `ReferenceError`) on Edge runtimes where `process` doesn't exist. Explicit `config.baseUrl`/`config.apiKey`, and any use of `config.endpoints`, always take precedence.
- **Web Standard Stream Adapters:**
  - `toTextStream`, `toDataStream`, and `toResponse` for direct integration with Next.js, Vercel AI SDK, and Web standard streams.
- **Skills System:**
  - Frontmatter parser for `SKILL.md` documents.
  - Skill composition and prompt injection into system messages (`applySkill`).
- **Documentation Hygiene:** `OllamaClient.embeddings()` is now marked `@deprecated` (Ollama's `/api/embeddings` was superseded by `/api/embed`, exposed as `embed()`). `ToolCall`, `Agent`, and `ToolRegistry.executeToolCalls` document that Ollama's native tool-calling protocol has no wire-level call ID, dispatch/results are still ordered/concurrency-bounded rather than ID-driven, and that `id`/`tool_call_id` (see above) is a client-synthesized convenience layered on top, not a protocol guarantee.
- **Testing & Quality Assurance:**
  - New cancellation tests prove `AbortSignal` genuinely aborts the underlying `fetch` call (not just racing a promise) and propagates from `Agent.run` into `ToolExecutionContext.signal`, including the early-abort race where the signal is already aborted before the request starts.
  - 4-tier test architecture: Unit, Integration, Functional, and Behavioral testing (50 tests).
  - VCR record and replay harness with real cassettes generated against `qwen3.5:2b` and `nomic-embed-text:latest`.
  - Multi-node CI/CD workflow (Node 18, 20, 22) and automated npm release with provenance.
