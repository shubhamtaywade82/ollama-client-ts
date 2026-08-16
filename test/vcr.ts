/**
 * Lightweight VCR (Video Cassette Recorder) testing harness for OllamaClient.
 * Records real HTTP interactions with Ollama and replays them deterministically in tests.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OllamaClient } from '../src/client.js';
import type { OllamaClientConfig } from '../src/config.js';
import type { FetchLike } from '../src/transport/http.js';

export type VcrMode = 'record' | 'replay' | 'live';

export interface VcrRecordedInteraction {
  readonly request: {
    readonly url: string;
    readonly method: string;
    readonly body?: unknown;
  };
  readonly response: {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Record<string, string>;
    readonly bodyText: string;
  };
}

export interface VcrCassette {
  readonly name: string;
  readonly recordedAt: string;
  readonly interactions: VcrRecordedInteraction[];
}

function getCassettePath(name: string): string {
  return join(__dirname, 'fixtures', 'cassettes', `${name}.json`);
}

function createReplayFetch(cassette: VcrCassette): FetchLike {
  let interactionIndex = 0;

  return async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const interaction = cassette.interactions[interactionIndex];
    if (!interaction) {
      throw new Error(
        `VCR Replay: No recorded interaction at index ${interactionIndex} for cassette "${cassette.name}"`,
      );
    }
    interactionIndex++;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(interaction.response.bodyText));
        controller.close();
      },
    });

    return new Response(stream, {
      status: interaction.response.status,
      statusText: interaction.response.statusText,
      headers: new Headers(interaction.response.headers),
    });
  };
}

function createRecordFetch(
  realFetch: FetchLike,
  onInteraction: (interaction: VcrRecordedInteraction) => void,
): FetchLike {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';
    const parsedBody = typeof init?.body === 'string' ? tryParseJson(init.body) : undefined;

    const realResponse = await realFetch(input, init);
    const bodyText = await realResponse.text();

    const headers: Record<string, string> = {};
    realResponse.headers.forEach((val, key) => {
      headers[key] = val;
    });

    onInteraction({
      request: { url, method, ...(parsedBody !== undefined ? { body: parsedBody } : {}) },
      response: {
        status: realResponse.status,
        statusText: realResponse.statusText,
        headers,
        bodyText,
      },
    });

    const encoder = new TextEncoder();
    return new Response(encoder.encode(bodyText), {
      status: realResponse.status,
      statusText: realResponse.statusText,
      headers: realResponse.headers,
    });
  };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Runs a test block with VCR recording or replay against Ollama.
 */
export async function useVcr(
  cassetteName: string,
  testFn: (client: OllamaClient) => Promise<void>,
  options: OllamaClientConfig = {},
): Promise<void> {
  const cassettePath = getCassettePath(cassetteName);
  const vcrMode: VcrMode =
    (process.env['VCR_MODE'] as VcrMode) ?? (existsSync(cassettePath) ? 'replay' : 'record');

  if (vcrMode === 'replay') {
    const raw = readFileSync(cassettePath, 'utf-8');
    const cassette = JSON.parse(raw) as VcrCassette;
    const replayFetch = createReplayFetch(cassette);
    const client = new OllamaClient({ timeoutMs: 120_000, ...options, fetch: replayFetch });
    await testFn(client);
    return;
  }

  const interactions: VcrRecordedInteraction[] = [];
  const realFetch = options.fetch ?? globalThis.fetch;
  const recordFetch = createRecordFetch(realFetch, (item) => interactions.push(item));

  const client = new OllamaClient({
    baseUrl: options.baseUrl ?? process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
    timeoutMs: 120_000,
    ...options,
    fetch: recordFetch,
  });

  await testFn(client);

  if (vcrMode === 'record') {
    const cassette: VcrCassette = {
      name: cassetteName,
      recordedAt: new Date().toISOString(),
      interactions,
    };
    mkdirSync(dirname(cassettePath), { recursive: true });
    writeFileSync(cassettePath, JSON.stringify(cassette, null, 2), 'utf-8');
  }
}
