# ADR 0002: Dual ESM/CJS Packaging Strategy

## Status
Accepted

## Context
The package must work as a dependency in both modern ESM projects (`"type": "module"`,
bundlers, Next.js/Vite) and legacy CommonJS projects (`require(...)`), without forcing
consumers onto one module system. TypeScript SDKs commonly get this wrong in ways that
only surface for the consumer at resolution time (wrong `.d.ts` picked, `require()` of an
ESM-only build, duplicate module instances from a `main`/`module`/`exports` mismatch) —
this is the "dual-package hazard."

Two subpath entry points are published: the root (`.`) and `./skills` (the skills-only
composition helpers), so consumers who only need `applySkill`/`parseFrontmatter` aren't
forced to pull in the full client.

## Decision
- **Build twice, from one source tree.** `tsup.config.ts` builds each entry
  (`src/index.ts`, `src/skills/index.ts`) to both `esm` and `cjs` formats in a single
  pass, rather than maintaining separate ESM/CJS source or a transpile-down-to-CJS-only
  approach.
- **`exports` map is the source of truth**, not `main`/`module`/`types`. Each subpath
  declares `import`/`require` conditions with their own `types` and `default` fields,
  and paired declaration extensions: `.d.ts` for the ESM build, `.d.cts` for the CJS
  build. `main`/`module`/`types` are kept as fallbacks for older resolvers that predate
  `exports` map support, but `exports` wins for any Node/bundler that honors it.
- **No `./package.json` omission.** `"./package.json": "./package.json"` is exported
  explicitly, since some tooling (e.g. package-manager version checks, `import.meta.resolve`
  patterns) expects to read it directly.
- **`typesVersions` fallback for `./skills`.** Declared alongside `exports` so
  pre-`exports`-aware TypeScript resolution (`moduleResolution: "node"`) still finds the
  right `.d.ts` for the `./skills` subpath.
- **Verification is automated, not manual.** `@arethetypeswrong/cli` runs in CI
  (`npm run check:types`) and is wired into `prepublishOnly`, checking Node10, Node16
  (from both `import` and `require`), and bundler resolution modes against the packed
  tarball on every release. A resolution mismatch fails the build rather than shipping
  and being discovered by a consumer.

## Rationale
- Hand-maintaining separate ESM and CJS source trees doubles the surface for bugs to
  diverge. A single source tree with dual compilation (via `tsup`, which wraps `esbuild`)
  keeps behavior identical between the two builds by construction.
- Relying on `exports` conditions instead of magic file-extension-based dual packages
  (e.g. `.mjs`/`.cjs` siblings inferred by extension alone) makes the ESM/CJS boundary
  explicit and keeps `sideEffects: false` meaningful for bundler tree-shaking.
- Automated `arethetypeswrong` checks were chosen over relying on manual testing in
  downstream projects, because dual-package type resolution bugs are notoriously easy to
  introduce silently (e.g. one export forgetting a `require` condition) and easy to miss
  in code review.

## Consequences
- Every new top-level export or subpath must be added to `exports` (and `typesVersions`
  if it's a subpath) — adding a file to `src/` alone does not make it consumable.
- Consumers on very old bundlers without `exports` map support fall back to `main`
  (CJS) — `module` is provided for ESM-aware bundlers that still read it, but modern
  `exports`-aware tooling should never need it.
