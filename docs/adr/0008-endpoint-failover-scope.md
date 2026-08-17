# ADR 0008: Endpoint Failover Scope — Inference Operations Only

## Status

Accepted

## Context

This decision was revisited after initially being deferred (see the "Retry safety"
discussion around PR #7): should cross-endpoint failover skip retrying non-idempotent
operations, given a request might have reached/processed on the failed endpoint before
the client saw an error?

The initial framing — "is this operation idempotent/safe to retry?" — undersold the
actual risk for this SDK. `OllamaClient.executeWithFailover` retries a _different_
candidate endpoint, not the same one, when a failure's error code is in
`DEFAULT_FAILOVER_CODES`. For `chat`/`generate`/`embed`, a different Ollama endpoint
serving the same model genuinely is an interchangeable substitute — that's the entire
premise of the "High Availability & Failover" feature this SDK advertises, and Ollama's
inference endpoints are stateless per-request, so at worst a failover here means
duplicate inference cost, not corrupted state (and `Agent`'s tool execution only ever
acts on the one response `chat()` actually returns — retried/discarded attempts inside
`executeWithFailover` never reach `ToolRegistry`, so there is no duplicate tool-side-effect
risk from failover itself).

`ModelsClient` (`list`, `show`, `pull`, `push`, `create`, `delete`, `copy`, `ps`,
`version`, `createBlob`, `checkBlob`) and `OllamaClient.capabilities()` are a different
case entirely, and the "idempotency" framing doesn't fit them well. These operations
don't target _a_ model server — they target _the_ specific server's local model catalog
or blob store, which is server-specific state, not a replicated/interchangeable resource
across endpoints. Failing over `deleteModel` from endpoint A to endpoint B doesn't retry
"the same" delete — it deletes a model from an entirely different catalog, while leaving
the caller's actual target (the model on A) in an unknown state if A's request had
actually succeeded before the client saw a timeout. The same logic applies to `list`
(returns a different server's model inventory, silently), `show`/`capabilities` (reports
metadata for a model that may not even exist with the same characteristics on the
fallback server), and `pull`/`push`/`create`/`copy`/blob operations (mutate a store the
caller didn't intend to touch).

## Decision

`OllamaClient.executeWithFailover` gains a `singleEndpoint?: boolean` option (default
`false`). When `true`, only the single best candidate endpoint
(`registry.candidates()[0]`) is tried — same-endpoint retry via `withRetry` still
applies for transient blips against that one server, but there is no fallback to a
different endpoint on failure.

Every `ModelsClient` operation and `OllamaClient.capabilities()` now pass
`singleEndpoint: true`. `chat`, `generate`, `embed`, `embeddings`, `webSearch`, and
`webFetch` are unchanged — they keep full cross-endpoint failover, since those requests
genuinely are interchangeable across endpoints serving the same model.

Verified with tests asserting that a 503 from the primary endpoint on `listModels`,
`showModel`, `deleteModel`, `pullModel`, and `capabilities()` propagates directly
without ever contacting a configured secondary endpoint, contrasted with a test
confirming `chat` still fails over exactly as before.

## Rationale

- **This is a correctness fix, not a safety knob.** An idempotency flag frames the
  problem as "is retrying risky," implying the default (retry) is merely _unsafe in some
  cases_ but plausible in others. For `ModelsClient`, retrying against a different
  endpoint isn't unsafe — it's targeting the wrong resource outright, independent of
  whether the underlying HTTP verb is nominally idempotent (`DELETE`/`HEAD` are
  idempotent by HTTP semantics; that doesn't make failing them over to a different
  server's catalog meaningful). Solving "is this endpoint interchangeable for this
  operation" answers the actual question; a generic per-request idempotency flag would
  not, and would put the burden of getting it right on every caller instead of getting
  it right once, by category, in the SDK itself.
- **No opt-out was added.** Every `ModelsClient` operation is server-specific by
  construction — there's no scenario where a consumer legitimately wants `deleteModel` to
  land on "whichever endpoint answers first." If that need materializes, it's better
  served by the caller explicitly choosing an endpoint (construct a single-endpoint
  `OllamaClient`, or call each endpoint directly) than by a flag that reintroduces the
  wrong-target risk this ADR exists to close.
- **Same-endpoint retry (`withRetry`) is preserved, not disabled.** A transient
  connectivity blip to the _correct_ server should still be retried — that's safe
  regardless of this ADR, since it's still the same server, same catalog, same blob
  store. Only _cross_-endpoint fallback is disabled.
- **`capabilities()` was included alongside `ModelsClient` even though it lives on
  `OllamaClient` directly**, because it calls `/api/show` under the hood — the same
  per-server metadata endpoint `ModelsClient.show()` uses, and the same reasoning
  applies: a fallback endpoint's model metadata isn't a substitute for the intended
  endpoint's.

## Consequences

- In a multi-endpoint configuration, a transient failure on the primary endpoint now
  causes `listModels`/`showModel`/`pullModel`/`deleteModel`/etc. and `capabilities()` to
  fail directly (after same-endpoint retries are exhausted) rather than silently
  succeeding against a different server's catalog. This is a behavior change from prior
  releases, where these operations participated in the same failover loop as
  `chat`/`generate`. Consumers relying on the old (arguably incorrect) behavior — e.g.
  treating `listModels()` as "list models on any healthy endpoint" — will now see it
  scoped to the highest-priority healthy endpoint only.
- `chat`/`generate`/`embed`/`embeddings`/`webSearch`/`webFetch` behavior is unchanged;
  this ADR does not affect the SDK's core HA/failover value proposition for inference.
- Health-check/circuit-breaker state (`EndpointRegistry`) is still shared across all
  operations — a `ModelsClient` call against a single (best) candidate still reports
  success/failure into the same registry `chat`/`generate` read from, so repeated
  `ModelsClient` failures against the primary still count toward that endpoint's
  cooldown and eventually let a healthier candidate become the "best" one on a
  subsequent call.
