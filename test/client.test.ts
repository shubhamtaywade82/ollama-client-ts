import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OllamaClient } from '../src/client.js';

describe('OllamaClient', () => {
  it('executes chat and parses response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'llama3.2',
        created_at: '2026-08-16T00:00:00Z',
        message: { role: 'assistant', content: 'Antigravity is great' },
        done: true,
      }),
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    const response = await client.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: false,
    });

    expect(response.message.content).toBe('Antigravity is great');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('chatText returns message content directly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'llama3.2',
        created_at: '2026-08-16T00:00:00Z',
        message: { role: 'assistant', content: 'Short answer' },
        done: true,
      }),
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    const text = await client.chatText({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Question' }],
    });

    expect(text).toBe('Short answer');
  });

  it('chatWithSchema parses and validates structured output', async () => {
    const userSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'llama3.2',
        created_at: '2026-08-16T00:00:00Z',
        message: { role: 'assistant', content: JSON.stringify({ name: 'Alice', age: 30 }) },
        done: true,
      }),
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    const result = await client.chatWithSchema(
      {
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'Describe Alice' }],
      },
      userSchema,
    );

    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('embedText returns embeddings array directly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'nomic-embed-text',
        embeddings: [[0.1, 0.2, 0.3]],
      }),
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    const embeddings = await client.embedText('nomic-embed-text', 'hello');

    expect(embeddings).toEqual([[0.1, 0.2, 0.3]]);
  });
});
