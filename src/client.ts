/**
 * Main OllamaClient class with failover, streaming, structured outputs, and ecosystem integrations.
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
import type { ChatStreamResult, GenerateStreamResult } from './streaming/types.js';
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
  PullRequestOptions,
  PushRequestOptions,
  ShowRequestOptions,
  WebFetchRequestOptions,
  WebFetchResponse,
  WebSearchRequestOptions,
  WebSearchResponse,
} from './types.js';

export class OllamaClient {
  readonly registry: EndpointRegistry;
  readonly models: ModelsClient;
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
    this.models = new ModelsClient((op, opts) => this.executeWithFailover(op, opts));
  }

  get modelsClient(): ModelsClient {
    return this.models;
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
    req: ChatRequestOptions & { stream: true },
  ): Promise<OllamaStream<ChatResponse, ChatStreamResult>>;
  chat(req: ChatRequestOptions & { stream?: false | undefined }): Promise<ChatResponse>;
  chat(
    req: ChatRequestOptions,
  ): Promise<ChatResponse | OllamaStream<ChatResponse, ChatStreamResult>>;
  async chat(
    req: ChatRequestOptions,
  ): Promise<ChatResponse | OllamaStream<ChatResponse, ChatStreamResult>> {
    if (req.stream) {
      return this.executeWithFailover(async (http, signal) => {
        const stream = await http.requestStream<ChatResponse>({
          path: '/api/chat',
          body: { ...req, stream: true },
          signal,
        });
        return normalizeChatStream(stream);
      }, req);
    }
    return this.executeWithFailover(
      (http, signal) =>
        http.request<ChatResponse>({ path: '/api/chat', body: { ...req, stream: false }, signal }),
      req,
    );
  }

  chatStream(
    req: Omit<ChatRequestOptions, 'stream'>,
  ): Promise<OllamaStream<ChatResponse, ChatStreamResult>> {
    return this.chat({ ...req, stream: true });
  }

  async chatText(req: Omit<ChatRequestOptions, 'stream'>): Promise<string> {
    const res = await this.chat({ ...req, stream: false });
    return res.message.content;
  }

  async chatWithSchema<T>(
    req: Omit<ChatRequestOptions, 'stream' | 'format'>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const res = await this.chat({ ...req, format: zodToJsonSchema(schema), stream: false });
    return parseStructuredOutput(res.message.content, schema);
  }

  // --- Generate ---
  generate(
    req: GenerateRequestOptions & { stream: true },
  ): Promise<OllamaStream<GenerateResponse, GenerateStreamResult>>;
  generate(req: GenerateRequestOptions & { stream?: false | undefined }): Promise<GenerateResponse>;
  generate(
    req: GenerateRequestOptions,
  ): Promise<GenerateResponse | OllamaStream<GenerateResponse, GenerateStreamResult>>;
  async generate(
    req: GenerateRequestOptions,
  ): Promise<GenerateResponse | OllamaStream<GenerateResponse, GenerateStreamResult>> {
    if (req.stream) {
      return this.executeWithFailover(async (http, signal) => {
        const stream = await http.requestStream<GenerateResponse>({
          path: '/api/generate',
          body: { ...req, stream: true },
          signal,
        });
        return normalizeGenerateStream(stream);
      }, req);
    }
    return this.executeWithFailover(
      (http, signal) =>
        http.request<GenerateResponse>({
          path: '/api/generate',
          body: { ...req, stream: false },
          signal,
        }),
      req,
    );
  }

  generateStream(
    req: Omit<GenerateRequestOptions, 'stream'>,
  ): Promise<OllamaStream<GenerateResponse, GenerateStreamResult>> {
    return this.generate({ ...req, stream: true });
  }

  async generateText(req: Omit<GenerateRequestOptions, 'stream'>): Promise<string> {
    const res = await this.generate({ ...req, stream: false });
    return res.response;
  }

  async generateWithSchema<T>(
    req: Omit<GenerateRequestOptions, 'stream' | 'format'>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const res = await this.generate({ ...req, format: zodToJsonSchema(schema), stream: false });
    return parseStructuredOutput(res.response, schema);
  }

  // --- Embeddings ---
  embed(req: EmbedRequestOptions): Promise<EmbedResponse> {
    return this.executeWithFailover(
      (http, signal) => http.request<EmbedResponse>({ path: '/api/embed', body: req, signal }),
      req,
    );
  }

  async embedText(
    model: string,
    input: string | readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    const res = await this.embed({ model, input });
    return res.embeddings;
  }

  embeddings(req: EmbeddingsRequestOptions): Promise<EmbeddingsResponse> {
    return this.executeWithFailover(
      (http, signal) =>
        http.request<EmbeddingsResponse>({ path: '/api/embeddings', body: req, signal }),
      req,
    );
  }

  // --- Model Operations (Delegated to ModelsClient) ---
  readonly listModels = () => this.models.list();
  readonly showModel = (req: ShowRequestOptions) => this.models.show(req);
  readonly pullModel = (r: PullRequestOptions) => this.models.pull(r);
  readonly pushModel = (r: PushRequestOptions) => this.models.push(r);
  readonly createModel = (r: CreateRequestOptions) => this.models.create(r);
  readonly deleteModel = (req: DeleteRequestOptions) => this.models.delete(req);
  readonly copyModel = (req: CopyRequestOptions) => this.models.copy(req);
  readonly ps = () => this.models.ps();
  readonly version = () => this.models.version();
  readonly createBlob = (digest: string, data: BinaryBody) => this.models.createBlob(digest, data);
  readonly checkBlob = (digest: string) => this.models.checkBlob(digest);

  // --- Web Endpoints ---
  webSearch(req: WebSearchRequestOptions): Promise<WebSearchResponse> {
    return this.executeWithFailover(
      (http, signal) =>
        http.request<WebSearchResponse>({ path: '/api/websearch', body: req, signal }),
      req,
    );
  }
  webFetch(req: WebFetchRequestOptions): Promise<WebFetchResponse> {
    return this.executeWithFailover(
      (http, signal) =>
        http.request<WebFetchResponse>({ path: '/api/webfetch', body: req, signal }),
      req,
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

  // --- Compatibility Adapters ---
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
