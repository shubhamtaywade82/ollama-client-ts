import { Agent, OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';
import { labLogger } from '../support/logger.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  const agent = new Agent(client, { maxIterations: 3 });
  const start = Date.now();

  try {
    const result = await agent.run({
      model: env.localModel,
      messages: [{ role: 'user', content: 'What is 2 + 2?' }],
    });

    await labLogger.log({
      experimentId: '06-agent-single-step',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'agent-single-step',
      durationMs: Date.now() - start,
      response: result.finalMessage.content,
    });
  } catch (err) {
    await labLogger.log({
      experimentId: '06-agent-single-step',
      timestamp: new Date().toISOString(),
      provider: 'local',
      endpoint: env.localBaseUrl,
      model: env.localModel,
      operation: 'agent-single-step',
      durationMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
}

void main();
