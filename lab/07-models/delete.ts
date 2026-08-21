import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const targetToDelete = `${env.localModel}-copy`;
  const start = Date.now();

  try {
    const res = await client.models.delete({ model: targetToDelete });
    await labLogger.log({
      experimentId: '07-models-delete',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: targetToDelete,
      operation: 'models.delete',
      durationMs: Date.now() - start,
      response: res,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '07-models-delete',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: targetToDelete,
      operation: 'models.delete',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
