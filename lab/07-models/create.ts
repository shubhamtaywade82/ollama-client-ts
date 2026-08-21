import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const customModelName = 'lab-custom-assistant:latest';
  const start = Date.now();

  try {
    const res = await client.models.create({
      model: customModelName,
      from: env.localModel,
      stream: false,
    });

    await labLogger.log({
      experimentId: '07-models-create',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: customModelName,
      operation: 'models.create',
      durationMs: Date.now() - start,
      response: res,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '07-models-create',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: customModelName,
      operation: 'models.create',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
