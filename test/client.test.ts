import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useVcr } from './vcr.js';

describe('Client Core API with VCR', () => {
  const MODEL_NAME = 'qwen3.5:2b';
  const EMBED_MODEL = 'nomic-embed-text:latest';

  it('chatText sends prompt and returns assistant content directly', async () => {
    await useVcr('client_chat_text', async (client) => {
      const text = await client.chatText({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: 'Output exactly the word "Antigravity".' }],
        options: { temperature: 0 },
      });

      expect(text.toLowerCase()).toContain('antigravity');
    });
  }, 120_000);

  it('generateText sends raw prompt and returns text response', async () => {
    await useVcr('client_generate_text', async (client) => {
      const text = await client.generateText({
        model: MODEL_NAME,
        prompt: 'Say "hello world" only.',
        options: { temperature: 0 },
      });

      expect(text.toLowerCase()).toContain('hello');
    });
  }, 120_000);

  it('chatWithSchema parses and validates structured output', async () => {
    await useVcr('client_chat_schema', async (client) => {
      const UserSchema = z.object({
        name: z.string(),
        age: z.number(),
        role: z.string(),
      });

      const user = await client.chatWithSchema(
        {
          model: MODEL_NAME,
          messages: [{ role: 'user', content: 'Generate a profile for Alice, age 30, role developer.' }],
          options: { temperature: 0 },
        },
        UserSchema,
      );

      expect(user.name).toBe('Alice');
      expect(user.age).toBe(30);
    });
  }, 120_000);

  it('embedText returns 2D embedding vector array directly', async () => {
    await useVcr('client_embed_text', async (client) => {
      const embeddings = await client.embedText(EMBED_MODEL, 'Hello world vector test');
      expect(embeddings.length).toBe(1);
      expect(embeddings[0]?.length).toBe(768);
    });
  }, 120_000);
});
