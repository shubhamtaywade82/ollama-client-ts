import { z } from 'zod';
import { defineTool, OllamaClient, ToolRegistry } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const echoTool = defineTool({
  name: 'echo_message',
  description: 'Echoes a message back',
  schema: z.object({ text: z.string() }),
  execute: async ({ text }) => ({ echoed: text }),
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const registry = new ToolRegistry([echoTool]);
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Call echo_message with text "Hello Lab"' }],
      tools: registry.definitions(),
    });

    const callIds = (res.message.tool_calls ?? []).map((tc) => tc.id);
    const executions = res.message.tool_calls?.length
      ? await registry.executeToolCalls(res.message.tool_calls)
      : [];

    const executionIds = executions.map((e) => e.toolCallId);

    await labLogger.log({
      experimentId: '05-tools-tool-call-ids',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-tool-ids',
      durationMs: Date.now() - start,
      response: {
        receivedCallIds: callIds,
        executionResultIds: executionIds,
        idMatch: JSON.stringify(callIds) === JSON.stringify(executionIds),
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '05-tools-tool-call-ids',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-tool-ids',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
