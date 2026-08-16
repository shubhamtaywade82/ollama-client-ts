/**
 * Configuration options and constants for OllamaClient.
 */

import type { Logger, RequestLifecycleHook } from './logger.js';
import type { Middleware } from './middleware.js';
import type { RetryConfig } from './transport/retry.js';
import type { FetchLike } from './transport/http.js';
import type { EndpointRegistryOptions, OllamaEndpoint } from './providers/endpoint-registry.js';

export const DEFAULT_BASE_URL = 'http://localhost:11434';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_FAILOVER_CODES: readonly string[] = [
  'network_error',
  'timeout',
  'server_error',
  'rate_limited',
  'auth_error',
];

export interface OllamaClientConfig {
  /** Base URL of a single Ollama server. Ignored if `endpoints` is provided. Defaults to `http://localhost:11434`. */
  readonly baseUrl?: string;
  /** Bearer token sent as `Authorization: Bearer <apiKey>` for a single-endpoint setup. */
  readonly apiKey?: string;
  /** Static headers merged into every request. */
  readonly headers?: Record<string, string>;
  /** Multiple named endpoints for rotation and automatic failover. */
  readonly endpoints?: readonly OllamaEndpoint[];
  /** Tuning options for endpoint circuit breaker. */
  readonly endpointHealth?: EndpointRegistryOptions;
  /** Error codes that trigger failover to the next candidate endpoint. */
  readonly failoverOn?: readonly string[];
  /** Default per-request timeout in milliseconds (default 30_000ms). */
  readonly timeoutMs?: number;
  /** Retry configuration or retry count override. */
  readonly retries?: number | Partial<RetryConfig>;
  /** Custom fetch implementation (defaults to globalThis.fetch). */
  readonly fetch?: FetchLike;
  /** Request/Response middleware list. */
  readonly middleware?: readonly Middleware[];
  /** Structured logger. */
  readonly logger?: Logger;
  /** Enables console debug logger if true. */
  readonly debug?: boolean;
  /** Request lifecycle hook for telemetry/metrics. */
  readonly onLifecycleEvent?: RequestLifecycleHook;
}
