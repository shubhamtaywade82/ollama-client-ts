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
      prompt: 'Write a haiku about TypeScript.',
    });

    await labLogger.log({
      experimentId: '02-generate-basic',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'generate',
      durationMs: Date.now() - start,
      response: res.response,
      tokens: { prompt: res.prompt_eval_count, eval: res.eval_count },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '02-generate-basic',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'generate',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
