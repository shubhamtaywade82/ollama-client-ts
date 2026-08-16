import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool, ToolRegistry } from '../src/tools/index.js';

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
    registry.register(addTool as never);

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
    registry.register(addTool as never);

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
});
