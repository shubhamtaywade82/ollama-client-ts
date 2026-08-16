/**
 * Multi-endpoint registry with priority routing and circuit breaker failover.
 */

export interface OllamaEndpoint {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey?: string | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly priority?: number | undefined;
}

export interface EndpointHealth {
  readonly endpoint: OllamaEndpoint;
  readonly failureCount: number;
  readonly lastFailureTimestamp?: number | undefined;
  readonly isCoolingDown: boolean;
}

export interface EndpointRegistryOptions {
  readonly failureThreshold?: number | undefined;
  readonly cooldownMs?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class EndpointRegistry {
  private readonly endpoints: readonly OllamaEndpoint[];
  private readonly failureCounts = new Map<string, number>();
  private readonly lastFailures = new Map<string, number>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(endpoints: readonly OllamaEndpoint[], options: EndpointRegistryOptions = {}) {
    this.endpoints = endpoints.length > 0 ? endpoints : [{ name: 'default', baseUrl: 'http://localhost:11434' }];
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  candidates(): OllamaEndpoint[] {
    const currentTime = this.now();
    const healthy: OllamaEndpoint[] = [];
    const coolingDown: Array<{ endpoint: OllamaEndpoint; recoveredAt: number }> = [];

    for (const ep of this.endpoints) {
      const failures = this.failureCounts.get(ep.name) ?? 0;
      const lastFail = this.lastFailures.get(ep.name) ?? 0;
      const isCooling = failures >= this.failureThreshold && currentTime - lastFail < this.cooldownMs;

      if (!isCooling) {
        healthy.push(ep);
      } else {
        coolingDown.push({ endpoint: ep, recoveredAt: lastFail + this.cooldownMs });
      }
    }

    if (healthy.length > 0) {
      return healthy.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    // Fail-open: sort by soonest-to-recover
    return coolingDown.sort((a, b) => a.recoveredAt - b.recoveredAt).map((c) => c.endpoint);
  }

  reportSuccess(name: string): void {
    this.failureCounts.delete(name);
    this.lastFailures.delete(name);
  }

  reportFailure(name: string): void {
    const current = (this.failureCounts.get(name) ?? 0) + 1;
    this.failureCounts.set(name, current);
    this.lastFailures.set(name, this.now());
  }

  list(): readonly OllamaEndpoint[] {
    return this.endpoints;
  }

  status(): EndpointHealth[] {
    const currentTime = this.now();
    return this.endpoints.map((ep) => {
      const failures = this.failureCounts.get(ep.name) ?? 0;
      const lastFail = this.lastFailures.get(ep.name);
      const isCoolingDown =
        failures >= this.failureThreshold &&
        lastFail !== undefined &&
        currentTime - lastFail < this.cooldownMs;

      return {
        endpoint: ep,
        failureCount: failures,
        ...(lastFail !== undefined ? { lastFailureTimestamp: lastFail } : {}),
        isCoolingDown,
      };
    });
  }
}
