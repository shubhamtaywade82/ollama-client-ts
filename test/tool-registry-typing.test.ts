import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool, ToolRegistry } from '../src/tools/index.js';
import type { AnyTool } from '../src/tools/index.js';

/**
 * Regression guard for a public-API defect found during 1.0.0 pre-publish verification:
 * `ToolRegistry` accepted `Tool<never, unknown>`, which — because `Tool` is invariant in
 * `TParams` — no concrete `defineTool(...)` result could ever satisfy. Every documented
 * way of building a registry failed to compile for consumers, and the repo's own tests
 * had masked it with `as never` casts (they were never type-checked, since `tsconfig.json`
 * excluded `test/`).
 *
 * These assertions are primarily **compile-time**: this file is now covered by
 * `npm run typecheck` (via `tsconfig.typecheck.json`), so if the registry's signature
 * regresses, typecheck fails — no cast anywhere below. The runtime `expect`s just confirm
 * the tools are actually usable once registered.
 */
describe('ToolRegistry accepts concretely-typed tools without casts', () => {
  const stringTool = defineTool({
    name: 'echo',
    description: 'Echoes text',
    schema: z.object({ text: z.string() }),
    execute: ({ text }) => text,
  });

  const numberTool = defineTool({
    name: 'add',
    description: 'Adds two numbers',
    schema: z.object({ a: z.number(), b: z.number() }),
    execute: ({ a, b }) => a + b,
  });

  it('accepts an array of tools (the form the README documents)', async () => {
    const registry = new ToolRegistry([stringTool]);
    const result = await registry.executeToolCall({
      function: { name: 'echo', arguments: { text: 'hi' } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an options object with a tools array', async () => {
    const registry = new ToolRegistry({ tools: [stringTool] });
    const result = await registry.executeToolCall({
      function: { name: 'echo', arguments: { text: 'hi' } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts .register() / .registerMany() with concrete tools', async () => {
    const registry = new ToolRegistry().register(stringTool).registerMany([numberTool]);
    const result = await registry.executeToolCall({
      function: { name: 'add', arguments: { a: 2, b: 3 } },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.result).toBe(5);
  });

  it('holds tools of differing parameter shapes in one registry', async () => {
    // The whole point of AnyTool: a heterogeneous collection. Both tools have entirely
    // different `TParams`, and neither needs a cast.
    const mixed: readonly AnyTool[] = [stringTool, numberTool];
    const registry = new ToolRegistry(mixed);

    expect(
      registry
        .definitions()
        .map((d) => d.function.name)
        .sort(),
    ).toEqual(['add', 'echo']);
    expect(registry.get('echo')).toBeDefined();
    expect(registry.get('add')).toBeDefined();
  });

  it('still type-checks execute against the schema inside defineTool', () => {
    // Type safety is preserved where it matters: `execute`'s params are inferred from the
    // Zod schema, not widened to `any`. A mismatch here would be a compile error.
    const typed = defineTool({
      name: 'typed',
      description: 'Params are inferred from the schema',
      schema: z.object({ count: z.number() }),
      execute: ({ count }) => {
        const doubled: number = count * 2;
        return doubled;
      },
    });
    expect(typed.definition.function.name).toBe('typed');
  });
});
