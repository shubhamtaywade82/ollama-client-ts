# ADR 0003: Simultaneous Zod v3 and v4 Support

## Status

Accepted

## Context

Structured outputs (`chatWithSchema`, `generateWithSchema`), tool parameter schemas
(`defineTool`), and MCP tool adapters all accept a Zod schema and need to convert it to
JSON Schema for Ollama's `format` parameter. Zod v4 ships a native `z.toJSONSchema()`
converter; Zod v3 does not.

At the time of this decision, Zod v3 is still the version installed in a large share of
existing TypeScript projects, while Zod v4 is the version most new projects reach for.
Requiring a specific major version as a direct `dependency` would either bundle a second
copy of Zod into every consumer's `node_modules` (bloat, and two different `z.object`
identities that don't type-check against each other) or force every consumer onto
whichever version this package happened to pin.

## Decision

- `zod` is declared as a `peerDependency` with range `^3.22.0 || ^4.0.0` (see also: the
  package.json diff moving it out of `dependencies`), not a bundled dependency.
- `zodToJsonSchema()` (`src/schema/zod.ts`) branches at runtime:
  1. If the installed `zod`'s `z.toJSONSchema` exists (v4+), use it directly.
  2. Otherwise, fall back to `zodV3ToJsonSchema()`, a structural converter that reads
     Zod v3's internal `_def.typeName` shape directly (`ZodObject`, `ZodString`,
     `ZodNumber`, `ZodBoolean`, `ZodDate`, `ZodArray`, `ZodEnum`, `ZodNativeEnum`,
     `ZodLiteral`, `ZodOptional`/`ZodNullable`/`ZodDefault` unwrapping, `ZodEffects`
     unwrapping, `ZodUnion`, `ZodRecord`) and produces the equivalent JSON Schema by
     hand.
- `parseStructuredOutput()` does not need version branching: it only calls
  `schema.safeParse(...)`, which has an identical signature and behavior across v3 and
  v4.

## Rationale

- **`_def` is intentionally treated as an internal-but-stable enough surface for a
  fallback**, not a public Zod API. It's acceptable here because: (a) it's read-only
  introspection, never construction; (b) it's isolated to a single function
  (`zodV3ToJsonSchema`) with unit test coverage against a hand-built v3-shaped fixture,
  so a future Zod v3 patch release that changes `_def` internals fails a fast, local test
  rather than corrupting output silently; (c) the alternative — taking a dependency on
  the third-party `zod-to-json-schema` package — would reintroduce exactly the bundled
  dependency risk this ADR exists to avoid, for a package that itself would need to track
  Zod's internals just as closely.
- **A prior implementation of this fallback silently returned `{ type: 'object' }`**
  for any non-v4 schema, which type-checked and shipped without error but produced
  useless JSON Schema hints for every Zod v3 user — Ollama would receive no shape
  guidance at all, and `parseStructuredOutput`'s strict `safeParse` would then reject
  a higher proportion of model outputs. The structural walk directly addresses that
  silent failure mode.
- Choosing peer-dependency + runtime branching over "pick one major version and document
  the other as unsupported" was a direct response to the dependency-duplication risk
  flagged in review: a schema-validation library is exactly the kind of dependency where
  version identity (`instanceof`/type compatibility) matters to the consumer's own code,
  so consumers must control which copy they get.

## Consequences

- New Zod schema node types added to a project's schemas (e.g. `z.tuple()`,
  `z.intersection()`) that aren't in the `zodV3ToJsonSchema` switch fall back to
  `{ type: 'object' }` under Zod v3 only — this is a known, bounded gap, not a silent
  one, since it's the same explicit default branch used for any unrecognized node.
  Zod v4 users are unaffected, since `z.toJSONSchema` covers the full schema language.
- Any future Zod v5 release must be re-evaluated the same way: check whether
  `z.toJSONSchema` is still present/compatible, and only fall back to a hand-written
  walker if it changes shape again.
