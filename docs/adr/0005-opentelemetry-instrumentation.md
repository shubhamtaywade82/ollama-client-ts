# ADR 0005: OpenTelemetry Instrumentation

## Status

Accepted

## Context

Consumers running this SDK in production have no visibility into where time and
failures come from inside a single logical call: was it slow because of the model,
because of a failing endpoint that had to be retried, or because a tool call hung?
`debug`/`onLifecycleEvent`-style logging can answer "what happened" but not "how does
this fit into the request the caller is already tracing" — distributed tracing needs
span context propagation, not just structured log lines.

The SDK is deliberately zero-runtime-dependency (`package.json` carries no
`dependencies`, only `peerDependencies`/`devDependencies`; see ADR 0002 for the same
philosophy applied to packaging). Any tracing solution had to preserve that: consumers
who don't use OpenTelemetry must not pay for it in bundle size, install footprint, or
runtime behavior.

## Decision

`src/telemetry/tracer.ts` adds a single entry point, `withSpan(name, attributes, fn)`,
built on `@opentelemetry/api`:

- **`@opentelemetry/api` is an optional peer dependency** (`peerDependenciesMeta:
{ "@opentelemetry/api": { optional: true } }`), not a regular dependency. It is
  loaded via a cached dynamic `import('@opentelemetry/api')`; if the package isn't
  installed, the import rejects once, the rejection is cached as `undefined`, and every
  subsequent `withSpan` call just invokes its callback directly. No consumer who hasn't
  installed the package pays more than one failed import attempt for the life of the
  process.
- **When the package _is_ installed but no SDK has registered a global
  `TracerProvider`**, `trace.getTracer(...)` returns OpenTelemetry's own no-op
  `ProxyTracer`. `withSpan` still calls it, but span creation and every span method are
  cheap no-ops — this SDK does not need to detect "is a provider registered" itself,
  the API package already handles that degradation.
- **Instrumented call sites**, all using `withSpan`:
  - `HttpClient.request` / `requestStream` (`src/transport/http.ts`): one HTTP client
    span per network call, named `{METHOD} {route}` (blob digests are templated out of
    the name — `/api/blobs/{digest}` — to keep span names low-cardinality; the literal
    digest still appears in the `url.full` attribute). Attributes follow HTTP semantic
    conventions (`http.request.method`, `url.full`, `server.address`, `server.port`,
    `http.response.status_code`).
  - `OllamaClient.executeWithFailover` (`src/client.ts`): one `ollama.endpoint.attempt`
    span per candidate endpoint tried, carrying `ollama.endpoint.name` and
    `ollama.endpoint.attempt` (0-based index into the candidate list). Nests the
    `withRetry`-wrapped operation, so retry attempts against the same endpoint appear as
    sibling HTTP spans underneath.
  - `OllamaClient.chat` / `generate` non-streaming paths: a `chat {model}` /
    `text_completion {model}` span per call, using the OpenTelemetry Gen AI semantic
    conventions (`gen_ai.system=ollama`, `gen_ai.operation.name`,
    `gen_ai.request.model`, `gen_ai.response.model`, and — when Ollama reports them —
    `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` from
    `prompt_eval_count`/`eval_count`).
  - `Agent.run` (`src/agent/agent.ts`): an `invoke_agent {model}` span for the whole
    run (`ollama.agent.max_iterations` attribute) wrapping one `ollama.agent.turn` span
    per loop iteration (`ollama.agent.iteration`), which in turn wraps that turn's chat
    call and tool executions — giving a single trace tree for an entire multi-turn agent
    run.
  - `ToolRegistry.executeToolCall` (`src/tools/registry.ts`): an `execute_tool {name}`
    span (`gen_ai.tool.name`) around every tool call, including the registry's own
    not-registered/validation-failure/timeout paths.
- **Span status on success is left `Unset`, not forced to `Ok`.** Per the OpenTelemetry
  spec, `Ok` is final: implementations must ignore a later `Error` status once `Ok` has
  been set. `ToolRegistry.executeToolCall` reports failure through its return value
  (`{ success: false, error }`), not a throw, so the span it produces "succeeds" from
  `withSpan`'s point of view even when the tool failed. `setSpanError(span, error)`
  lets that call site mark the span `Error` after the fact; leaving success `Unset`
  keeps that legal. Backends treat `Unset` the same as `Ok` for alerting/filtering.

