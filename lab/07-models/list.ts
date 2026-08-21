import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.models.list();
    await labLogger.log({
      experimentId: '07-models-list',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: 'catalog',
      operation: 'models.list',
      durationMs: Date.now() - start,
      response: {
        totalModels: res.length,
        models: res.map((m) => ({ name: m.name, size: m.size, modified_at: m.modified_at })),
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '07-models-list',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: 'catalog',
      operation: 'models.list',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
