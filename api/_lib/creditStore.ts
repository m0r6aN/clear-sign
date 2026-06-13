// ============================================================================
// In-memory CreditGate stub
// ----------------------------------------------------------------------------
// A non-persistent implementation of the CreditGate contract for local dev and
// tests. State lives in a module-level Map and resets on process restart.
//
// Owned by lane L0 (foundation). A production Table Storage-backed gate will be
// added later as a SEPARATE file implementing the same interface.
// ============================================================================

import { CreditGate, InsufficientCreditsError } from './contracts';

/** Credits granted to an email the first time it is seen. */
export const DEFAULT_FREE_CREDITS = 3;

export class InMemoryCreditStore implements CreditGate {
  private readonly balances = new Map<string, number>();

  constructor(private readonly defaultCredits: number = DEFAULT_FREE_CREDITS) {}

  private key(email: string): string {
    return email.trim().toLowerCase();
  }

  async check(email: string): Promise<number> {
    const k = this.key(email);
    if (!this.balances.has(k)) {
      this.balances.set(k, this.defaultCredits);
    }
    return this.balances.get(k) ?? 0;
  }

  async decrement(email: string, n: number): Promise<void> {
    const k = this.key(email);
    const current = await this.check(email);
    if (current < n) {
      throw new InsufficientCreditsError();
    }
    this.balances.set(k, current - n);
  }

  /** Test helper: directly set a balance. */
  set(email: string, credits: number): void {
    this.balances.set(this.key(email), credits);
  }

  /** Test helper: wipe all balances. */
  reset(): void {
    this.balances.clear();
  }
}

/** Shared singleton used by handlers in local/dev runs. */
export const inMemoryCreditStore = new InMemoryCreditStore();
