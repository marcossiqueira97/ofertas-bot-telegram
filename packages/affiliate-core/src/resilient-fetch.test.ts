import { describe, it, expect, vi } from 'vitest';
import { withResilience, TimeoutError, RateLimitError } from './resilient-fetch';

describe('withResilience', () => {
  it('should return result if fn succeeds on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withResilience(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry when operation fails with TimeoutError and eventually succeed', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new TimeoutError('Timeout test');
      return 'recovered';
    });

    const result = await withResilience(fn, { maxRetries: 2, backoffMs: 10 });
    expect(result).toBe('recovered');
    expect(calls).toBe(2);
  });

  it('should throw error when maxRetries is exceeded', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      throw new TimeoutError('Persistent timeout');
    });

    await expect(withResilience(fn, { maxRetries: 2, backoffMs: 5 })).rejects.toThrow(TimeoutError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect custom timeoutMs and reject with TimeoutError', async () => {
    const slowFn = () => new Promise((res) => setTimeout(res, 200));

    await expect(
      withResilience(slowFn, { timeoutMs: 50, maxRetries: 0 })
    ).rejects.toThrow(TimeoutError);
  });

  it('should handle RateLimitError and retry', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new RateLimitError('Rate limited', 20);
      return 'ok_after_rate_limit';
    });

    const result = await withResilience(fn, { maxRetries: 2 });
    expect(result).toBe('ok_after_rate_limit');
    expect(calls).toBe(2);
  });
});
