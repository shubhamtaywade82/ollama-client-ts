import { describe, expect, it, vi } from 'vitest';
import { OllamaClient } from '../src/client.js';
import { checkEndpointHealth } from '../src/providers/health-check.js';

describe('Integration: Endpoint Registry & Failover', () => {
  it('automatically fails over to secondary endpoint when primary fails with 503', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('http://primary:11434')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'Primary Ollama instance overloaded' }),
        };
      }
      if (url.startsWith('http://secondary:11434')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: 'llama3.2',
            created_at: '2026-08-16T00:00:00Z',
            message: { role: 'assistant', content: 'Response from secondary' },
            done: true,
          }),
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const client = new OllamaClient({
      endpoints: [
        { name: 'primary', baseUrl: 'http://primary:11434' },
        { name: 'secondary', baseUrl: 'http://secondary:11434' },
      ],
      retries: 0,
      fetch: fetchMock as never,
    });

    const res = await client.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Ping' }],
      stream: false,
    });

    expect(res.message.content).toBe('Response from secondary');

    const statuses = client.endpointStatus();
    const primaryStatus = statuses.find((s) => s.endpoint.name === 'primary');
    const secondaryStatus = statuses.find((s) => s.endpoint.name === 'secondary');

    expect(primaryStatus?.failureCount).toBe(1);
    expect(secondaryStatus?.failureCount).toBe(0);
  });

  it('runs health checks across endpoints and detects offline status', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'http://healthy:11434/api/version') {
        return { ok: true, status: 200, json: async () => ({ version: '0.5.12' }) };
      }
      throw new TypeError('Failed to fetch');
    });

    const healthyResult = await checkEndpointHealth(
      { name: 'healthy', baseUrl: 'http://healthy:11434' },
      fetchMock as never,
    );
    const offlineResult = await checkEndpointHealth(
      { name: 'offline', baseUrl: 'http://offline:11434' },
      fetchMock as never,
    );

    expect(healthyResult.reachable).toBe(true);
    expect(healthyResult.latencyMs).toBeGreaterThanOrEqual(0);
    expect(offlineResult.reachable).toBe(false);
    expect(offlineResult.error).toBeDefined();
  });
});
