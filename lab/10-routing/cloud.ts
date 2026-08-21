import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({
    endpoints: [{ name: 'cloud-primary', baseUrl: env.cloudBaseUrl, apiKey: env.apiKey }],
  });
  const start = Date.now();

  try {
    const res = await client.chatText({
      model: env.cloudModel,
      messages: [{ role: 'user', content: 'Ping Cloud' }],
    });

    await labLogger.log({
      experimentId: '10-routing-cloud',
      timestamp: new Date().toISOString(),
      provider: 'cloud',
      endpoint: env.cloudBaseUrl,
      model: env.cloudModel,
      operation: 'routing-cloud-primary',
      durationMs: Date.now() - start,
      response: res,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '10-routing-cloud',
      timestamp: new Date().toISOString(),
      provider: 'cloud',
      endpoint: env.cloudBaseUrl,
      model: env.cloudModel,
      operation: 'routing-cloud-primary',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
