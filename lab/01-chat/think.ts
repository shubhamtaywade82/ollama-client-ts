import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.thinkModel,
      messages: [{ role: 'user', content: 'Which is bigger: 9.9 or 9.11? Think step by step.' }],
      think: true,
    });

    await labLogger.log({
      experimentId: '01-chat-think',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.thinkModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      response: {
        thinking: res.message.thinking ?? '(none)',
        content: res.message.content,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '01-chat-think',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
