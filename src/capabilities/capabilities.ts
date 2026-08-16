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
  readonly supportsStreaming: true;
  readonly supportsStructuredOutputRequest: true;
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
    supportsStreaming: true,
    supportsStructuredOutputRequest: true,
  };
}

export async function listAvailableModels(http: HttpClient): Promise<ModelResponse[]> {
  const res = await http.request<ListResponse>({
    path: '/api/tags',
    method: 'GET',
  });
  return [...res.models];
}