No client configuration option was added. Wiring in OpenTelemetry is fully automatic —
install `@opentelemetry/api` plus an SDK (e.g. `@opentelemetry/sdk-node`) and register a
`TracerProvider` the way every other OpenTelemetry-instrumented library expects, and
spans start flowing. This matches how ecosystem libraries (`undici`, `pg`, `ioredis`,
etc.) auto-instrument via the global API rather than requiring a tracer to be injected
through their own constructor.

## Rationale

- **Optional peer dependency + dynamic import over a hard dependency.** A hard
  dependency on `@opentelemetry/api` (even though the package itself is tiny and a
  no-op without a configured SDK) would still show up in `npm ls`, `dependencies` in
  `package.json`, and every install of this SDK — directly contradicting the
  zero-dependency positioning this project has held since 0.1.0. The optional-peer +
  dynamic-import pattern is the same one used by libraries like Prisma and Knex for
  optional native/telemetry integrations: it costs nothing when absent and works
  immediately when present, with no explicit "enable tracing" call required from the
  consumer.
- **No custom no-op `Span`/`Tracer` shim.** `@opentelemetry/api`'s own global registry
  already returns a fully functional no-op implementation when no provider is
  registered. Building a second, SDK-shaped fallback type here would duplicate that
  behavior and risk drifting from the real `Span` interface's shape over time; the
  `Otel.Span | undefined` parameter passed into `withSpan`'s callback exists only to
  distinguish "the package isn't installed at all" (skip everything, don't even try to
  call span methods) from "the package is installed and no-oping" (call through it,
  since it's safe to).
- **HTTP-layer instrumentation over per-operation instrumentation for full endpoint
  coverage.** Wrapping `HttpClient.request`/`requestStream` instruments every
  `OllamaClient`/`ModelsClient` operation (chat, generate, embed, model management, web
  search/fetch, blobs) with one change, rather than threading span creation through each
  of the dozen call sites in `client.ts`/`models-client.ts` individually. The richer
  Gen AI-specific spans (model, token usage) are layered on top only where Ollama
  returns that data in a single response — `chat`/`generate`'s non-streaming path.
- **Streaming responses get an HTTP span but not a Gen AI span, deliberately, for this
  iteration.** `HttpClient.requestStream` resolves once the response headers arrive and
  the NDJSON body starts parsing — the span it produces covers connection setup and
  time-to-first-byte, not full generation time, because the caller (`OllamaStream`)
  pulls chunks lazily and may do so long after `requestStream` returns. Producing a
  full-duration Gen AI span for streaming would require threading a span handle into
  `OllamaStream`'s pump loop and ending it on the `done`/`error` event instead of on
  function return — a real change to `src/streaming/stream.ts`'s dual iterator/event-
  emitter model, not an additive wrapper. Deferred; see Consequences.

## Consequences

- Consumers who want traces install `@opentelemetry/api` (and an SDK/exporter of their
  choice) and register a global `TracerProvider` — no code change in how they call this
  SDK. Consumers who don't are unaffected: no new dependency shows up, and the one
  cached failed dynamic import is the only overhead.
- Cross-span parent/child linkage (e.g. an HTTP span nesting under its
  `ollama.endpoint.attempt` parent) depends on the _consumer's_ OpenTelemetry SDK having
  registered a real `ContextManager` (`@opentelemetry/context-async-hooks` in Node),
  which `@opentelemetry/sdk-node`'s `NodeSDK` does automatically. Without one, spans are
  still created and exported, but the parent/child relationship implied by the call
  tree is lost since `@opentelemetry/api`'s default no-op context manager doesn't
  propagate across `await` boundaries.
- `client.chat(..., { stream: true })` / `client.generate(..., { stream: true })` and
  `ModelsClient.pull`/`push`/`create` streaming calls are covered by an HTTP client span
  only (time-to-first-byte), not a full-duration Gen AI span with token usage. A
  streaming call's total generation time and usage numbers are visible today via
  `stream.finalResult`/the `done` event, just not yet as span attributes on a span that
  spans that full duration.
- The `execute_tool` span's status can end up `Error` for tool inputs that were never
  the tool author's fault (unregistered tool name, schema validation failure) as well as
  genuine execution failures — `gen_ai.tool.name` plus the recorded exception's message
  disambiguates these in trace UI, but they aren't split into separate span kinds.
