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
      prompt: '<|im_start|>user\nSay hello!<|im_end|>\n<|im_start|>assistant\n',
      raw: true,
    });

    await labLogger.log({
      experimentId: '02-generate-raw',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'generate-raw',
      durationMs: Date.now() - start,
      response: res.response,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '02-generate-raw',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'generate-raw',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
