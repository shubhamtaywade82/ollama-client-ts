# ADR 0006: Edge Runtime CI Verification and Benchmarks

## Status

Accepted

## Context

The README and ADR 0002 (dual ESM/CJS packaging) both claim this SDK is safe to deploy
to Edge runtimes (Cloudflare Workers, Vercel Edge Runtime, Next.js Edge middleware/route
handlers) because the core client is built entirely on native `fetch` and Web Streams,
with the one Node-only module (`src/skills/skill-registry.ts`, which reads `SKILL.md`
files via `node:fs/promises`) isolated behind the separate `./skills` subpath export.

That claim had never been mechanically verified. It rested on:

1. A manual `grep` for `node:`/`process.`/`Buffer` imports outside `src/skills/` (done
   ad hoc, not run in CI), and
2. Trusting that `tsup`'s (esbuild's) tree-shaking correctly drops the unused
   `SkillRegistry` export — and its `node:fs/promises`/`node:path` imports — from the
   main `dist/index.js` bundle, since `src/index.ts` re-exports a _subset_ of
   `src/skills/index.ts`, which itself does `export * from './skill-registry.js'`.

Barrel files with `export *` are a well-known way for unrelated Node-only code to leak
into a "universal" bundle if a bundler's tree-shaking doesn't fully eliminate an unused
re-export chain — and real Edge platforms don't degrade gracefully when that happens:
Cloudflare Workers' and Vercel Edge Runtime's own build steps hard-fail the deployment
the moment a `node:*` import survives into the bundle they try to run. A regression here
would not surface until a consumer's Edge deployment broke, with no earlier signal.

The 1.0.0 readiness checklist also called for a benchmark suite, to give hot paths (NDJSON
stream parsing, Zod schema conversion, tool dispatch, the request pipeline) a numeric
baseline that future changes can be measured against.

## Decision

### Edge runtime verification (`scripts/verify-edge-runtime.ts`, `npm run verify:edge-runtime`)

A script (run via `tsx`, executed against the _built_ `dist/index.js`, not source) that:

1. **Bundles** a small entry point importing from `dist/index.js` with `esbuild`,
   `platform: 'browser'`, `format: 'iife'`. Browser-platform bundling refuses to resolve
   `node:*`-scheme imports, so this step fails with a clear "Could not resolve" error the
   moment any Node-only code leaks into the main entry point — the same failure mode a
   real Cloudflare Workers or Vercel Edge Runtime deployment would hit. This was verified
   to actually catch a regression: temporarily adding a `node:fs` import to `client.ts`
   made this step fail with `Could not resolve "fs"` before the fix was reverted.
2. **Executes** the resulting bundle inside `@edge-runtime/vm`'s `EdgeVM` — a real V8
   context (via Node's own `vm` module, the same mechanism Vercel's Edge Runtime uses
   internally) that exposes only Web Standard globals (`fetch`, `Request`, `Response`,
   streams, `crypto`) and nothing Node-specific (no `process`, `Buffer`, `require`,
   filesystem). A full `OllamaClient` + `Agent` + `ToolRegistry` tool-calling round trip
   runs inside that sandbox against a mocked `fetch`, so this doesn't just prove "no
   disallowed import survived bundling" — it proves the SDK's actual request/streaming/
   tool-execution/telemetry code _runs correctly_ with nothing but Web Standard APIs.

Wired into CI as its own `edge-runtime` job (`.github/workflows/ci.yml`), gated on the
main `test` job, running after `npm run build`. Also added to `verify`/`prepublishOnly`
so a local release build can't skip it either.

### Benchmarks (`bench/*.bench.ts`, `npm run bench`)

