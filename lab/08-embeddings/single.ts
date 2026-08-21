import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();
  const text = 'Semantic vectors allow similarity matching in high-dimensional space.';

  try {
    const res = await client.embed({
      model: env.embedModel,
      input: text,
    });

    const vector = res.embeddings[0] ?? [];

    await labLogger.log({
      experimentId: '08-embeddings-single',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.embedModel,
      operation: 'embed-single',
      durationMs: Date.now() - start,
      response: {
        dimensions: vector.length,
        sampleSlice: vector.slice(0, 5),
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '08-embeddings-single',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.embedModel,
      operation: 'embed-single',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
