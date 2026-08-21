import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const prompt = 'Give 3 random words separated by commas.';

  const results: Record<string, string> = {};

  try {
    for (const temp of [0, 0.7, 1.0]) {
      const res = await client.chatText({
        model: env.localModel,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature: temp },
      });
      results[`temp_${temp}`] = res;
    }

    const seedRuns: string[] = [];
    for (let i = 0; i < 2; i++) {
      const res = await client.chatText({
        model: env.localModel,
        messages: [{ role: 'user', content: prompt }],
        options: { seed: 42, temperature: 0 },
      });
      seedRuns.push(res);
    }
    results['seed_deterministic_match'] = String(seedRuns[0] === seedRuns[1]);

    await labLogger.log({
      experimentId: '01-chat-model-options',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-options',
      response: results,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '01-chat-model-options',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat-options',
      error: (err as Error).message,
    });
  }
}

void main();
