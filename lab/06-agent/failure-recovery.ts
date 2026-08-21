import { z } from 'zod';
import { Agent, defineTool, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const primaryFailingSearchTool = defineTool({
  name: 'primary_search',
  description: 'Primary search engine index (currently unstable)',
  schema: z.object({ query: z.string() }),
  execute: async () => {
    throw new Error('Service Unavailable: 503 Server Error');
  },
});

const backupSearchTool = defineTool({
  name: 'backup_search',
  description: 'Backup search engine index',
  schema: z.object({ query: z.string() }),
  execute: async ({ query }) => ({
    query,
    results: [`Found result for "${query}" via fallback replica.`],
  }),
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const registry = new ToolRegistry([primaryFailingSearchTool, backupSearchTool]);
  const agent = new Agent(client, { tools: registry, maxIterations: 6 });

  try {
    const res = await agent.run({
      model: env.localModel,
      messages: [
        {
          role: 'user',
          content: 'Search for "Ollama SDK" using primary_search. If it fails, use backup_search.',
        },
      ],
    });

    await labLogger.log({
      experimentId: '06-agent-failure-recovery',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'agent-tool-failure-recovery',
      response: {
        finalAnswer: res.finalMessage.content,
        totalIterations: res.totalIterations,
        turnErrors: res.turns.flatMap((t) => t.toolResults ?? []).filter((r) => !r.success),
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '06-agent-failure-recovery',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'agent-tool-failure-recovery',
      error: (err as Error).message,
    });
  }
}

void main();
