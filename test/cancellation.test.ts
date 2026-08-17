import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OllamaClient } from '../src/client.js';
import { Agent } from '../src/agent/agent.js';
import { defineTool, ToolRegistry } from '../src/tools/index.js';
import { OllamaAbortError } from '../src/errors.js';

describe('Cancellation propagation', () => {
  it('aborting the caller signal genuinely aborts the underlying fetch, not just a promise race', async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedSignal = init.signal as AbortSignal;
      const abortError = (): DOMException =>
        new DOMException('The operation was aborted.', 'AbortError');
      // Mirrors real fetch: reject immediately if already aborted, otherwise on the event.
      if (capturedSignal?.aborted) {
        return Promise.reject(abortError());
      }
      return new Promise((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => reject(abortError()));
      });
    });

    const client = new OllamaClient({ fetch: fetchMock as never });
    const controller = new AbortController();

    const promise = client.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(OllamaAbortError);
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("propagates Agent.run's signal into ToolExecutionContext.signal", async () => {
    let observedToolSignal: AbortSignal | undefined;
    const slowTool = defineTool({
      name: 'slow',
      description: 'Observes whatever abort signal it is given and waits on it',
      schema: z.object({}),
      execute: (_params, ctx) => {
        observedToolSignal = ctx.signal;
        if (ctx.signal?.aborted) {
          return Promise.reject(ctx.signal.reason ?? new Error('aborted'));
        }
        return new Promise((_resolve, reject) => {
          ctx.signal?.addEventListener('abort', () => {
            reject(ctx.signal?.reason ?? new Error('aborted'));
          });
        });
      },
    });
    const registry = new ToolRegistry({ tools: [slowTool] });

    const mockChatClient = {
      chat: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '',
          tool_calls: [{ function: { name: 'slow', arguments: {} } }],
        },
      }),
    };

    const agent = new Agent(mockChatClient, { tools: registry });
    const controller = new AbortController();

    const runPromise = agent.run({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'go' }],
      signal: controller.signal,
    });

    // Let the tool call start (and capture the signal) before aborting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(runPromise).rejects.toBeDefined();
    expect(observedToolSignal).toBe(controller.signal);
    expect(observedToolSignal?.aborted).toBe(true);
  });
});
