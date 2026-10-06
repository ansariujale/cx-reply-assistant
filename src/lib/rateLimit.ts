/**
 * Minimal fixed-window rate limiter kept in process memory.
 * Good enough to stop a public demo URL from burning LLM credit; a real
 * deployment would move this to Redis/Upstash or an edge middleware so the
 * limit is shared across instances.
 */

type GlobalWithBuckets = typeof globalThis & { __cxRateBuckets?: Map<string, number[]> };

function buckets(): Map<string, number[]> {
  const g = globalThis as GlobalWithBuckets;
  if (!g.__cxRateBuckets) g.__cxRateBuckets = new Map();
  return g.__cxRateBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): RateLimitResult {
  const store = buckets();
  const cutoff = now - windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    store.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  hits.push(now);
  store.set(key, hits);
  if (store.size > 5000) {
    for (const [k, v] of store) if (v.every((t) => t <= cutoff)) store.delete(k);
  }
  return { allowed: true, remaining: limit - hits.length, retryAfterSec: 0 };
}
