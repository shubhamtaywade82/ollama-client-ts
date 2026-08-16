import { OllamaClient } from '../src/index.js';

async function main() {
  const client = new OllamaClient();

  console.log('Fetching version...');
  try {
    const version = await client.version();
    console.log('Ollama Server Version:', version.version);
  } catch (err) {
    console.log('Could not connect to local Ollama server:', (err as Error).message);
  }
}

void main();
