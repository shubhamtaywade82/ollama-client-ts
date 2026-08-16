import { describe, expect, it, vi } from 'vitest';
import { OllamaClient } from '../src/client.js';

describe('Blob operations', () => {
  it('checks blob existence with HEAD request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    const exists = await client.checkBlob('sha256:123456');

    expect(exists).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/blobs/sha256%3A123456'),
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('returns false when blob is not found (404)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Blob not found',
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    const exists = await client.checkBlob('sha256:missing');

    expect(exists).toBe(false);
  });

  it('creates blob with POST request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    const client = new OllamaClient({ fetch: mockFetch as never });
    await client.createBlob('sha256:123456', new Uint8Array([1, 2, 3]));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/blobs/sha256%3A123456'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
