import { z } from 'zod';
import { defineTool, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const fetchUserTool = defineTool({
  name: 'fetch_user_profile',
  description: 'Fetch profile details for a given username',
  schema: z.object({ username: z.string() }),
  execute: async ({ username }) => {
    return { username, role: 'developer', status: 'active' };
  },
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const registry = new ToolRegistry({
    tools: [fetchUserTool],
    maxConcurrency: 2,
  });
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Fetch profiles for user "alice" and user "bob".' }],
      tools: registry.definitions(),
    });

    let toolExecutions: unknown = undefined;
    if (res.message.tool_calls?.length) {
      toolExecutions = await registry.executeToolCalls(res.message.tool_calls);
    }

    await labLogger.log({
      experimentId: '05-tools-parallel-tools',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-parallel-tools',
      durationMs: Date.now() - start,
      response: res.message.content || '(called tools)',
      toolCalls: res.message.tool_calls as readonly Record<string, unknown>[] | undefined,
      toolResults: toolExecutions as readonly Record<string, unknown>[] | undefined,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '05-tools-parallel-tools',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-parallel-tools',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
