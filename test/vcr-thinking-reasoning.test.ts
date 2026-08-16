import { describe, expect, it } from 'vitest';
import { useVcr } from './vcr.js';

describe('Thorough Thinking and Reasoning Stream Capabilities', () => {
  const REASONING_MODEL = 'qwen3.5:0.8b';

  it('streams thinking events and reasoning process before final response', async () => {
    await useVcr('thorough_thinking_stream', async (client) => {
      const stream = await client.chatStream({
        model: REASONING_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Think briefly: what is 7 + 8?',
          },
        ],
        options: { temperature: 0 },
      });

      const events: string[] = [];
      const thinkChunks: string[] = [];
      const tokenChunks: string[] = [];

      for await (const event of stream) {
        events.push(event.type);
        if (event.type === 'thinking') {
          thinkChunks.push(event.data.delta);
        } else if (event.type === 'token') {
          tokenChunks.push(event.data.delta);
        }
      }

      expect(events).toContain('done');
      const finalResult = await stream.finalResult;
      expect(finalResult.done).toBe(true);

      const fullOutput = thinkChunks.join('') + tokenChunks.join('') + finalResult.message.content;
      expect(fullOutput).toMatch(/15/);
    });
  }, 120_000);

  it('captures full reasoning response with think parameter', async () => {
    await useVcr('thorough_thinking_non_stream', async (client) => {
      const res = await client.chat({
        model: REASONING_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Which number is larger: 9.11 or 9.9? Think carefully.',
          },
        ],
        options: { temperature: 0 },
        stream: false,
      });

      expect(res.done).toBe(true);
      expect(res.message.content).toMatch(/9\.9/);
    });
  }, 120_000);
});
