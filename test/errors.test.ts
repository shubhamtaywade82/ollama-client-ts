import { describe, expect, it } from 'vitest';
import {
  mapError,
  OllamaAbortError,
  OllamaAuthError,
  OllamaNetworkError,
  OllamaNotFoundError,
  OllamaRateLimitError,
  OllamaServerError,
} from '../src/errors.js';

describe('Error Hierarchy & Mapping', () => {
  it('preserves existing OllamaClientError instances', () => {
    const original = new OllamaAuthError('Unauthorized');
    const mapped = mapError(original);
    expect(mapped).toBe(original);
    expect(mapped.code).toBe('auth_error');
    expect(mapped.retryable).toBe(false);
  });

  it('maps DOMException AbortError to OllamaAbortError', () => {
    const abort = new DOMException('The operation was aborted', 'AbortError');
    const mapped = mapError(abort);
    expect(mapped).toBeInstanceOf(OllamaAbortError);
    expect(mapped.code).toBe('aborted');
    expect(mapped.retryable).toBe(false);
  });

  it('maps TypeError to OllamaNetworkError', () => {
    const network = new TypeError('fetch failed');
    const mapped = mapError(network);
    expect(mapped).toBeInstanceOf(OllamaNetworkError);
    expect(mapped.code).toBe('network_error');
    expect(mapped.retryable).toBe(true);
  });

  it('maps HTTP 404 to OllamaNotFoundError', () => {
    const mapped = mapError(new Error('model not found'), { response: { status: 404 } });
    expect(mapped).toBeInstanceOf(OllamaNotFoundError);
    expect(mapped.code).toBe('not_found');
    expect(mapped.status).toBe(404);
  });

  it('maps HTTP 429 to OllamaRateLimitError', () => {
    const mapped = mapError(new Error('too many requests'), { response: { status: 429 } });
    expect(mapped).toBeInstanceOf(OllamaRateLimitError);
    expect(mapped.code).toBe('rate_limited');
    expect(mapped.retryable).toBe(true);
  });

  it('maps HTTP 500 to OllamaServerError', () => {
    const mapped = mapError(new Error('internal error'), { response: { status: 500 } });
    expect(mapped).toBeInstanceOf(OllamaServerError);
    expect(mapped.code).toBe('server_error');
    expect(mapped.retryable).toBe(true);
  });
});
