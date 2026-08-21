import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const start = Date.now();

  try {
    const res = await client.anthropic.createMessage({
      model: env.localModel,
      system: 'You are an Anthropic Messages bridge tester.',
      messages: [{ role: 'user', content: 'Say "Anthropic Bridge Working!"' }],
      max_tokens: 100,
    });

    await labLogger.log({
      experimentId: '13-integrations-anthropic-compatible',
      timestamp: new Date().toISOString(),
      provider: 'anthropic-bridge',
      endpoint: `${env.localBaseUrl}/v1/messages`,
      model: env.localModel,
      operation: 'anthropic.createMessage',
      durationMs: Date.now() - start,
      response: {
        id: res.id,
        role: res.role,
        content: res.content,
        usage: res.usage,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '13-integrations-anthropic-compatible',
      timestamp: new Date().toISOString(),
      provider: 'anthropic-bridge',
      endpoint: `${env.localBaseUrl}/v1/messages`,
      model: env.localModel,
      operation: 'anthropic.createMessage',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
