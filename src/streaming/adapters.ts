/**
 * Web Standard Stream adapters for OllamaStream.
 * Enables seamless integration with Vercel AI SDK, Next.js route handlers, and standard web fetch responses.
 */

import type { OllamaStream } from './stream.js';

/**
 * Transforms an OllamaStream into a standard Web ReadableStream of token text strings.
 */
export function toTextStream<TChunk, TFinal>(
  stream: OllamaStream<TChunk, TFinal>,
): ReadableStream<string> {
  const iterator = stream[Symbol.asyncIterator]();

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await iterator.next();
          if (done) {
            controller.close();
            return;
          }
          if (value.type === 'token' && value.data.delta) {
            controller.enqueue(value.data.delta);
            return;
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });
}

/**
 * Transforms an OllamaStream into a standard Web ReadableStream of encoded Uint8Array bytes.
 */
export function toDataStream<TChunk, TFinal>(
  stream: OllamaStream<TChunk, TFinal>,
): ReadableStream<Uint8Array> {
  const textStream = toTextStream(stream);
  const reader = textStream.getReader();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
      stream.abort();
    },
  });
}

/**
 * Converts an OllamaStream directly into a standard Web Response with text/plain streaming headers.
 */
export function toResponse<TChunk, TFinal>(
  stream: OllamaStream<TChunk, TFinal>,
  init: ResponseInit = {},
): Response {
  const body = toDataStream(stream);
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
  }
  return new Response(body, { ...init, headers });
}
