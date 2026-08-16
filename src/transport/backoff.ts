/**
 * Exponential backoff with full jitter calculation.
 */

export interface BackoffOptions {
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffFactor: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  backoffFactor: 2,
};

/**
 * Calculates exponential backoff with full jitter for attempt (0-indexed).
 */
export function calculateBackoff(
  attempt: number,
  options: BackoffOptions = DEFAULT_BACKOFF,
): number {
  const exponential = options.initialDelayMs * Math.pow(options.backoffFactor, attempt);
  const ceiling = Math.min(exponential, options.maxDelayMs);
  // Full jitter: random duration between 0 and ceiling
  return Math.floor(Math.random() * (ceiling + 1));
}
