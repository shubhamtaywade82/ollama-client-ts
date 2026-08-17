import { describe, expect, it, vi } from 'vitest';
import { OllamaClient } from '../src/client.js';

/**
 * ModelsClient operations (and capability detection) target one specific endpoint's local
 * model catalog/blob store — a different endpoint isn't an interchangeable substitute the
 * way it is for chat/generate. These tests prove failover is disabled for them: a
 * failover-eligible error (503) on the primary must propagate directly, never silently
 * falling through to a secondary endpoint's (different) catalog. See ADR 0008.
 */
describe('ModelsClient operations do not cross-endpoint failover', () => {
  function twoEndpointClient(primaryHandler: () => Promise<unknown>) {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('http://primary:11434')) {
        const body = await primaryHandler();
        if (body === null) {
          return { ok: false, status: 503, json: async () => ({ error: 'primary overloaded' }) };
        }
        return { ok: true, status: 200, json: async () => body };
      }
      throw new Error(`secondary endpoint should never be called, got: ${url}`);
    });
    const client = new OllamaClient({
      endpoints: [
        { name: 'primary', baseUrl: 'http://primary:11434', priority: 10 },
        { name: 'secondary', baseUrl: 'http://secondary:11434', priority: 5 },
      ],
      retries: 0,
      fetch: fetchMock as never,
    });
    return { client, fetchMock };
  }

  it('listModels propagates a primary 503 without trying the secondary endpoint', async () => {
    const { client, fetchMock } = twoEndpointClient(async () => null);
    await expect(client.listModels()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('showModel propagates a primary 503 without trying the secondary endpoint', async () => {
    const { client, fetchMock } = twoEndpointClient(async () => null);
    await expect(client.showModel({ model: 'llama3.2' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deleteModel propagates a primary 503 without trying the secondary endpoint', async () => {
    const { client, fetchMock } = twoEndpointClient(async () => null);
    await expect(client.deleteModel({ model: 'llama3.2' })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pullModel propagates a primary 503 without trying the secondary endpoint', async () => {
    const { client, fetchMock } = twoEndpointClient(async () => null);
    await expect(client.pullModel({ model: 'llama3.2', stream: false })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('capabilities() propagates a primary 503 without trying the secondary endpoint', async () => {
    const { client, fetchMock } = twoEndpointClient(async () => null);
    await expect(client.capabilities('llama3.2')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('succeeds on the primary without ever contacting the secondary', async () => {
    const { client, fetchMock } = twoEndpointClient(async () => ({
      models: [{ name: 'llama3.2', model: 'llama3.2' }],
    }));
    const models = await client.listModels();
    expect(models).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('chat/generate still cross-endpoint failover (unchanged)', () => {
  it('chat fails over from a 503 primary to a healthy secondary', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('http://primary:11434')) {
        return { ok: false, status: 503, json: async () => ({ error: 'overloaded' }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'llama3.2',
          created_at: '2026-08-16T00:00:00Z',
          message: { role: 'assistant', content: 'from secondary' },
          done: true,
        }),
      };
    });
    const client = new OllamaClient({
      endpoints: [
        { name: 'primary', baseUrl: 'http://primary:11434', priority: 10 },
        { name: 'secondary', baseUrl: 'http://secondary:11434', priority: 5 },
      ],
      retries: 0,
      fetch: fetchMock as never,
    });

    const res = await client.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });
    expect(res.message.content).toBe('from secondary');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
