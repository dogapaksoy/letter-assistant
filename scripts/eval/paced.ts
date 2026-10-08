import { LlmError, type LlmProvider } from '../../src/core/llm/types';

export interface PacingOptions {
  /** Minimum time between the start of two requests. */
  minIntervalMs: number;
  /** Waits before each retry of a rate-limited or temporarily failing request. */
  retryDelaysMs: number[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onRetry?: (attempt: number, delayMs: number, error: LlmError) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Errors worth waiting for: rate limits and temporary provider failures (5xx, network). */
function isRetryable(error: unknown): error is LlmError {
  return (
    error instanceof LlmError &&
    (error.kind === 'rate_limit' || error.kind === 'timeout' || error.kind === 'provider')
  );
}

/**
 * Wraps a provider for free-tier APIs: spaces requests out and retries rate-limited or
 * temporarily failing ones with long waits. Only for the eval script, where finishing
 * slowly beats failing fast.
 */
export function withPacing(provider: LlmProvider, options: PacingOptions): LlmProvider {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  let lastStart = -Infinity;

  const paced = async () => {
    const wait = lastStart + options.minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    lastStart = now();
  };

  return {
    name: provider.name,
    async complete(request) {
      for (let attempt = 0; ; attempt++) {
        await paced();
        try {
          return await provider.complete(request);
        } catch (error) {
          const delay = options.retryDelaysMs[attempt];
          if (!isRetryable(error) || delay === undefined) throw error;
          options.onRetry?.(attempt + 1, delay, error);
          await sleep(delay);
        }
      }
    },
  };
}
