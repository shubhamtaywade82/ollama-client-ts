import { describe, expect, it } from 'vitest';
import { parseNdjsonStream } from '../src/streaming/ndjson.js';
import { normalizeChatStream } from '../src/streaming/normalize.js';
import { toTextStream, toDataStream, toResponse } from '../src/streaming/adapters.js';
import type { ChatResponse } from '../src/types.js';

function createReadableByteStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let idx = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(encoder.encode(chunks[idx++]));
      } else {
        controller.close();
      }
    },
  });
}

function createAsyncIterable<T>(items: readonly T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

describe('Unit: Streaming & Web Adapters', () => {
  describe('parseNdjsonStream', () => {
    it('handles JSON objects split across multiple incoming byte chunks', async () => {
      const chunk1 =
        '{"model":"llama3","created_at":"2026-08-16T00:00:00Z","message":{"role":"assistant","content":"Hel';
      const chunk2 = 'lo"},"done":false}\n{"model":"llama3","done":true}\n';

      const byteStream = createReadableByteStream([chunk1, chunk2]);
      const parsed: unknown[] = [];

      for await (const item of parseNdjsonStream(byteStream)) {
        parsed.push(item);
      }

      expect(parsed.length).toBe(2);
      expect((parsed[0] as { message: { content: string } }).message.content).toBe('Hello');
    });

    it('ignores empty lines and trailing whitespace between chunks', async () => {
      const payload = '\n\n{"id":1}\n   \n{"id":2}\n\n';
      const byteStream = createReadableByteStream([payload]);
      const parsed: unknown[] = [];

      for await (const item of parseNdjsonStream(byteStream)) {
        parsed.push(item);
      }

      expect(parsed.length).toBe(2);
    });
  });

  describe('normalizeChatStream & Web Adapters', () => {
    it('emits sequential thinking and token events and builds final result', async () => {
      const chunks: ChatResponse[] = [
        {
          model: 'qwen3.5:2b',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: '', thinking: 'Let me think.' },
          done: false,
        },
        {
          model: 'qwen3.5:2b',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: 'Answer' },
          done: false,
        },
        {
          model: 'qwen3.5:2b',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: '' },
          done: true,
          total_duration: 1000000,
        },
      ];

      const stream = normalizeChatStream(createAsyncIterable(chunks));
      const types: string[] = [];

      for await (const ev of stream) {
        types.push(ev.type);
      }

      expect(types).toContain('thinking');
      expect(types).toContain('token');
      expect(types).toContain('done');
      const final = await stream.finalResult;
      expect(final.done).toBe(true);
    });

    it('converts OllamaStream into Web ReadableStream and Response', async () => {
      const chunks: ChatResponse[] = [
        {
          model: 'llama3.2',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: 'Web ' },
          done: false,
        },
        {
          model: 'llama3.2',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: 'Stream' },
          done: false,
        },
        {
          model: 'llama3.2',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: '' },
          done: true,
        },
      ];

      const stream = normalizeChatStream(createAsyncIterable(chunks));
      const textStream = toTextStream(stream);
      const reader = textStream.getReader();
      const tokens: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        tokens.push(value);
      }

      expect(tokens.join('')).toBe('Web Stream');

      const stream2 = normalizeChatStream(createAsyncIterable(chunks));
      const dataStream = toDataStream(stream2);
      expect(dataStream).toBeInstanceOf(ReadableStream);

      const stream3 = normalizeChatStream(createAsyncIterable(chunks));
      const response = toResponse(stream3);
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toContain('text/plain');
    });
  });
});
