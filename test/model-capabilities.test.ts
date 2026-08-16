import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractUsage } from '../src/usage.js';
import { useVcr } from './vcr.js';

function dotProduct(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, val, idx) => sum + val * (b[idx] ?? 0), 0);
}

function magnitude(vec: readonly number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

describe('Model Capabilities', () => {
  const MODEL_NAME = 'qwen3.5:2b';
  const EMBED_MODEL = 'nomic-embed-text:latest';

  it('completes chat with system instructions and execution options', async () => {
    await useVcr('capabilities_chat_options', async (client) => {
      const res = await client.chat({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content: 'You are an arithmetic assistant. Output only the numerical answer.',
          },
          { role: 'user', content: 'What is 18 * 4?' },
        ],
        options: { temperature: 0, seed: 42 },
        stream: false,
      });

      expect(res.done).toBe(true);
      expect(res.message.content).toContain('72');
      const usage = extractUsage(res);
      expect(usage.completionTokens).toBeGreaterThan(0);
    });
  }, 120_000);

  it('streams reasoning and token events sequentially', async () => {
    await useVcr('capabilities_thinking_stream', async (client) => {
      const stream = await client.chatStream({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'What is 25 * 4?' },
        ],
        options: { temperature: 0 },
      });

      const eventTypes: string[] = [];
      const thinkTokens: string[] = [];
      const contentTokens: string[] = [];

      for await (const event of stream) {
        eventTypes.push(event.type);
        if (event.type === 'thinking') {
          thinkTokens.push(event.data.delta);
        } else if (event.type === 'token') {
          contentTokens.push(event.data.delta);
        }
      }

      expect(eventTypes).toContain('done');
      const final = await stream.finalResult;
      expect(final.done).toBe(true);

      const combined = thinkTokens.join('') + contentTokens.join('') + final.message.content;
      expect(combined).toContain('100');
    });
  }, 120_000);

  it('validates structured outputs against complex Zod schemas', async () => {
    await useVcr('capabilities_structured_output', async (client) => {
      const ProductSchema = z.object({
        productId: z.string(),
        name: z.string(),
        category: z.enum(['electronics', 'books', 'apparel']),
        price: z.number(),
        inStock: z.boolean(),
        tags: z.array(z.string()),
      });

      const prompt =
        'Generate product item for Wireless Headphones in electronics, price 79.99, inStock true, tags: audio, bluetooth.';

      const result = await client.chatWithSchema(
        {
          model: MODEL_NAME,
          messages: [{ role: 'user', content: prompt }],
          options: { temperature: 0 },
        },
        ProductSchema,
      );

      expect(result.category).toBe('electronics');
      expect(result.price).toBeGreaterThan(0);
      expect(result.inStock).toBe(true);
      expect(result.tags.length).toBeGreaterThanOrEqual(1);
    });
  }, 120_000);

  it('generates normalized embeddings and measures semantic similarity', async () => {
    await useVcr('capabilities_embeddings_similarity', async (client) => {
      const items = [
        'Artificial intelligence model inference on local hardware',
        'Running neural network LLMs locally on your computer',
        'Baking sourdough bread using yeast and high protein flour',
      ];

      const res = await client.embed({
        model: EMBED_MODEL,
        input: items,
      });

      expect(res.embeddings.length).toBe(3);
      const vecAi1 = res.embeddings[0]!;
      const vecAi2 = res.embeddings[1]!;
      const vecBread = res.embeddings[2]!;

      const simAi = cosineSimilarity(vecAi1, vecAi2);
      const simDiff = cosineSimilarity(vecAi1, vecBread);

      expect(vecAi1.length).toBe(768);
      expect(simAi).toBeGreaterThan(simDiff);
      expect(simAi).toBeGreaterThan(0.6);
    });
  }, 120_000);

  it('inspects model tags and capability metadata', async () => {
    await useVcr('capabilities_model_info', async (client) => {
      const models = await client.listModels();
      expect(models.length).toBeGreaterThan(0);

      const show = await client.showModel({ model: MODEL_NAME });
      expect(show.details).toBeDefined();
      expect(show.details.family).toBeDefined();
    });
  }, 120_000);
});
