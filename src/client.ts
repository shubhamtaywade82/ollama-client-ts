/**
 * Main OllamaClient class.
 */

import { z } from 'zod';
import {
  DEFAULT_BASE_URL,
  DEFAULT_FAILOVER_CODES,
  DEFAULT_TIMEOUT_MS,
  type OllamaClientConfig,
} from './config.js';
import { OllamaClientError } from './errors.js';
import { createConsoleLogger, NOOP_LOGGER, type Logger } from './logger.js';
import { EndpointRegistry, type EndpointHealth } from './providers/endpoint-registry.js';
import { checkEndpointHealth, type EndpointHealthCheckResult } from './providers/health-check.js';
import {
  detectModelCapabilities,
  inferRuntimeMode,
  type ModelCapabilities,
  type RuntimeMode,
} from './capabilities/capabilities.js';
import { parseStructuredOutput, zodToJsonSchema } from './schema/zod.js';
import { normalizeChatStream, normalizeGenerateStream } from './streaming/normalize.js';
import { OllamaStream } from './streaming/stream.js';
import type {
  ChatStreamResult,
  GenerateStreamResult,
  ProgressStreamResult,
} from './streaming/types.js';
import { HttpClient, type BinaryBody, type FetchLike } from './transport/http.js';
import { DEFAULT_RETRY_CONFIG, withRetry, type RetryConfig } from './transport/retry.js';
import { createTimeoutSignal } from './transport/timeout.js';
import { ModelsClient } from './models-client.js';
import { OpenAICompatClient } from './integrations/openai.js';
import { AnthropicCompatClient } from './integrations/anthropic.js';
import type {
  ChatRequestOptions,
  ChatResponse,
  CopyRequestOptions,
  CreateRequestOptions,
  DeleteRequestOptions,
  EmbedRequestOptions,
  EmbedResponse,
  EmbeddingsRequestOptions,
  EmbeddingsResponse,
  GenerateRequestOptions,
  GenerateResponse,
  ModelResponse,
  ProgressResponse,
  PsResponse,
  PullRequestOptions,
  PushRequestOptions,
  ShowRequestOptions,
  ShowResponse,
  StatusResponse,
  VersionResponse,
  WebFetchRequestOptions,
  WebFetchResponse,
  WebSearchRequestOptions,
  WebSearchResponse,
} from './types.js';

export class OllamaClient {
  readonly registry: EndpointRegistry;
  readonly modelsClient: ModelsClient;
  private readonly retryConfig: RetryConfig;
  private readonly timeoutMs: number;
  private readonly failoverCodes: Set<string>;
  private readonly fetchImpl: FetchLike;
  private readonly logger: Logger;

  constructor(config: OllamaClientConfig = {}) {
    const endpoints = config.endpoints ?? [
      {
        name: 'default',
        baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
        ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
        ...(config.headers !== undefined ? { headers: config.headers } : {}),
      },
    ];
    this.registry = new EndpointRegistry(endpoints, config.endpointHealth);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.failoverCodes = new Set(config.failoverOn ?? DEFAULT_FAILOVER_CODES);
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.logger = config.logger ?? (config.debug ? createConsoleLogger() : NOOP_LOGGER);
    this.retryConfig =
      typeof config.retries === 'number'
        ? { ...DEFAULT_RETRY_CONFIG, maxRetries: config.retries }
        : { ...DEFAULT_RETRY_CONFIG, ...config.retries };
    this.modelsClient = new ModelsClient((op, opts) => this.executeWithFailover(op, opts));
  }

  async executeWithFailover<T>(
    operation: (http: HttpClient, signal: AbortSignal) => Promise<T>,
    options?: { signal?: AbortSignal | undefined; timeoutMs?: number | undefined },
  ): Promise<T> {
    const timeout = createTimeoutSignal(options?.timeoutMs ?? this.timeoutMs, options?.signal);
    try {
      const candidates = this.registry.candidates();
      let lastError: Error | undefined;

      for (const endpoint of candidates) {
        this.logger.debug(`Executing on endpoint "${endpoint.name}" (${endpoint.baseUrl})`);
        const http = new HttpClient({
          baseUrl: endpoint.baseUrl,
          ...(endpoint.apiKey !== undefined ? { apiKey: endpoint.apiKey } : {}),
          ...(endpoint.headers !== undefined ? { headers: endpoint.headers } : {}),
          fetch: this.fetchImpl,
        });

        try {
          const result = await withRetry(() => operation(http, timeout.signal), this.retryConfig);
          this.registry.reportSuccess(endpoint.name);
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          lastError = error;
          this.registry.reportFailure(endpoint.name);
          this.logger.warn(`Failed on "${endpoint.name}": ${error.message}`);
          if (!(error instanceof OllamaClientError && this.failoverCodes.has(error.code)))
            throw error;
        }
      }
      throw lastError ?? new Error('No healthy Ollama endpoints available');
    } finally {
      timeout.cancel();
    }
  }

