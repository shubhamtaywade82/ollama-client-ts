import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.openai.createChatCompletion({
      model: env.localModel,
      messages: [
        { role: 'system', content: 'You are an OpenAI compatibility bridge tester.' },
        { role: 'user', content: 'Say "OpenAI Bridge Working!"' },
      ],
      temperature: 0.1,
    });

    await labLogger.log({
      experimentId: '13-integrations-openai-compatible',
      timestamp: new Date().toISOString(),
      provider: 'openai-bridge',
      endpoint: `${env.localBaseUrl}/v1/chat/completions`,
      model: env.localModel,
      operation: 'openai.createChatCompletion',
      durationMs: Date.now() - start,
      response: {
        id: res.id,
        content: res.choices[0]?.message.content,
        usage: res.usage,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '13-integrations-openai-compatible',
      timestamp: new Date().toISOString(),
      provider: 'openai-bridge',
      endpoint: `${env.localBaseUrl}/v1/chat/completions`,
      model: env.localModel,
      operation: 'openai.createChatCompletion',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
