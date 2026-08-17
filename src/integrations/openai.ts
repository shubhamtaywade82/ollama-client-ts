/**
 * OpenAI Compatibility interfaces and client helpers for Ollama.
 * Ollama exposes OpenAI-compatible /v1 endpoints.
 */

import type { HttpClient } from '../transport/http.js';

export interface OpenAIMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly name?: string | undefined;
}

export interface OpenAIStreamOptions {
  /** Emit a final SSE chunk carrying `usage` (prompt/completion/total tokens) before `[DONE]`. */
  readonly include_usage?: boolean | undefined;
}

export interface OpenAIChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly OpenAIMessage[];
  readonly temperature?: number | undefined;
  readonly top_p?: number | undefined;
  readonly stream?: boolean | undefined;
  /** Only meaningful when `stream: true`; ignored otherwise. */
  readonly stream_options?: OpenAIStreamOptions | undefined;
  readonly max_tokens?: number | undefined;
  readonly stop?: readonly string[] | undefined;
  readonly presence_penalty?: number | undefined;
  readonly frequency_penalty?: number | undefined;
  readonly user?: string | undefined;
}

export interface OpenAIChatCompletionChoice {
  readonly index: number;
  readonly message: OpenAIMessage;
  readonly finish_reason: string;
}

export interface OpenAIChatCompletionResponse {
  readonly id: string;
  readonly object: 'chat.completion';
  readonly created: number;
  readonly model: string;
  readonly choices: readonly OpenAIChatCompletionChoice[];
  readonly usage?:
    | {
        readonly prompt_tokens: number;
        readonly completion_tokens: number;
        readonly total_tokens: number;
      }
    | undefined;
}

export interface OpenAIModelItem {
  readonly id: string;
  readonly object: 'model';
  readonly created: number;
  readonly owned_by: string;
}

export interface OpenAIListModelsResponse {
  readonly object: 'list';
  readonly data: readonly OpenAIModelItem[];
}

export class OpenAICompatClient {
  constructor(private readonly http: HttpClient) {}

  async createChatCompletion(
    request: OpenAIChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<OpenAIChatCompletionResponse> {
    return this.http.request<OpenAIChatCompletionResponse>({
      path: '/v1/chat/completions',
      body: request,
      signal,
    });
  }

  async chatCompletions(
    request: OpenAIChatCompletionRequest,
    signal?: AbortSignal,
  ): Promise<OpenAIChatCompletionResponse> {
    return this.createChatCompletion(request, signal);
  }

  async listModels(signal?: AbortSignal): Promise<OpenAIListModelsResponse> {
    return this.http.request<OpenAIListModelsResponse>({
      path: '/v1/models',
      method: 'GET',
      signal,
    });
  }
}
