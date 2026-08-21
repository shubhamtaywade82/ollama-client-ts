import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({
    baseUrl: env.cloudBaseUrl,
    ...(env.apiKey !== undefined ? { apiKey: env.apiKey } : {}),
  });
  const start = Date.now();
  const prompt = 'Explain cloud distributed systems in one concise sentence.';

  try {
    const res = await client.chat({
      model: env.cloudModel,
      messages: [{ role: 'user', content: prompt }],
    });
    const durationMs = Date.now() - start;

    await labLogger.log({
      experimentId: '00-smoke-cloud-chat',
      timestamp: new Date().toISOString(),
      provider: 'cloud',
      endpoint: env.cloudBaseUrl,
      model: env.cloudModel,
      operation: 'chat',
      durationMs,
      prompt,
      response: res.message.content,
      tokens: { prompt: res.prompt_eval_count, eval: res.eval_count },
    });
  } catch (err) {
    const error = (err as Error).message;
    await labLogger.log({
      experimentId: '00-smoke-cloud-chat',
      timestamp: new Date().toISOString(),
      provider: 'cloud',
      endpoint: env.cloudBaseUrl,
      model: env.cloudModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      error,
    });
  }
}

void main();
