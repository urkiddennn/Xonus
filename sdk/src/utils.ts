import { XonusAbortError, XonusApiError, XonusTimeoutError } from './errors';

/** Merge several abort signals into one. */
export function anySignal(signals: Array<AbortSignal | undefined>): AbortSignal {
  const present = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (present.length === 0) return new AbortController().signal;
  if (present.length === 1) return present[0] as AbortSignal;

  const anyFn = (AbortSignal as unknown as { any?: (values: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') return anyFn(present);

  const controller = new AbortController();
  const onAbort = (event: Event) => {
    const target = event.target as AbortSignal | null;
    controller.abort(target?.reason);
  };
  for (const signal of present) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

export interface Deadline {
  signal: AbortSignal;
  didTimeout(): boolean;
  cleanup(): void;
}

/** Create a deadline that combines the caller's signal with a timeout. */
export function createDeadline(parent: AbortSignal | undefined, timeoutMs: number): Deadline {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new XonusTimeoutError(`The decision timed out after ${timeoutMs}ms.`));
  }, timeoutMs);
  (timer as { unref?: () => void }).unref?.();

  const onAbort = () => {
    controller.abort(
      parent?.reason instanceof Error ? parent.reason : new XonusAbortError('The decision was aborted.'),
    );
  };

  if (parent) {
    if (parent.aborted) onAbort();
    else parent.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

/** Throw the correct typed error if a signal has been aborted. */
export function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const reason = signal.reason;
  if (reason instanceof XonusTimeoutError) throw reason;
  if (reason instanceof XonusAbortError) throw reason;
  throw new XonusAbortError('The decision was aborted.', { cause: reason });
}

/** Abort-aware sleep used by the retry loop. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    (timer as { unref?: () => void }).unref?.();

    const onAbort = () => {
      clearTimeout(timer);
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as { status?: unknown; statusCode?: unknown }).status;
  if (typeof status === 'number') return status;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof XonusAbortError || error instanceof XonusTimeoutError) return false;
  const status = getErrorStatus(error);
  if (status !== undefined) return status === 429 || status === 408 || status >= 500;
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|econnreset|etimedout|eai_again|enotfound|socket hang up|network|temporarily unavailable/i.test(
    message,
  );
}

export interface RetryOptions {
  retries: number;
  signal: AbortSignal;
  /** Base backoff in milliseconds. Default: 250. */
  baseDelayMs?: number;
}

/** Retry retryable Gemini failures with exponential backoff and jitter. */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { retries, signal, baseDelayMs = 250 } = options;
  let attempt = 0;

  for (;;) {
    throwIfAborted(signal);
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
      attempt += 1;
      await sleep(delay, signal);
    }
  }
}

/** Wrap unknown failures as `XonusApiError` with a useful status. */
export function toApiError(error: unknown): XonusApiError {
  if (error instanceof XonusApiError) return error;
  const status = getErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return new XonusApiError(`Gemini request failed: ${message}`, {
    cause: error,
    ...(status !== undefined ? { status } : {}),
  });
}
