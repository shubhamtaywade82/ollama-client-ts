import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.models.show({ model: env.localModel });
    await labLogger.log({
      experimentId: '07-models-show',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'models.show',
      durationMs: Date.now() - start,
      response: {
        details: res.details,
        parameters: res.parameters ? `${res.parameters.substring(0, 100)}...` : undefined,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '07-models-show',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'models.show',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
