// ============================================================================
// In-memory IP rate limiter
// ----------------------------------------------------------------------------
// A basic fixed-window limiter keyed by client IP. Because /ask and /ocr are
// free (CREDIT_COST 0) and an anonymous clientId is cheap to mint, the IP limit
// is the real backstop against using ClearSign as a free LLM proxy. /analyze is
// also limited (in addition to its credit gate) to blunt abuse bursts.
//
// State is module-level and per-instance — fine for a basic backstop. A
// production deployment would move this to a shared store (Table/Redis); the
// seam is the `RateLimiter` interface.
//
// Owned by lane A (LLM proxy).
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfter: number;
}

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const WINDOW_MS = 60_000;

/** Requests per IP per minute, per logical bucket. */
export const LIMITS = {
  analyze: 20,
  ask: 60,
  ocr: 30,
} as const;

export type LimitBucket = keyof typeof LIMITS;

const windows = new Map<string, Window>();

/**
 * Record a hit for (bucket, ip) and report whether it is allowed. Uses a fixed
 * window: the first request starts a 60s window; the (limit+1)th within it is
 * rejected.
 */
export function rateLimit(bucket: LimitBucket, ip: string, now = Date.now()): RateLimitResult {
  const key = `${bucket}:${ip}`;
  const limit = LIMITS[bucket];
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/** Test helper: clear all windows. */
export function resetRateLimiter(): void {
  windows.clear();
}
