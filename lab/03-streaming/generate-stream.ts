import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  console.log(`[streaming] Starting generateStream for model: ${env.localModel}`);

  try {
    const stream = await client.generateStream({
      model: env.localModel,
      prompt: 'Write a short limerick about coding in TypeScript.',
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        process.stdout.write(event.data.delta);
      }
    }
    console.log('\n[streaming] Completed generateStream successfully.');
  } catch (err) {
    console.error('\n[streaming] Stream failed:', (err as Error).message);
  }
}

void main();
