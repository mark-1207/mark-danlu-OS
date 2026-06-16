import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, sleep } from '../../src/utils/retry.js';

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sleep resolves after specified ms', async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await promise;
    // If we get here without error, sleep worked
  });

  it('withRetry succeeds on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { retries: 3 }, 'test');
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('withRetry retries on failure up to limit', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    // Can't easily test async retry with fake timers without more setup
    // Just verify fn is called the right number of times
    vi.useRealTimers();
    const result = await withRetry(fn, { retries: 2, initialDelayMs: 10 }, 'test');
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('withRetry throws after exhausting retries', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { retries: 2, initialDelayMs: 10 }, 'test')).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
