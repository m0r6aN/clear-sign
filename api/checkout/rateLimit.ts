// ============================================================================
// FixedWindowRateLimiter — process-local IP rate limiting for /checkout
// ----------------------------------------------------------------------------
// A deliberately simple fixed-window counter. This is a per-instance backstop
// against checkout-session spam (each session creation is a Stripe API call and
// a potential cost/abuse vector), NOT a distributed quota — under Functions
// scale-out each instance keeps its own window, which is acceptable for the
// purpose. `now` is injectable so the behaviour is deterministically testable.
// ============================================================================

export class FixedWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(opts: { limit: number; windowMs: number; now?: () => number }) {
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Returns true if the request is allowed, false if the key is over limit. */
  allow(key: string): boolean {
    const t = this.now();
    const entry = this.windows.get(key);
    if (!entry || t >= entry.resetAt) {
      this.windows.set(key, { count: 1, resetAt: t + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) {
      return false;
    }
    entry.count += 1;
    return true;
  }
}

/** Shared limiter for the checkout endpoint: 10 sessions per IP per 10 min. */
export const checkoutRateLimiter = new FixedWindowRateLimiter({
  limit: 10,
  windowMs: 10 * 60 * 1000,
});
