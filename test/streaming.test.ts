import { describe, expect, it } from 'vitest';
import { normalizeChatStream } from '../src/streaming/normalize.js';
import type { ChatResponse } from '../src/types.js';

describe('Streaming & OllamaStream', () => {
  async function* mockChunks(): AsyncGenerator<ChatResponse, void, undefined> {
    yield {
      model: 'llama3.2',
      created_at: '2026-08-16T00:00:00Z',
      message: { role: 'assistant', content: 'Hello' },
      done: false,
    };
    yield {
      model: 'llama3.2',
      created_at: '2026-08-16T00:00:01Z',
      message: { role: 'assistant', content: ' world!' },
      done: true,
      total_duration: 10_000_000,
      prompt_eval_count: 5,
      eval_count: 2,
    };
  }

  it('aggregates chunks via async iterator', async () => {
    const stream = normalizeChatStream(mockChunks());
    const tokens: string[] = [];

    for await (const event of stream) {
      if (event.type === 'token') {
        tokens.push(event.data.delta);
      }
    }

    expect(tokens.join('')).toBe('Hello world!');
    const final = await stream.finalResult;
    expect(final.done).toBe(true);
    expect(final.message.content).toBe('Hello world!');
    expect(final.totalDurationMs).toBe(10);
  });

  it('emits events to event listeners', async () => {
    const stream = normalizeChatStream(mockChunks());
    const tokens: string[] = [];

    await new Promise<void>((resolve) => {
      stream.on('token', (e) => tokens.push(e.data.delta));
      stream.on('done', () => resolve());
    });

    expect(tokens.join('')).toBe('Hello world!');
  });
});
