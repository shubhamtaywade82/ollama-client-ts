import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/transport/http.js';
import { OpenAICompatClient } from '../src/integrations/openai.js';
import { AnthropicCompatClient } from '../src/integrations/anthropic.js';

describe('OpenAI and Anthropic Compatibility Integrations', () => {
  it('creates chat completion via OpenAI compatibility format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1700000000,
        model: 'llama3.2',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello from OpenAI compat' },
            finish_reason: 'stop',
          },
        ],
      }),
    });

    const http = new HttpClient({ baseUrl: 'http://localhost:11434', fetch: mockFetch as never });
    const client = new OpenAICompatClient(http);

    const res = await client.createChatCompletion({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(res.choices[0]?.message.content).toBe('Hello from OpenAI compat');
  });

  it('creates message via Anthropic compatibility format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from Anthropic compat' }],
        model: 'llama3.2',
        stop_reason: 'end_turn',
      }),
    });

    const http = new HttpClient({ baseUrl: 'http://localhost:11434', fetch: mockFetch as never });
    const client = new AnthropicCompatClient(http);

    const res = await client.createMessage({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(res.content[0]?.text).toBe('Hello from Anthropic compat');
  });
});
