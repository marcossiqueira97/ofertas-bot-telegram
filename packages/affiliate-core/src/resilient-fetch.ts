export interface ResilienceOptions {
  timeoutMs?: number;
  maxRetries?: number;
  backoffMs?: number;
  shouldRetry?: (error: any) => boolean;
}

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends Error {
  public retryAfterMs?: number;
  constructor(message = 'Rate limit exceeded', retryAfterMs?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export async function withResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRetries = options.maxRetries ?? 3;
  const backoffMs = options.backoffMs ?? 100;
  const shouldRetry =
    options.shouldRetry ??
    ((err: any) => {
      // Abort immediately without retry on client error HTTP status (400, 401, 403, 404, 422)
      const status = err?.status || err?.response?.status;
      if (status && [400, 401, 403, 404, 422].includes(status)) {
        return false;
      }

      // Retry on 408 (Timeout), 429 (RateLimit), 5xx (Server Error), TimeoutError or network errors
      if (status && [408, 429, 500, 502, 503, 504].includes(status)) {
        return true;
      }

      if (err instanceof TimeoutError) return true;
      if (err instanceof RateLimitError) return true;
      if (err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.code === 'ENOTFOUND') return true;

      // Default to false for non-retryable errors
      return false;
    });

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      let timerId: ReturnType<typeof setTimeout> | undefined;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          reject(new TimeoutError(`Operation exceeded timeout of ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([fn(), timeoutPromise]);
        return result;
      } finally {
        if (timerId) clearTimeout(timerId);
      }
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(err)) {
        throw err;
      }

      let delay = backoffMs * Math.pow(2, attempt - 1);
      if (err instanceof RateLimitError && err.retryAfterMs) {
        delay = err.retryAfterMs;
      }

      // Apply slight jitter
      const jitter = Math.floor(Math.random() * 20);
      await new Promise((res) => setTimeout(res, delay + jitter));
    }
  }

  throw new Error('Resilience retries exhausted');
}
