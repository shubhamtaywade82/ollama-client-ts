import { OllamaClient } from '../../src/index.js';
import { getLabEnv } from '../support/env.js';

async function main(): Promise<void> {
  const env = getLabEnv();
  const client = new OllamaClient({ baseUrl: env.localBaseUrl });
  console.log(`[models:pull] Pulling model "${env.localModel}"...`);

  try {
    const stream = await client.models.pull({ model: env.localModel, stream: true });
    for await (const event of stream) {
      if (event.type === 'message') {
        const progress = event.data.chunk;
        const count = progress.completed ? ` (${progress.completed}/${progress.total ?? '?'})` : '';
        process.stdout.write(`\r[models:pull] ${progress.status}${count}               `);
      }
    }
    console.log('\n[models:pull] Done.');
  } catch (err) {
    console.error('\n[models:pull] Failed:', (err as Error).message);
  }
}

void main();
