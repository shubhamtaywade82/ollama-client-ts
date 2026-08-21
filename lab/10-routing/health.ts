import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({
    endpoints: [
      { name: 'local', baseUrl: env.localBaseUrl },
      { name: 'cloud', baseUrl: env.cloudBaseUrl, apiKey: env.apiKey },
    ],
  });
  const start = Date.now();

  try {
    const health = await client.healthCheck();
    const runtimeMode = client.runtimeMode();
    let capabilities: unknown = undefined;
    try {
      capabilities = await client.capabilities(env.localModel);
    } catch (e) {
      capabilities = `Could not query capabilities: ${(e as Error).message}`;
    }

    await labLogger.log({
      experimentId: '10-routing-health',
      timestamp: new Date().toISOString(),
      provider: 'multi-endpoint',
      endpoint: 'registry',
      model: env.localModel,
      operation: 'healthCheck & capabilities',
      durationMs: Date.now() - start,
      response: {
        runtimeMode,
        health,
        capabilities,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '10-routing-health',
      timestamp: new Date().toISOString(),
      provider: 'multi-endpoint',
      endpoint: 'registry',
      model: env.localModel,
      operation: 'healthCheck & capabilities',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
