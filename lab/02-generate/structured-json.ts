import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.generate({
      model: env.localModel,
      prompt: 'List 2 major planets with their moons count in JSON format.',
      format: 'json',
    });

    await labLogger.log({
      experimentId: '02-generate-structured-json',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'generate-json',
      durationMs: Date.now() - start,
      response: res.response,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '02-generate-structured-json',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'generate-json',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
