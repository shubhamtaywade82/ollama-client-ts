import { describe, expect, it } from 'vitest';
import { useVcr } from './vcr.js';

function dotProduct(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, val, idx) => sum + val * (b[idx] ?? 0), 0);
}

function magnitude(vec: readonly number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

describe('Thorough Embeddings and Vector Similarity Capabilities', () => {
  const NOMIC_MODEL = 'nomic-embed-text:latest';
  const MXBAI_MODEL = 'mxbai-embed-large:latest';

  it('generates 768-dimensional embeddings with nomic-embed-text', async () => {
    await useVcr('thorough_nomic_embeddings', async (client) => {
      const res = await client.embed({
        model: NOMIC_MODEL,
        input: 'Ollama TypeScript SDK client for local AI models',
      });

      expect(res.embeddings.length).toBe(1);
      expect(res.embeddings[0]?.length).toBe(768);
    });
  }, 60_000);

  it('generates 1024-dimensional embeddings with mxbai-embed-large', async () => {
    await useVcr('thorough_mxbai_embeddings', async (client) => {
      const res = await client.embed({
        model: MXBAI_MODEL,
        input: 'High performance vector embeddings for semantic search',
      });

      expect(res.embeddings.length).toBe(1);
      expect(res.embeddings[0]?.length).toBe(1024);
    });
  }, 60_000);

  it('performs batch embedding and proves semantic cosine similarity', async () => {
    await useVcr('thorough_batch_embeddings_similarity', async (client) => {
      const inputs = [
        'The quick brown fox jumps over the lazy dog',
        'A fast auburn canine leaps above a sleepy hound',
        'Quantum computing algorithms for polynomial factorization',
      ];

      const res = await client.embed({
        model: NOMIC_MODEL,
        input: inputs,
      });

      expect(res.embeddings.length).toBe(3);
      const vec1 = res.embeddings[0]!;
      const vec2 = res.embeddings[1]!;
      const vec3 = res.embeddings[2]!;

      const simSimilar = cosineSimilarity(vec1, vec2);
      const simDifferent = cosineSimilarity(vec1, vec3);

      expect(simSimilar).toBeGreaterThan(simDifferent);
      expect(simSimilar).toBeGreaterThan(0.65);
    });
  }, 60_000);
});
