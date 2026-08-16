/**
 * Anthropic Compatibility interfaces and client helpers for Ollama.
 * Ollama supports Anthropic Messages API format.
 */

import type { HttpClient } from '../transport/http.js';

export interface AnthropicContentBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface AnthropicMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string | readonly AnthropicContentBlock[];
}

export interface AnthropicMessagesRequest {
  readonly model: string;
  readonly messages: readonly AnthropicMessage[];
  readonly system?: string | undefined;
  readonly max_tokens?: number | undefined;
  readonly temperature?: number | undefined;
  readonly top_p?: number | undefined;
  readonly top_k?: number | undefined;
  readonly stream?: boolean | undefined;
}

export interface AnthropicMessagesResponse {
  readonly id: string;
  readonly type: 'message';
  readonly role: 'assistant';
  readonly content: readonly AnthropicContentBlock[];
  readonly model: string;
  readonly stop_reason: string;
  readonly usage?:
    | {
        readonly input_tokens: number;
        readonly output_tokens: number;
      }
    | undefined;
}

export class AnthropicCompatClient {
  constructor(private readonly http: HttpClient) {}

  async createMessage(
    request: AnthropicMessagesRequest,
    signal?: AbortSignal,
  ): Promise<AnthropicMessagesResponse> {
    return this.http.request<AnthropicMessagesResponse>({
      path: '/v1/messages',
      body: request,
      signal,
    });
  }
}
