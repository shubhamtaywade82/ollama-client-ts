/**
 * Request/response middleware pipeline.
 */

export interface RequestContext {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export interface ResponseContext {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

export type NextFunction = () => Promise<ResponseContext>;

export interface MiddlewareContext {
  readonly request: RequestContext;
  readonly next: NextFunction;
}

export interface Middleware {
  (ctx: MiddlewareContext): Promise<ResponseContext>;
}

export function composeMiddleware(
  middlewares: readonly Middleware[],
  finalHandler: (req: RequestContext) => Promise<ResponseContext>,
): (req: RequestContext) => Promise<ResponseContext> {
  return function runPipeline(initialRequest: RequestContext): Promise<ResponseContext> {
    let index = -1;

    function dispatch(i: number, currentRequest: RequestContext): Promise<ResponseContext> {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times in middleware'));
      }
      index = i;
      const fn = middlewares[i];
      if (i === middlewares.length || !fn) {
        return finalHandler(currentRequest);
      }
      return fn({
        request: currentRequest,
        next: () => dispatch(i + 1, currentRequest),
      });
    }

    return dispatch(0, initialRequest);
  };
}
