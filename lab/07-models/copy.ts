import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const copyName = `${env.localModel}-copy`;
  const start = Date.now();

  try {
    const res = await client.models.copy({
      source: env.localModel,
      destination: copyName,
    });

    await labLogger.log({
      experimentId: '07-models-copy',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'models.copy',
      durationMs: Date.now() - start,
      response: { destination: copyName, result: res },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '07-models-copy',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'models.copy',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
