import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineTool } from '../src/tools/define-tool.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { Agent } from '../src/agent/agent.js';
import { useVcr } from './vcr.js';

describe('Real Ollama Model Tests with VCR Cassettes', () => {
  const CHAT_MODEL = 'qwen2.5:0.5b';
  const EMBED_MODEL = 'nomic-embed-text:latest';

  it('records and replays real chat completions', async () => {
    await useVcr('real_chat_completion', async (client) => {
      const res = await client.chat({
        model: CHAT_MODEL,
        messages: [{ role: 'user', content: 'Reply with exact phrase: "Hello Ollama"' }],
        options: { temperature: 0 },
        stream: false,
      });

      expect(res.message.content.length).toBeGreaterThan(0);
      expect(res.done).toBe(true);
    });
  }, 60_000);

  it('records and replays real streaming token generation', async () => {
    await useVcr('real_streaming_tokens', async (client) => {
      const stream = await client.chatStream({
        model: CHAT_MODEL,
        messages: [{ role: 'user', content: 'Say "1, 2, 3"' }],
        options: { temperature: 0 },
      });

      const tokens: string[] = [];
      for await (const event of stream) {
        if (event.type === 'token') {
          tokens.push(event.data.delta);
        }
      }

      expect(tokens.length).toBeGreaterThan(0);
      const final = await stream.finalResult;
      expect(final.done).toBe(true);
      expect(final.message.content).toBe(tokens.join(''));
    });
  }, 60_000);

  it('records and replays real vector embeddings', async () => {
    await useVcr('real_embeddings', async (client) => {
      const embeddings = await client.embedText(
        EMBED_MODEL,
        'Antigravity TypeScript SDK for Ollama',
      );

      expect(embeddings.length).toBe(1);
      expect(embeddings[0]?.length).toBe(768);
    });
  }, 60_000);

  it('records and replays real Zod structured outputs', async () => {
    await useVcr('real_structured_output', async (client) => {
      const CitySchema = z.object({
        city: z.string(),
        country: z.string(),
        populationEstimateMillion: z.number(),
      });

      const result = await client.chatWithSchema(
        {
          model: CHAT_MODEL,
          messages: [
            {
              role: 'user',
              content: 'Provide info for Paris in France. Estimate population around 2 million.',
            },
          ],
          options: { temperature: 0 },
        },
        CitySchema,
      );

      expect(result.city.toLowerCase()).toContain('paris');
      expect(result.country.toLowerCase()).toContain('france');
      expect(typeof result.populationEstimateMillion).toBe('number');
    });
  }, 60_000);

  it('records and replays real autonomous tool calling agent loop', async () => {
    await useVcr('real_agent_tool_calling', async (client) => {
      const calculateSquare = defineTool({
        name: 'calculate_square',
        description: 'Calculates square of a number',
        schema: z.object({ number: z.number() }),
        execute: ({ number }) => {
          return { square: number * number };
        },
      });

      const registry = new ToolRegistry();
      registry.register(calculateSquare as never);

      const agent = new Agent(client, { tools: registry, maxIterations: 5 });
      const result = await agent.run({
        model: CHAT_MODEL,
        messages: [
          { role: 'user', content: 'What is the square of 9? Use the calculate_square tool.' },
        ],
        options: { temperature: 0 },
      });

      expect(result.finalMessage.content).toContain('81');
      expect(result.turns.length).toBeGreaterThanOrEqual(1);
    });
  }, 60_000);

  it('records and replays real model inspection and tags listing', async () => {
    await useVcr('real_model_tags', async (client) => {
      const models = await client.listModels();
      expect(models.length).toBeGreaterThan(0);

      const show = await client.showModel({ model: CHAT_MODEL });
      expect(show.details.family).toBeDefined();
    });
  }, 60_000);
});
