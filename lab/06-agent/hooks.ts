import { z } from 'zod';
import { Agent, defineTool, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const randomTool = defineTool({
  name: 'generate_random_int',
  description: 'Generate a random integer between min and max',
  schema: z.object({ min: z.number(), max: z.number() }),
  execute: async ({ min, max }) => ({ result: Math.floor(Math.random() * (max - min + 1)) + min }),
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const registry = new ToolRegistry([randomTool]);
  const hookEvents: string[] = [];

  const agent = new Agent(client, {
    tools: registry,
    maxIterations: 4,
    hooks: {
      onTurnStart: (iteration) => hookEvents.push(`turn_start_${iteration}`),
      onToolCallStart: (tc) => hookEvents.push(`tool_start_${tc.function.name}`),
      onToolCallEnd: (res) => hookEvents.push(`tool_end_${res.toolName}_success_${res.success}`),
      onTurnEnd: (turn) => hookEvents.push(`turn_end_${turn.iteration}`),
    },
  });

  try {
    const res = await agent.run({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Generate a random number between 1 and 100.' }],
    });

    await labLogger.log({
      experimentId: '06-agent-hooks',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'agent-lifecycle-hooks',
      response: {
        finalAnswer: res.finalMessage.content,
        capturedHooks: hookEvents,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '06-agent-hooks',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'agent-lifecycle-hooks',
      error: (err as Error).message,
    });
  }
}

void main();
