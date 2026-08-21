import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();
  const prompt = 'Explain quantum computing in one concise sentence.';

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: prompt }],
    });
    const durationMs = Date.now() - start;

    await labLogger.log({
      experimentId: '00-smoke-local-chat',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat',
      durationMs,
      prompt,
      response: res.message.content,
      tokens: { prompt: res.prompt_eval_count, eval: res.eval_count },
    });
  } catch (err) {
    const error = (err as Error).message;
    await labLogger.log({
      experimentId: '00-smoke-local-chat',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      error,
    });
  }
}

void main();
