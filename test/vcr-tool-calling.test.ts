import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool } from '../src/tools/define-tool.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { Agent } from '../src/agent/agent.js';
import { useVcr } from './vcr.js';

describe('Thorough Tool Calling & Agent Capabilities', () => {
  const TOOL_MODEL = 'llama3.2:1b';
  const AGENT_MODEL = 'qwen2.5:0.5b';

  it('handles single tool invocation with strict parameters', async () => {
    await useVcr('thorough_single_tool', async (client) => {
      const squareTool = defineTool({
        name: 'calculate_square',
        description: 'Calculates square of a number',
        schema: z.object({
          number: z.number(),
        }),
        execute: ({ number }) => ({
          square: number * number,
        }),
      });

      const registry = new ToolRegistry([squareTool as never]);
      const res = await client.chat({
        model: TOOL_MODEL,
        messages: [
          {
            role: 'user',
            content: 'What is the square of 9? You MUST call calculate_square tool.',
          },
        ],
        tools: registry.definitions(),
        options: { temperature: 0 },
        stream: false,
      });

      expect(res.message.tool_calls).toBeDefined();
      expect(res.message.tool_calls?.length).toBeGreaterThanOrEqual(1);
      const call = res.message.tool_calls?.[0];
      expect(call?.function.name).toBe('calculate_square');
    });
  }, 120_000);

  it('runs multi-turn autonomous tool execution loop to answer user question', async () => {
    await useVcr('thorough_multi_turn_agent', async (client) => {
      const squareTool = defineTool({
        name: 'calculate_square',
        description: 'Calculates square of a number',
        schema: z.object({ number: z.number() }),
        execute: ({ number }) => ({ square: number * number }),
      });

      const registry = new ToolRegistry([squareTool as never]);
      const executedToolNames: string[] = [];

      const agent = new Agent(client, {
        tools: registry,
        maxIterations: 5,
        hooks: {
          onToolCallStart: (call) => {
            executedToolNames.push(call.function.name);
          },
        },
      });

      const result = await agent.run({
        model: AGENT_MODEL,
        messages: [
          { role: 'user', content: 'What is the square of 9? Use the calculate_square tool.' },
        ],
        options: { temperature: 0 },
      });

      expect(executedToolNames).toContain('calculate_square');
      expect(result.finalMessage.content).toContain('81');
      expect(result.turns.length).toBeGreaterThanOrEqual(2);
    });
  }, 120_000);

  it('handles tool execution failures gracefully and continues reasoning', async () => {
    await useVcr('thorough_tool_error_handling', async (client) => {
      const failingTool = defineTool({
        name: 'risky_calculator',
        description: 'Performs arithmetic calculation',
        schema: z.object({ query: z.string() }),
        execute: () => {
          throw new Error('Division by zero error');
        },
      });

      const registry = new ToolRegistry([failingTool as never]);
      const agent = new Agent(client, { tools: registry, maxIterations: 4 });

      const result = await agent.run({
        model: AGENT_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Calculate 10 / 0 with risky_calculator. If it fails, report error.',
          },
        ],
        options: { temperature: 0 },
      });

      expect(result.turns.length).toBeGreaterThanOrEqual(1);
      expect(result.finalMessage.content.length).toBeGreaterThan(0);
    });
  }, 120_000);
});
