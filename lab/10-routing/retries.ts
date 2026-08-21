import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const retryEvents: string[] = [];

  const client = new OllamaClient({
    baseUrl: env.localBaseUrl,
    retries: {
      maxRetries: 2,
      backoff: { initialDelayMs: 50, maxDelayMs: 200, backoffFactor: 2 },
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: (msg) => retryEvents.push(msg),
      error: (msg) => retryEvents.push(msg),
    },
  });

  const start = Date.now();

  try {
    const res = await client.chatText({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Ping with retry support' }],
    });

    await labLogger.log({
      experimentId: '10-routing-retries',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'retries-test',
      durationMs: Date.now() - start,
      response: {
        chatResponse: res,
        loggedEvents: retryEvents,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '10-routing-retries',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'retries-test',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
