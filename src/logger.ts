/**
 * Structured logger and request lifecycle interfaces.
 */

export interface LogFn {
  (message: string, context?: Record<string, unknown>): void;
}

export interface Logger {
  readonly debug: LogFn;
  readonly info: LogFn;
  readonly warn: LogFn;
  readonly error: LogFn;
}

export interface LifecycleStartEvent {
  readonly type: 'start';
  readonly requestId: string;
  readonly method: string;
  readonly url: string;
  readonly timestamp: number;
}

export interface LifecycleSuccessEvent {
  readonly type: 'success';
  readonly requestId: string;
  readonly durationMs: number;
  readonly status: number;
  readonly timestamp: number;
}

export interface LifecycleRetryEvent {
  readonly type: 'retry';
  readonly requestId: string;
  readonly attempt: number;
  readonly error: Error;
  readonly delayMs: number;
  readonly timestamp: number;
}

export interface LifecycleErrorEvent {
  readonly type: 'error';
  readonly requestId: string;
  readonly durationMs: number;
  readonly error: Error;
  readonly timestamp: number;
}

export type RequestLifecycleEvent =
  LifecycleStartEvent | LifecycleSuccessEvent | LifecycleRetryEvent | LifecycleErrorEvent;

export interface RequestLifecycleHook {
  (event: RequestLifecycleEvent): void;
}

export const NOOP_LOGGER: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function createConsoleLogger(prefix = '[@nemesis-oss/ollama-sdk]'): Logger {
  return {
    debug: (msg, ctx) => console.debug(`${prefix} ${msg}`, ctx ?? ''),
    info: (msg, ctx) => console.info(`${prefix} ${msg}`, ctx ?? ''),
    warn: (msg, ctx) => console.warn(`${prefix} ${msg}`, ctx ?? ''),
    error: (msg, ctx) => console.error(`${prefix} ${msg}`, ctx ?? ''),
  };
}
