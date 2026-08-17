# Architecture Decision Records

This directory records significant architectural decisions for
`@shubhamtaywade82/ollama-client-ts` — the context behind a choice, not just the choice
itself — so future maintainers don't have to reverse-engineer intent from the diff.

Format: one Markdown file per decision, numbered sequentially, following
[Status / Context / Decision / Rationale / Consequences].

| ADR | Title |
| --- | --- |
| [0001](./0001-circuit-breaker-failure-model.md) | Circuit Breaker Failure Model |
| [0002](./0002-dual-esm-cjs-packaging.md) | Dual ESM/CJS Packaging Strategy |
| [0003](./0003-zod-v3-v4-dual-support.md) | Simultaneous Zod v3 and v4 Support |

A new ADR is warranted for decisions that are expensive to reverse, affect the public
API surface or dependency contract, or where a future maintainer would reasonably ask
"why did we do it this way?" Routine implementation detail doesn't need one.
