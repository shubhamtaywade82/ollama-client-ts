import { z } from 'zod';
import { defineTool, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const getTimeTool = defineTool({
  name: 'get_current_time',
  description: 'Returns the current server time in ISO format',
  schema: z.object({ timezone: z.string().optional() }),
  execute: async ({ timezone }) => ({
    timezone: timezone ?? 'UTC',
    iso: new Date().toISOString(),
  }),
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const registry = new ToolRegistry([getTimeTool]);
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: 'What time is it right now?' }],
      tools: registry.definitions(),
    });

    let toolExecutions: unknown = undefined;
    if (res.message.tool_calls?.length) {
      toolExecutions = await registry.executeToolCalls(res.message.tool_calls);
    }

    await labLogger.log({
      experimentId: '05-tools-one-tool',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-single-tool',
      durationMs: Date.now() - start,
      response: res.message.content || '(called tool)',
      toolCalls: res.message.tool_calls as readonly Record<string, unknown>[] | undefined,
      toolResults: toolExecutions as readonly Record<string, unknown>[] | undefined,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '05-tools-one-tool',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-single-tool',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
