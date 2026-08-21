import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const controller = new AbortController();
  let tokensReceived = 0;
  let abortedCleanly = false;

  try {
    const stream = await client.chatStream({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Write a long essay about the history of mathematics.' }],
      signal: controller.signal,
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        tokensReceived++;
        if (tokensReceived >= 5) {
          controller.abort();
        }
      }
    }
  } catch {
    if (controller.signal.aborted) {
      abortedCleanly = true;
    }
  }

  await labLogger.log({
    experimentId: '03-streaming-abort-stream',
    timestamp: new Date().toISOString(),
    provider: 'local',
    endpoint: env.localBaseUrl,
    model: env.localModel,
    operation: 'stream-abort',
    response: { tokensReceived, abortedCleanly },
  });
}

void main();
