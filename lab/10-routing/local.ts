import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({
    endpoints: [{ name: 'local-primary', baseUrl: env.localBaseUrl }],
  });
  const start = Date.now();

  try {
    const res = await client.chatText({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Ping' }],
    });

    await labLogger.log({
      experimentId: '10-routing-local',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'routing-local-primary',
      durationMs: Date.now() - start,
      response: res,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '10-routing-local',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'routing-local-primary',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
