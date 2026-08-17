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
- **Architecture Decision Records:** `docs/adr/` documents the rationale behind the circuit breaker failure model, the dual ESM/CJS packaging strategy, Zod v3/v4 dual support, the tool execution sandboxing model, and OpenTelemetry instrumentation.
- **OpenTelemetry Instrumentation:** Automatic spans (`@opentelemetry/api` is an optional peer dependency, a no-op when absent or unconfigured) for HTTP requests, endpoint failover attempts, non-streaming `chat`/`generate` calls (using the Gen AI semantic conventions, including token usage), and `Agent` runs (`invoke_agent` → `ollama.agent.turn` → `execute_tool`). See [ADR 0005](./docs/adr/0005-opentelemetry-instrumentation.md).
- **Protocol Compatibility Bridges:**
  - OpenAI compatibility bridge (`/v1/chat/completions`, `/v1/models`).
  - Anthropic compatibility bridge (`/v1/messages`).
- **Web Standard Stream Adapters:**
  - `toTextStream`, `toDataStream`, and `toResponse` for direct integration with Next.js, Vercel AI SDK, and Web standard streams.
- **Skills System:**
  - Frontmatter parser for `SKILL.md` documents.
  - Skill composition and prompt injection into system messages (`applySkill`).
- **Testing & Quality Assurance:**
  - 4-tier test architecture: Unit, Integration, Functional, and Behavioral testing (50 tests).
  - VCR record and replay harness with real cassettes generated against `qwen3.5:2b` and `nomic-embed-text:latest`.
  - Multi-node CI/CD workflow (Node 18, 20, 22) and automated npm release with provenance.
