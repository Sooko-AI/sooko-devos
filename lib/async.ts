/**
 * Shared async primitives for the agent pipeline.
 *
 * - `withTimeout`  — race a promise against a deadline.
 * - `withRetry`    — single-bounded retry with jittered backoff, only for
 *                    transient provider errors (429 / 5xx / network / timeout).
 * - `linkAbort`    — turn an AbortSignal into a promise that rejects on abort,
 *                    used to fail-fast when the client disconnects.
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export class AbortedError extends Error {
  constructor(label: string) {
    super(`${label} aborted`);
    this.name = "AbortedError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError(label));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new TimeoutError(label, ms));
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new AbortedError(label));
    };
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => { cleanup(); resolve(v); },
      (e) => { cleanup(); reject(e); }
    );
  });
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_CODE_FRAGMENTS = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"];

export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { status?: number; code?: string; name?: string; message?: string };
  if (anyErr.name === "AbortedError") return false;
  if (anyErr.name === "TimeoutError") return true;
  if (typeof anyErr.status === "number" && RETRYABLE_STATUS.has(anyErr.status)) return true;
  const codeOrMsg = `${anyErr.code ?? ""} ${anyErr.message ?? ""}`;
  return RETRYABLE_CODE_FRAGMENTS.some((frag) => codeOrMsg.includes(frag));
}

export interface RetryOptions {
  attempts?: number;          // total attempts including the first (default: 2)
  baseDelayMs?: number;       // base delay before retry (default: 500ms)
  label: string;
  signal?: AbortSignal;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const attempts = opts.attempts ?? 2;
  const base = opts.baseDelayMs ?? 500;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (opts.signal?.aborted) throw new AbortedError(opts.label);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      if (!isRetryableError(err)) break;
      const jitter = Math.floor(Math.random() * base);
      const delay = base * Math.pow(2, i) + jitter;
      await sleepWithAbort(delay, opts.signal);
    }
  }
  throw lastErr;
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError("retry-backoff"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AbortedError("retry-backoff"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
