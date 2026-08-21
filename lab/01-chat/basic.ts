import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: [{ role: 'user', content: 'What are the three laws of robotics?' }],
    });

    await labLogger.log({
      experimentId: '01-chat-basic',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      response: res.message.content,
      tokens: { prompt: res.prompt_eval_count, eval: res.eval_count },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '01-chat-basic',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
