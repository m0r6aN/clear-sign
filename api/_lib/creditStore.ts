// ============================================================================
// In-memory CreditGate stub
// ----------------------------------------------------------------------------
// A non-persistent implementation of the CreditGate contract for local dev and
// tests. State lives in a module-level Map and resets on process restart.
//
// Owned by lane L0 (foundation). A production Table Storage-backed gate will be
// added later as a SEPARATE file (Lane B) implementing the same interface.
// ============================================================================

import { CreditGate, InsufficientCreditsError, FREE_CREDITS } from './contracts';

export class InMemoryCreditStore implements CreditGate {
  private readonly balances = new Map<string, number>();

  constructor(private readonly defaultCredits: number = FREE_CREDITS) {}

  private key(clientId: string): string {
    return clientId.trim();
  }

  async check(clientId: string): Promise<number> {
    const k = this.key(clientId);
    if (!this.balances.has(k)) {
      this.balances.set(k, this.defaultCredits);
    }
    return this.balances.get(k) ?? 0;
  }

  async decrement(clientId: string, n: number): Promise<void> {
    const k = this.key(clientId);
    const current = await this.check(clientId);
    if (current < n) {
      throw new InsufficientCreditsError();
    }
    this.balances.set(k, current - n);
  }

  async grant(clientId: string, n: number): Promise<void> {
    const k = this.key(clientId);
    const current = await this.check(clientId);
    this.balances.set(k, current + n);
  }

  /** Test helper: directly set a balance. */
  set(clientId: string, credits: number): void {
    this.balances.set(this.key(clientId), credits);
  }

  /** Test helper: wipe all balances. */
  reset(): void {
    this.balances.clear();
  }
}

/** Shared singleton used by handlers in local/dev runs. */
export const inMemoryCreditStore = new InMemoryCreditStore();
