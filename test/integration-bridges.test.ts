import { describe, expect, it } from 'vitest';
import { useVcr } from './vcr.js';

describe('Integration: OpenAI Compatibility Bridge with VCR', () => {
  const MODEL_NAME = 'qwen3.5:2b';

  it('lists models via OpenAI /v1/models endpoint', async () => {
    await useVcr('bridge_openai_models', async (client) => {
      const res = await client.openai.listModels();
      expect(res.object).toBe('list');
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0]?.id).toBeDefined();
    });
  }, 120_000);

  it('translates chat completions through OpenAI /v1/chat/completions bridge', async () => {
    await useVcr('bridge_openai_chat', async (client) => {
      const res = await client.openai.chatCompletions({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: 'Say "42" only.' }],
        temperature: 0,
      });

      expect(res.choices.length).toBeGreaterThan(0);
      expect(res.choices[0]?.message.content).toContain('42');
      expect(res.choices[0]?.finish_reason).toBe('stop');
    });
  }, 120_000);
});
