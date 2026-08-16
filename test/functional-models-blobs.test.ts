import { describe, expect, it } from 'vitest';
import { useVcr } from './vcr.js';

describe('Functional: Model Management & Blobs with VCR', () => {
  const MODEL_NAME = 'qwen3.5:2b';

  it('manages blob creation and existence check against real Ollama', async () => {
    await useVcr('functional_blob_lifecycle', async (client) => {
      const payload = new TextEncoder().encode('ollama-client-ts-test-blob-data-12345');
      // Exact SHA-256 digest of payload verified by Ollama
      const digest = 'sha256:8b62707a40afaca2eada46ba3c45ae21027782108d5a99d23e3b694ecf7a4a07';

      await client.createBlob(digest, payload);
      const exists = await client.checkBlob(digest);
      expect(exists).toBe(true);
    });
  }, 120_000);

  it('queries real model inventory, show metadata, ps, and version', async () => {
    await useVcr('functional_model_metadata', async (client) => {
      const list = await client.listModels();
      expect(list.length).toBeGreaterThan(0);

      const show = await client.showModel({ model: MODEL_NAME });
      expect(show.details).toBeDefined();

      const ps = await client.ps();
      expect(Array.isArray(ps.models)).toBe(true);

      const ver = await client.version();
      expect(ver.version).toBeDefined();
    });
  }, 120_000);
});
