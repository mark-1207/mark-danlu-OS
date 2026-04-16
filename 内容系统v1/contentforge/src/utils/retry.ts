import { logger } from './logger.js';

export interface RetryConfig {
  retries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Sleep for ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * Retries on any error except fatal ones (auth failures).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName = 'operation',
): Promise<T> {
  const { retries, initialDelayMs, backoffMultiplier } = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Auth failures are fatal — don't retry
      if (isAuthError(error)) {
        logger.error(`Fatal auth error during ${operationName}, not retrying`);
        throw error;
      }

      if (attempt < retries) {
        const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
        logger.warn(`Retry ${attempt + 1}/${retries} for ${operationName} after ${delay}ms: ${String(error)}`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Check if an error is an authentication failure (401/403)
 */
function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const status = (error as Record<string, unknown>)['status'] ?? (error as Record<string, unknown>)['statusCode'];
    return status === 401 || status === 403;
  }
  return false;
}
