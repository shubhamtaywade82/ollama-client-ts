import { OllamaClient } from '../../src/index.js';
import type { Message } from '../../src/types.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  const history: Message[] = [
    { role: 'user', content: 'My favorite fruit is Mango.' },
    { role: 'assistant', content: 'Got it! Mango is your favorite fruit.' },
    { role: 'user', content: 'What is my favorite fruit?' },
  ];

  try {
    const res = await client.chat({
      model: env.localModel,
      messages: history,
    });

    await labLogger.log({
      experimentId: '01-chat-multi-turn',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'chat',
      durationMs: Date.now() - start,
      response: res.message.content,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '01-chat-multi-turn',
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
