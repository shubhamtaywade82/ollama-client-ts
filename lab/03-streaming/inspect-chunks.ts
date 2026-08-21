import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const eventTypes: Record<string, number> = {};
  let totalChunks = 0;
  let finalDoneEvent: unknown = undefined;

  try {
    const stream = await client.chatStream({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Say "1, 2, 3, done!"' }],
    });

    for await (const event of stream) {
      totalChunks++;
      eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
      if (event.type === 'done') {
        finalDoneEvent = event.data;
      }
    }

    await labLogger.log({
      experimentId: '03-streaming-inspect-chunks',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'stream-inspect',
      response: {
        totalChunks,
        eventDistribution: eventTypes,
        finalDoneData: finalDoneEvent,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '03-streaming-inspect-chunks',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'stream-inspect',
      error: (err as Error).message,
    });
  }
}

void main();
