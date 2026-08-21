import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();
  const query = 'TypeScript latest features';

  try {
    const res = await client.webSearch({ query });
    await labLogger.log({
      experimentId: '09-web-search',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: 'web-service',
      operation: 'webSearch',
      durationMs: Date.now() - start,
      response: res,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '09-web-search',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: 'web-service',
      operation: 'webSearch',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
