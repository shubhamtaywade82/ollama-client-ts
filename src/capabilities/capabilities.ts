/**
 * Model capability detection and runtime environment inference.
 */

import { HttpClient } from '../transport/http.js';
import type { ListResponse, ModelResponse, ShowResponse } from '../types.js';

export type RuntimeMode = 'local' | 'cloud' | 'unknown';

export interface ModelCapabilities {
  readonly model: string;
  readonly reported: readonly string[];
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;
  readonly supportsEmbedding: boolean;
  readonly supportsCompletion: boolean;
  readonly supportsThinking: boolean;
  readonly supportsStreaming: true;
  /**
   * Best-effort inference, not a guarantee: Ollama's `/api/show` does not report structured
   * output support as a queryable capability, so this is inferred from {@link inferRuntimeMode}
   * — `false` for `cloud`, since Ollama Cloud does not currently support structured outputs;
   * `true` otherwise. A locally-hosted model that genuinely can't follow a JSON schema will
   * still report `true` here; the request itself is the only reliable way to find out.
   */
  readonly supportsStructuredOutputRequest: boolean;
}

export function inferRuntimeMode(baseUrl: string): RuntimeMode {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.')
    ) {
      return 'local';
    }
    return 'cloud';
  } catch {
    return 'unknown';
  }
}

export async function detectModelCapabilities(
  http: HttpClient,
  model: string,
): Promise<ModelCapabilities> {
  const showRes = await http.request<ShowResponse>({
    path: '/api/show',
    body: { model },
  });

  const reported = showRes.capabilities ?? [];
  const reportedSet = new Set(reported.map((c) => c.toLowerCase()));

  return {
    model,
    reported,
    supportsTools: reportedSet.has('tools'),
    supportsVision: reportedSet.has('vision'),
    supportsEmbedding: reportedSet.has('embedding'),
    supportsCompletion: reportedSet.has('completion') || !reportedSet.has('embedding'),
    supportsThinking: reportedSet.has('thinking'),
    supportsStreaming: true,
    supportsStructuredOutputRequest: inferRuntimeMode(http.baseUrl) !== 'cloud',
  };
}

export async function listAvailableModels(http: HttpClient): Promise<ModelResponse[]> {
  const res = await http.request<ListResponse>({
    path: '/api/tags',
    method: 'GET',
  });
  return [...res.models];
}
