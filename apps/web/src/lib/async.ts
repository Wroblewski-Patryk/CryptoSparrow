import axios from 'axios';

export type AsyncRetryOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });

export const isRetriableHttpError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status == null) return true;
  return status === 408 || status === 425 || status === 429 || status >= 500;
};

export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  options: AsyncRetryOptions = {}
): Promise<T> => {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 0);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const shouldRetry = options.shouldRetry?.(error, attempt) ?? false;
      const canRetry = attempt < maxAttempts && shouldRetry;
      if (!canRetry) break;
      if (retryDelayMs > 0) {
        await wait(retryDelayMs);
      }
    }
  }

  throw lastError;
};

export const runAsyncWithState = async <T>(
  setPending: (next: boolean) => void,
  operation: () => Promise<T>
): Promise<T> => {
  setPending(true);
  try {
    return await operation();
  } finally {
    setPending(false);
  }
};
