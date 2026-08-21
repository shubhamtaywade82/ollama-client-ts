import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({
    endpoints: [
      { name: 'dead-primary', baseUrl: 'http://non-existent-ollama-host.local:11434' },
      { name: 'local-backup', baseUrl: env.localBaseUrl },
    ],
    timeoutMs: 10000,
    retries: 0,
  });
  const start = Date.now();

  try {
    const res = await client.chatText({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Say "Failover succeeded!"' }],
    });

    const epStatus = client.endpointStatus();

    await labLogger.log({
      experimentId: '10-routing-failover',
      timestamp: new Date().toISOString(),
      provider: 'multi-endpoint',
      endpoint: 'failover-cluster',
      model: env.localModel,
      operation: 'executeWithFailover',
      durationMs: Date.now() - start,
      response: {
        chatResponse: res,
        endpointHealthState: epStatus,
      },
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '10-routing-failover',
      timestamp: new Date().toISOString(),
      provider: 'multi-endpoint',
      endpoint: 'failover-cluster',
      model: env.localModel,
      operation: 'executeWithFailover',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
