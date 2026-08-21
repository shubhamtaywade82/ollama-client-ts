import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  console.log(`[streaming] Starting chatStream for model: ${env.localModel}`);

  try {
    const stream = await client.chatStream({
      model: env.localModel,
      messages: [{ role: 'user', content: 'Count from 1 to 5 with short explanations.' }],
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        process.stdout.write(event.data.delta);
      } else if (event.type === 'thinking') {
        process.stdout.write(`[think: ${event.data.delta}]`);
      }
    }
    console.log('\n[streaming] Completed chatStream successfully.');
  } catch (err) {
    console.error('\n[streaming] Stream failed:', (err as Error).message);
  }
}

void main();