  // --- Chat ---
  chat(
    request: ChatRequestOptions & { stream: true },
  ): Promise<OllamaStream<ChatResponse, ChatStreamResult>>;
  chat(request: ChatRequestOptions & { stream?: false | undefined }): Promise<ChatResponse>;
  chat(
    request: ChatRequestOptions,
  ): Promise<ChatResponse | OllamaStream<ChatResponse, ChatStreamResult>>;
  async chat(
    request: ChatRequestOptions,
  ): Promise<ChatResponse | OllamaStream<ChatResponse, ChatStreamResult>> {
    if (request.stream) {
      return this.executeWithFailover(async (http, signal) => {
        const stream = await http.requestStream<ChatResponse>({
          path: '/api/chat',
          body: { ...request, stream: true },
          signal,
        });
        return normalizeChatStream(stream);
      }, request);
    }
    return this.executeWithFailover(
      (http, signal) =>
        http.request<ChatResponse>({
          path: '/api/chat',
          body: { ...request, stream: false },
          signal,
        }),
      request,
    );
  }

  chatStream(
    request: Omit<ChatRequestOptions, 'stream'>,
  ): Promise<OllamaStream<ChatResponse, ChatStreamResult>> {
    return this.chat({ ...request, stream: true });
  }

  async chatText(request: Omit<ChatRequestOptions, 'stream'>): Promise<string> {
    const res = await this.chat({ ...request, stream: false });
    return res.message.content;
  }

  async chatWithSchema<T>(
    request: Omit<ChatRequestOptions, 'stream' | 'format'>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const format = zodToJsonSchema(schema);
    const res = await this.chat({ ...request, format, stream: false });
    return parseStructuredOutput(res.message.content, schema);
  }

  // --- Generate ---
  generate(
    request: GenerateRequestOptions & { stream: true },
  ): Promise<OllamaStream<GenerateResponse, GenerateStreamResult>>;
  generate(
    request: GenerateRequestOptions & { stream?: false | undefined },
  ): Promise<GenerateResponse>;
  generate(
    request: GenerateRequestOptions,
  ): Promise<GenerateResponse | OllamaStream<GenerateResponse, GenerateStreamResult>>;
  async generate(
    request: GenerateRequestOptions,
  ): Promise<GenerateResponse | OllamaStream<GenerateResponse, GenerateStreamResult>> {
    if (request.stream) {
      return this.executeWithFailover(async (http, signal) => {
        const stream = await http.requestStream<GenerateResponse>({
          path: '/api/generate',
          body: { ...request, stream: true },
          signal,
        });
        return normalizeGenerateStream(stream);
      }, request);
    }
    return this.executeWithFailover(
      (http, signal) =>
        http.request<GenerateResponse>({
          path: '/api/generate',
          body: { ...request, stream: false },
          signal,
        }),
      request,
    );
  }

  generateStream(
    request: Omit<GenerateRequestOptions, 'stream'>,
  ): Promise<OllamaStream<GenerateResponse, GenerateStreamResult>> {
    return this.generate({ ...request, stream: true });
  }

  async generateText(request: Omit<GenerateRequestOptions, 'stream'>): Promise<string> {
    const res = await this.generate({ ...request, stream: false });
    return res.response;
  }

  async generateWithSchema<T>(
    request: Omit<GenerateRequestOptions, 'stream' | 'format'>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const format = zodToJsonSchema(schema);
    const res = await this.generate({ ...request, format, stream: false });
    return parseStructuredOutput(res.response, schema);
  }

  // --- Embeddings ---
  embed(request: EmbedRequestOptions): Promise<EmbedResponse> {
    return this.executeWithFailover(
      (http, signal) => http.request<EmbedResponse>({ path: '/api/embed', body: request, signal }),
      request,
    );
  }

  async embedText(
    model: string,
    input: string | readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    const res = await this.embed({ model, input });
    return res.embeddings;
  }

  embeddings(request: EmbeddingsRequestOptions): Promise<EmbeddingsResponse> {
    return this.executeWithFailover(
      (http, signal) =>
        http.request<EmbeddingsResponse>({ path: '/api/embeddings', body: request, signal }),
      request,
    );
  }

