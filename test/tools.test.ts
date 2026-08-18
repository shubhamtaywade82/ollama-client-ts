import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool, ToolRegistry } from '../src/tools/index.js';
import { OllamaToolTimeoutError } from '../src/errors.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('Tools & ToolRegistry', () => {
  const calculatorSchema = z.object({
    a: z.number(),
    b: z.number(),
    operation: z.enum(['add', 'subtract']),
  });

  const addTool = defineTool({
    name: 'calculate',
    description: 'Perform basic math',
    schema: calculatorSchema,
    execute: ({ a, b, operation }) => {
      return operation === 'add' ? a + b : a - b;
    },
  });

  it('generates valid Ollama tool definition', () => {
    expect(addTool.definition.type).toBe('function');
    expect(addTool.definition.function.name).toBe('calculate');
    expect(addTool.definition.function.parameters.type).toBe('object');
  });

  it('executes tool call with valid args', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const result = await registry.executeToolCall({
      function: {
        name: 'calculate',
        arguments: { a: 10, b: 5, operation: 'add' },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result).toBe(15);
      expect(result.outputString).toBe('15');
    }
  });

  it('returns failure on invalid schema args', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const result = await registry.executeToolCall({
      function: {
        name: 'calculate',
        arguments: { a: 'invalid', b: 5, operation: 'multiply' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('handles unregistered tool gracefully', async () => {
    const registry = new ToolRegistry();
    const result = await registry.executeToolCall({
      function: {
        name: 'non_existent',
        arguments: {},
      },
    });

    expect(result.success).toBe(false);
    expect(result.outputString).toContain('not registered');
  });

  describe('sandboxing: timeouts, concurrency, and output limits', () => {
    const slowTool = defineTool({
      name: 'slow_tool',
      description: 'Takes a while to resolve',
      schema: z.object({}),
      execute: async (_params, ctx) => {
        await sleep(50);
        if (ctx.signal?.aborted) throw ctx.signal.reason;
        return 'done';
      },
    });

    it('fails a tool call that exceeds the registry default timeout', async () => {
      const registry = new ToolRegistry({ tools: [slowTool], timeoutMs: 5 });

      const result = await registry.executeToolCall({
        function: { name: 'slow_tool', arguments: {} },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(OllamaToolTimeoutError);
      }
    });

    it('lets a tool finish when it completes within the timeout', async () => {
      const registry = new ToolRegistry({ tools: [slowTool], timeoutMs: 500 });

      const result = await registry.executeToolCall({
        function: { name: 'slow_tool', arguments: {} },
      });

      expect(result.success).toBe(true);
    });

    it('lets a per-tool timeoutMs override the registry default', async () => {
      const overriddenTool = defineTool({
        ...slowTool,
        timeoutMs: 500,
      });
      const registry = new ToolRegistry({ tools: [overriddenTool], timeoutMs: 5 });

      const result = await registry.executeToolCall({
        function: { name: 'slow_tool', arguments: {} },
      });

      expect(result.success).toBe(true);
    });

    it('caps concurrent tool executions at maxConcurrency', async () => {
      let concurrent = 0;
      let maxObservedConcurrency = 0;
      const trackingTool = defineTool({
        name: 'tracking_tool',
        description: 'Tracks how many instances run concurrently',
        schema: z.object({}),
        execute: async () => {
          concurrent += 1;
          maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrent);
          await sleep(20);
          concurrent -= 1;
          return 'ok';
        },
      });
      const registry = new ToolRegistry({ tools: [trackingTool], maxConcurrency: 2 });

      const calls = Array.from({ length: 6 }, () => ({
        function: { name: 'tracking_tool', arguments: {} },
      }));
      const results = await registry.executeToolCalls(calls);

      expect(results).toHaveLength(6);
      expect(results.every((r) => r.success)).toBe(true);
      expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
    });

    it('truncates output exceeding maxOutputChars', async () => {
      const bigOutputTool = defineTool({
        name: 'big_output',
        description: 'Returns a large string',
        schema: z.object({}),
        execute: () => 'x'.repeat(1000),
      });
      const registry = new ToolRegistry({ tools: [bigOutputTool], maxOutputChars: 100 });

      const result = await registry.executeToolCall({
        function: { name: 'big_output', arguments: {} },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outputString.length).toBeLessThan(1000);
        expect(result.outputString).toContain('truncated');
        // The full, untruncated value is still available on `result.result`.
        expect(result.result).toBe('x'.repeat(1000));
      }
    });
  });
});
