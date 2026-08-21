import { z } from 'zod';
import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

const StrictScoreSchema = z.object({
  score: z.number().int().min(100).max(200),
  category: z.enum(['ALPHA', 'BETA']),
});

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.chatWithSchema(
      {
        model: env.localModel,
        messages: [{ role: 'user', content: 'Generate a score of -500 and category "GAMMA".' }],
      },
      StrictScoreSchema,
    );

    await labLogger.log({
      experimentId: '04-structured-invalid-output',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chatWithSchema-invalid',
      durationMs: Date.now() - start,
      response: res,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '04-structured-invalid-output',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chatWithSchema-invalid',
      durationMs: Date.now() - start,
      error: `Expected validation failure: ${(err as Error).message}`,
    });
  }
}

void main();
