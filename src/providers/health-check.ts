/**
 * Active endpoint health pinging utility.
 */

import { HttpClient, type FetchLike } from '../transport/http.js';
import type { OllamaEndpoint } from './endpoint-registry.js';
import type { VersionResponse } from '../types.js';

export interface EndpointHealthCheckResult {
  readonly name: string;
  readonly baseUrl: string;
  readonly reachable: boolean;
  readonly latencyMs: number;
  readonly version?: string;
  readonly error?: string;
}

export async function checkEndpointHealth(
  endpoint: OllamaEndpoint,
  fetchImpl?: FetchLike,
  timeoutMs = 5000,
): Promise<EndpointHealthCheckResult> {
  const client = new HttpClient({
    baseUrl: endpoint.baseUrl,
    apiKey: endpoint.apiKey,
    headers: endpoint.headers,
    fetch: fetchImpl,
  });

  const startTime = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await client.request<VersionResponse>({
      path: '/api/version',
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startTime;
    return {
      name: endpoint.name,
      baseUrl: endpoint.baseUrl,
      reachable: true,
      latencyMs,
      version: res.version,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      name: endpoint.name,
      baseUrl: endpoint.baseUrl,
      reachable: false,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
