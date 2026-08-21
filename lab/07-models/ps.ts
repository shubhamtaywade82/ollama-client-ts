import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.models.ps();
    await labLogger.log({
      experimentId: '07-models-ps',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: 'running-processes',
      operation: 'models.ps',
      durationMs: Date.now() - start,
      response: {
        activeCount: res.models.length,
        models: res.models.map((m) => ({
          name: m.name,
          size_vram: m.size_vram,
          expires_at: m.expires_at,
        })),
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '07-models-ps',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: 'running-processes',
      operation: 'models.ps',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
