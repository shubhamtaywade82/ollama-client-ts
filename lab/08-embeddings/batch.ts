import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();
  const batch = [
    'The quick brown fox jumps over the lazy dog.',
    'Artificial intelligence transforms distributed software architecture.',
    'Fresh espresso brewed in the morning gives energy.',
  ];

  try {
    const res = await client.embed({
      model: env.embedModel,
      input: batch,
    });

    await labLogger.log({
      experimentId: '08-embeddings-batch',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.embedModel,
      operation: 'embed-batch',
      durationMs: Date.now() - start,
      response: {
        batchSize: res.embeddings.length,
        dimensions: res.embeddings[0]?.length,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '08-embeddings-batch',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.embedModel,
      operation: 'embed-batch',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
