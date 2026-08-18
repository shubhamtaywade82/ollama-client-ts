# ADR 0009: `AnyTool` and Registry Parameter Variance

## Status

Accepted

## Context

Found during 1.0.0 pre-publish verification, by installing the packed tarball into a
throwaway TypeScript project and compiling against the shipped `.d.ts` — i.e. from a
consumer's perspective rather than from inside the repo.

`ToolRegistry` typed everything it accepted and stored as `Tool<never, unknown>`:

```ts
constructor(toolsOrOptions?: readonly Tool<never, unknown>[] | ToolRegistryOptions)
register(tool: Tool<never, unknown>): this
```

`Tool<TParams, TResult>` is **invariant** in `TParams`, because `TParams` appears both
covariantly (`schema: z.ZodType<TParams>`) and contravariantly
(`execute: ToolHandler<TParams, TResult>`). `never` is therefore not a usable "bottom"
type here: nothing is assignable to `Tool<never, unknown>`. Every documented way of
building a registry failed to compile for a consumer:

```ts
const tool = defineTool({ name: 'echo', schema: z.object({ text: z.string() }), … });

new ToolRegistry([tool]);          // ✗ TS2322 — and this is the README's own example
new ToolRegistry({ tools: [tool] }); // ✗ TS2345
new ToolRegistry().register(tool);   // ✗ TS2345
```

Two things hid this:

1. **`tsconfig.json` scoped type-checking to `src/`**, excluding `test/`. Vitest transforms
   TypeScript with esbuild, which strips types _without_ checking them, so no test has ever
   been type-checked. 20 test files were effectively unverified.
2. **The repo's own tests worked around it with `as never` casts**
   (`registry.register(addTool as never)`, `new ToolRegistry([inventoryTool as never])`).
   Those casts read as incidental test noise, but each one was silently absorbing a real
   public-API defect. `src/mcp/mcp-tools.ts` carried the same tell — a
   `z.record(…) as unknown as z.ZodType<never>` double cast that existed only to satisfy
   the impossible type.

## Decision

Introduce a dedicated alias in `src/tools/types.ts` for a tool of _any_ parameter shape,
and use it everywhere a heterogeneous collection of tools is accepted or stored
(`ToolRegistry`'s constructor/`register`/`registerMany`/`get`/internal `Map`, and
`loadMcpTools`' return type):

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see doc comment.
export type AnyTool = Tool<any, unknown>;
```

`AnyTool` is exported from the package root, so consumers can annotate their own mixed
tool collections (`const tools: readonly AnyTool[] = [a, b]`).

Also:

- Added `tsconfig.typecheck.json`, which extends the base config but includes `src/`,
  `test/`, `bench/`, and `scripts/`. `npm run typecheck` now uses it, so tests are
  type-checked in CI. `tsconfig.json` keeps its `src/`-only scope for declaration emit.
- Removed the five now-unnecessary `as never` casts from the tests and the double cast
  from `mcp-tools.ts`, so those call sites exercise the real signature.
- Added `test/tool-registry-typing.test.ts`, a regression guard covering all three
  construction forms plus a mixed-shape registry, with no casts anywhere — it fails at
  _compile_ time if the signature regresses.

## Rationale

- **`any` over `unknown` or a structural interface.** `Tool<unknown, unknown>` fails for
  the same invariance reason `never` does. A hand-rolled structural interface (typing
  `schema` as just `{ safeParse(data: unknown): … }`) would work, but it duplicates Zod's
  shape, drifts as Zod evolves, and buys nothing: the registry's only interaction with a
  tool's params is handing `schema.safeParse`'s validated output straight back to that
  same tool's `execute`. `any` in one aliased position is the standard, honest escape
  hatch for a heterogeneous collection of generic types.
- **Type safety is preserved where it actually matters.** `defineTool` still infers
  `TParams` from the Zod schema and still type-checks `execute` against it — that's the
  boundary where a tool author can make a real mistake, and it is untouched. Only the
  registry's _storage_ type is widened. The regression test asserts this explicitly.
- **The `eslint-disable` is scoped to one line, with a pointer to the reasoning.** This is
  the codebase's only `any`; the project's `@typescript-eslint/no-explicit-any: error` rule
  stays on everywhere else.
- **Type-checking tests, rather than just fixing this one signature.** The signature bug
  was a symptom; the cause was a category of code that no check ever looked at. Enabling
  it surfaced zero other errors, so the cost was one config file.

## Consequences

- `AnyTool` is new public API. Widening the registry's accepted type is **not** a breaking
  change — code that previously compiled (including `as never` casts) still compiles.
- The published `.d.ts` now contains `Tool<any, unknown>` in the registry signatures.
  Consumers with `noImplicitAny` are unaffected (that rule governs inference, not explicit
  `any` in a dependency's types), but anyone linting dependency types with
  `no-explicit-any` may see it.
- `npm run typecheck` is now slower (it compiles ~2× the files) and can fail on test-only
  type errors that previously went unnoticed. That is the intended trade.
- This does not retroactively validate the _runtime_ behavior the `as never` casts were
  attached to — those tests passed before and after, because the casts only ever affected
  compile-time checking.