  // --- Model Operations (Delegated to ModelsClient) ---
  listModels(): Promise<ModelResponse[]> {
    return this.modelsClient.list();
  }
  models(): Promise<ModelResponse[]> {
    return this.modelsClient.list();
  }
  showModel(request: ShowRequestOptions): Promise<ShowResponse> {
    return this.modelsClient.show(request);
  }
  pullModel(
    request: PullRequestOptions & { stream: true },
  ): Promise<OllamaStream<ProgressResponse, ProgressStreamResult>>;
  pullModel(
    request: PullRequestOptions & { stream?: false | undefined },
  ): Promise<ProgressResponse>;
  pullModel(
    request: PullRequestOptions,
  ): Promise<ProgressResponse | OllamaStream<ProgressResponse, ProgressStreamResult>> {
    return this.modelsClient.pull(request);
  }
  pushModel(
    request: PushRequestOptions & { stream: true },
  ): Promise<OllamaStream<ProgressResponse, ProgressStreamResult>>;
  pushModel(
    request: PushRequestOptions & { stream?: false | undefined },
  ): Promise<ProgressResponse>;
  pushModel(
    request: PushRequestOptions,
  ): Promise<ProgressResponse | OllamaStream<ProgressResponse, ProgressStreamResult>> {
    return this.modelsClient.push(request);
  }
  createModel(
    request: CreateRequestOptions & { stream: true },
  ): Promise<OllamaStream<ProgressResponse, ProgressStreamResult>>;
  createModel(
    request: CreateRequestOptions & { stream?: false | undefined },
  ): Promise<ProgressResponse>;
  createModel(
    request: CreateRequestOptions,
  ): Promise<ProgressResponse | OllamaStream<ProgressResponse, ProgressStreamResult>> {
    return this.modelsClient.create(request);
  }
  deleteModel(request: DeleteRequestOptions): Promise<StatusResponse> {
    return this.modelsClient.delete(request);
  }
  copyModel(request: CopyRequestOptions): Promise<StatusResponse> {
    return this.modelsClient.copy(request);
  }
  ps(): Promise<PsResponse> {
    return this.modelsClient.ps();
  }
  version(): Promise<VersionResponse> {
    return this.modelsClient.version();
  }
  createBlob(digest: string, data: BinaryBody): Promise<void> {
    return this.modelsClient.createBlob(digest, data);
  }
  checkBlob(digest: string): Promise<boolean> {
    return this.modelsClient.checkBlob(digest);
  }

  // --- Web Endpoints ---
  webSearch(request: WebSearchRequestOptions): Promise<WebSearchResponse> {
    return this.executeWithFailover(
      (http, signal) =>
        http.request<WebSearchResponse>({ path: '/api/websearch', body: request, signal }),
      request,
    );
  }
  webFetch(request: WebFetchRequestOptions): Promise<WebFetchResponse> {
    return this.executeWithFailover(
      (http, signal) =>
        http.request<WebFetchResponse>({ path: '/api/webfetch', body: request, signal }),
      request,
    );
  }

  // --- Capabilities & Health ---
  capabilities(model: string): Promise<ModelCapabilities> {
    return this.executeWithFailover((http) => detectModelCapabilities(http, model));
  }
  runtimeMode(): RuntimeMode {
    const ep = this.registry.candidates()[0];
    return inferRuntimeMode(ep?.baseUrl ?? DEFAULT_BASE_URL);
  }
  healthCheck(): Promise<EndpointHealthCheckResult[]> {
    return Promise.all(this.registry.list().map((ep) => checkEndpointHealth(ep, this.fetchImpl)));
  }
  endpointStatus(): EndpointHealth[] {
    return this.registry.status();
  }

  // --- OpenAI & Anthropic Compatibility Adapters ---
  get openai(): OpenAICompatClient {
    const ep = this.registry.candidates()[0];
    return new OpenAICompatClient(
      new HttpClient({
        baseUrl: ep?.baseUrl ?? DEFAULT_BASE_URL,
        apiKey: ep?.apiKey,
        headers: ep?.headers,
        fetch: this.fetchImpl,
      }),
    );
  }
  get anthropic(): AnthropicCompatClient {
    const ep = this.registry.candidates()[0];
    return new AnthropicCompatClient(
      new HttpClient({
        baseUrl: ep?.baseUrl ?? DEFAULT_BASE_URL,
        apiKey: ep?.apiKey,
        headers: ep?.headers,
        fetch: this.fetchImpl,
      }),
    );
  }
}
