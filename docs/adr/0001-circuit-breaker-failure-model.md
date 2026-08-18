# ADR 0001: Circuit Breaker Failure Model

## Status

Accepted

## Context

`OllamaClient` can be configured with multiple endpoints (`endpoints: [...]`) for high
availability. When an endpoint is unhealthy, requests need to route around it without
manual intervention, and recover automatically once the endpoint is healthy again.

The two standard approaches are:

1. **Stateful circuit breaker** (closed / open / half-open) that rejects calls outright
   while open, with a probe request to decide when to transition to half-open.
2. **Fail-open failure counter** that simply deprioritizes an unhealthy endpoint for a
   cooldown window, while still allowing traffic through if no healthy endpoint exists.

## Decision

`EndpointRegistry` (`src/providers/endpoint-registry.ts`) implements the second model:

- Each endpoint tracks a `failureCount` and `lastFailureTimestamp`.
- An endpoint is considered "cooling down" once `failureCount >= failureThreshold`
  (default `3`) and `now - lastFailureTimestamp < cooldownMs` (default `30_000`).
- `candidates()` returns healthy endpoints first, sorted by `priority` descending.
- If **every** endpoint is cooling down, the registry fails open and returns all
  endpoints sorted by soonest-to-recover, rather than throwing.
- `reportSuccess` clears an endpoint's failure state immediately (no half-open probe
  step — the next successful call closes the circuit).

There is no dedicated "circuit open" error. `executeWithFailover` in `client.ts` walks
`candidates()` in order and only surfaces an error to the caller if every candidate in
the list fails during that call.

## Rationale

- **Local-first use case.** The primary deployment target is a local or small private
  Ollama fleet (1-3 endpoints), not a large service mesh. A hard-open circuit that
  rejects all traffic is the wrong default when there may be no other endpoint capable
  of serving the request — degraded service (routing to a struggling endpoint) is
  preferable to no service.
- **No background probing.** A classic half-open state requires a background timer or
  a dedicated probe request outside the normal request path. This library has no
  background scheduler; health state transitions are driven entirely by real traffic
  (`reportSuccess`/`reportFailure`), keeping the implementation dependency-free and
  synchronous.
- **Threshold and cooldown are counters, not statistics.** `failureThreshold` is a raw
  consecutive-ish failure count (reset only by success), and `cooldownMs` is a fixed
  window, not an exponential backoff. This is intentionally simple: combined with the
  retry layer's own exponential backoff with full jitter (see ADR 0003 candidate list —
  request-level retry), a fixed cooldown at the endpoint-selection layer avoids
  compounding two different backoff curves into unpredictable behavior.

## Consequences

- Consumers who need a true fail-fast circuit (reject immediately once open, never
  route to a known-bad endpoint even as a last resort) must implement that at the
  application layer using `client.healthCheck()` / `registry.status()`.
- Because failure counts never decay on their own (only `reportSuccess` clears them),
  an endpoint that fails once every `cooldownMs` will stay permanently at
  `failureCount = 1` and never enter cooldown — this is deliberate: transient,
  well-spaced failures should not take an endpoint out of rotation.
