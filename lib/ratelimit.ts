/**
 * In-memory token-bucket rate limiter keyed by client IP.
 *
 * Good enough for single-instance (dev / single-region Vercel) deploys.
 * For multi-instance horizontal scaling, replace `buckets` with an external
 * store like Vercel KV / Upstash so all instances share state.
 */

import type { NextRequest } from "next/server";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  capacity: number;       // max requests in the window
  refillPerMs: number;    // tokens replenished per millisecond
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;  // seconds until the next token is available
  remaining: number;
}

export function getClientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: cfg.capacity, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  const refilled = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerMs);
  if (refilled >= 1) {
    bucket.tokens = refilled - 1;
    bucket.updatedAt = now;
    buckets.set(key, bucket);
    return { ok: true, retryAfterSec: 0, remaining: Math.floor(bucket.tokens) };
  }
  bucket.tokens = refilled;
  bucket.updatedAt = now;
  buckets.set(key, bucket);
  const msUntilToken = Math.ceil((1 - refilled) / cfg.refillPerMs);
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(msUntilToken / 1000)), remaining: 0 };
}

// Tunable defaults — analysis is expensive (LLM fan-out), fix is moderate.
export const ANALYZE_LIMIT: RateLimitConfig = {
  capacity: 6,             // burst of 6
  refillPerMs: 6 / 60_000, // 6 requests per minute steady state
};

export const FIX_LIMIT: RateLimitConfig = {
  capacity: 10,
  refillPerMs: 10 / 60_000,
};

/**
 * Periodically prune stale buckets so the map doesn't grow without bound.
 * Called opportunistically; not a hot path.
 */
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60_000;
const STALE_AGE_MS = 60 * 60_000;

export function sweepIfDue(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (now - b.updatedAt > STALE_AGE_MS) buckets.delete(k);
  }
}