Uses `vitest bench` (`vitest`'s built-in `tinybench`-based runner) — no new dependency,
since `vitest` is already a devDependency and its default file-discovery glob for `bench`
(`**/*.bench.ts`) doesn't overlap with `test`'s (`**/*.test.ts`), so no config changes
were needed to keep the two commands from picking up each other's files. Four suites:

- `bench/streaming.bench.ts` — `parseNdjsonStream` throughput at 100/1,000/10,000 chunks.
- `bench/schema.bench.ts` — `zodToJsonSchema` (simple vs. nested schema) and
  `parseStructuredOutput` (raw vs. markdown-fenced JSON).
- `bench/tools.bench.ts` — `ToolRegistry.executeToolCall`/`executeToolCalls` dispatch
  overhead, including the `withSpan` wrapper added in ADR 0005 — this is the concrete,
  numeric counterpart to that ADR's "cheap no-op when untraced" claim.
- `bench/client.bench.ts` — `OllamaClient.chat` end-to-end overhead (retry wrapping,
  endpoint failover, span wrapping, JSON parsing, error mapping) layered on top of a
  mocked, instant `fetch`, both single-endpoint and against a 3-endpoint failover
  registry.

Wired into CI as its own `benchmarks` job, gated on `test`. `vitest bench` has no
pass/fail performance thresholds — it measures and reports — so this job fails CI only
if benched code throws, not on timing variance from a noisy shared runner; it exists to
give humans reviewing a PR that touches a hot path a number to look at, not to gate
merges on absolute throughput.

## Rationale

- **Verify the built artifact, not the source.** Grepping `src/` for `node:` imports (as
  was done manually before this ADR) can't tell you whether a bundler's tree-shaking
  actually eliminates an unused Node-only re-export — which is exactly the risk here,
  given `src/skills/index.ts`'s `export *` chain. Only bundling and running the real
  `dist/index.js` output answers the actual question a consumer cares about.
- **`esbuild` (via its JS API) over a hand-rolled static-analysis check.** `esbuild` is
  already present in this project's dependency tree via `tsup`, and its `platform:
'browser'` resolution behavior is a direct, well-maintained proxy for what Cloudflare's
  and Vercel's own bundlers do — reimplementing that resolution logic by hand (walking
  the import graph looking for `node:` specifiers) would be strictly worse: slower to
  keep correct, and blind to indirect leaks through re-export chains the way a real
  bundler isn't.
- **`@edge-runtime/vm` over a real `wrangler`/Cloudflare Workers dev server.** Both would
  give a real Edge sandbox, but `@edge-runtime/vm` is a plain npm package (Vercel's own
  Edge Runtime implementation, extracted as a library) that runs synchronously in the
  same CI job with no external account, network egress, or long-lived process to manage
  — important for keeping this check fast and hermetic in CI. It's the same primitive
  Next.js itself uses to test edge-safety of its own runtime.
- **A full functional round trip over a bare "does it throw on import" check.** Confirming
  the bundle loads without a `ReferenceError` proves the _absence_ of a Node dependency,
  but says nothing about whether the SDK's Web Standard-based code paths (native `fetch`,
  `ReadableStream`-based NDJSON parsing, `AbortController` composition in tool timeouts)
  actually behave correctly under a stricter, non-Node global environment. Running a real
  `Agent` + tool-calling loop catches both classes of failure in one check.
- **`vitest bench` over a separate benchmarking library** (e.g. `tinybench` directly,
  `benny`). `vitest` already depends on `tinybench` internally for its `bench` API, so
  this is the zero-new-dependency option, and it reuses the same test file conventions,
  TypeScript transform, and `describe`/import ergonomics contributors already know from
  `test/*.test.ts`.

## Consequences

- `dist/` must exist before `verify:edge-runtime` can run (it inspects the built
  artifact); the script fails fast with a clear message if `dist/index.js` is missing
  rather than silently no-op-ing, and both `verify` and `prepublishOnly` now run `build`
  before it.
- The edge-runtime check only covers the main `.` export (`dist/index.js`). The
  `./skills` subpath is _expected_ to use Node APIs (that's the entire reason it's a
  separate export) and is intentionally not exercised by this check.
- `esbuild`, `@edge-runtime/vm`, and `@edge-runtime/primitives` are new devDependencies.
  None are runtime dependencies of the published package — they exist purely to power
  this CI/local verification step — so this doesn't affect the zero-runtime-dependency
  posture described in ADR 0005/README.
- Benchmark numbers in this ADR's CI output are informative, not archived or compared
  automatically run-to-run; noticing a regression still requires a human to look at the
  `benchmarks` job's output on a PR that touches a hot path. Automated historical
  tracking (e.g. `github-action-benchmark`) was considered and deferred as unnecessary
  scope for this pass.
