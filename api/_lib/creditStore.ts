// ============================================================================
// CreditGate implementations
// ----------------------------------------------------------------------------
// Two implementations of the CreditGate seam (api/_lib/contracts.ts):
//
//   - InMemoryCreditStore        non-persistent; local dev + tests (from L0)
//   - TableStorageCreditStore    production; Azure Table Storage, atomic via
//                                ETag optimistic concurrency
//
// plus an event-dedupe store used by the Stripe webhook to make credit grants
// idempotent (one Stripe event => at most one grant), and a getCreditStore()
// factory that picks the implementation from the environment.
//
// Money path. Correctness and idempotency over cleverness:
//   - balances are keyed on the anonymous clientId (NOT email); email is stored
//     as an attribute for receipts / lead capture (see IDENTITY/CREDIT MODEL).
//   - decrement/grant are read-modify-write loops guarded by the row ETag, so a
//     concurrent writer can never silently clobber another's update.
//   - decrement clamps at zero and never goes negative.
// ============================================================================

import { TableClient, RestError } from '@azure/data-tables';
import { CreditGate, InsufficientCreditsError, FREE_CREDITS } from './contracts';

// ----------------------------------------------------------------------------
// In-memory stub (L0) — kept for local dev and unit tests of other lanes.
// ----------------------------------------------------------------------------

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

  async grant(clientId: string, n: number, email?: string): Promise<void> {
    const k = this.key(clientId);
    const current = await this.check(clientId);
    this.balances.set(k, current + n);
    void email; // in-memory store does not retain the email attribute
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

// ----------------------------------------------------------------------------
// Table Storage implementation
// ----------------------------------------------------------------------------

/** Table name for the credit ledger (one row per client). */
export const CREDITS_TABLE_NAME = 'credits';
/** Table name for processed Stripe event ids (webhook idempotency). */
export const EVENTS_TABLE_NAME = 'stripeevents';
/** Single balance row per client; partitionKey = clientId. */
export const BALANCE_ROW_KEY = 'balance';
/** Single partition for the event-dedupe table. */
export const EVENT_PARTITION_KEY = 'event';

/** How many ETag-conflict retries before giving up on a contended row. */
const DEFAULT_MAX_RETRIES = 8;

interface BalanceEntity {
  partitionKey: string;
  rowKey: string;
  credits: number;
  email?: string;
  firstSeenAt?: string;
  updatedAt?: string;
}

function statusOf(err: unknown): number | undefined {
  if (err instanceof RestError) return err.statusCode;
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const s = (err as { statusCode?: unknown }).statusCode;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

export class TableStorageCreditStore implements CreditGate {
  private readonly freeCredits: number;
  private readonly maxRetries: number;

  constructor(
    private readonly table: TableClient,
    opts?: { freeCredits?: number; maxRetries?: number },
  ) {
    this.freeCredits = opts?.freeCredits ?? FREE_CREDITS;
    this.maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private key(clientId: string): string {
    const k = clientId.trim();
    if (!k) throw new Error('clientId must be a non-empty string');
    return k;
  }

  /** Read the balance row, or null if the client has never been seen. */
  private async read(
    clientId: string,
  ): Promise<(BalanceEntity & { etag: string }) | null> {
    try {
      return await this.table.getEntity<BalanceEntity>(clientId, BALANCE_ROW_KEY);
    } catch (err) {
      if (statusOf(err) === 404) return null;
      throw err;
    }
  }

  /**
   * Ensure a balance row exists, seeding it with the free-tier grant. Returns
   * the row. Tolerates a concurrent creator (409) by re-reading.
   */
  private async ensureRow(
    clientId: string,
  ): Promise<BalanceEntity & { etag: string }> {
    const existing = await this.read(clientId);
    if (existing) return existing;
    const now = new Date().toISOString();
    try {
      await this.table.createEntity<BalanceEntity>({
        partitionKey: clientId,
        rowKey: BALANCE_ROW_KEY,
        credits: this.freeCredits,
        firstSeenAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (statusOf(err) !== 409) throw err;
      // lost the create race; fall through to a re-read
    }
    const row = await this.read(clientId);
    if (!row) {
      throw new Error(`credit row for ${clientId} vanished after create`);
    }
    return row;
  }

  async check(clientId: string): Promise<number> {
    const id = this.key(clientId);
    const row = await this.ensureRow(id);
    return row.credits;
  }

  /**
   * Atomic read-modify-write under ETag optimistic concurrency. `mutate`
   * receives the current entity and returns the patch to apply (or throws to
   * abort, e.g. InsufficientCreditsError). Retries on 412 (concurrent writer).
   */
  private async mutate(
    clientId: string,
    mutate: (row: BalanceEntity & { etag: string }) => Partial<BalanceEntity>,
  ): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const row = await this.ensureRow(clientId);
      const patch = mutate(row);
      try {
        await this.table.updateEntity<BalanceEntity>(
          {
            partitionKey: clientId,
            rowKey: BALANCE_ROW_KEY,
            credits: row.credits,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
          'Merge',
          { etag: row.etag },
        );
        return;
      } catch (err) {
        if (statusOf(err) === 412) continue; // contended; re-read and retry
        throw err;
      }
    }
    throw new Error(
      `credit update for ${clientId} failed after ${this.maxRetries} retries (contention)`,
    );
  }

  async decrement(clientId: string, n: number): Promise<void> {
    const id = this.key(clientId);
    await this.mutate(id, (row) => {
      if (row.credits < n) throw new InsufficientCreditsError();
      return { credits: row.credits - n };
    });
  }

  async grant(clientId: string, n: number, email?: string): Promise<void> {
    const id = this.key(clientId);
    await this.mutate(id, (row) => {
      const patch: Partial<BalanceEntity> = { credits: row.credits + n };
      if (email) patch.email = email;
      return patch;
    });
  }
}

// ----------------------------------------------------------------------------
// Event-dedupe store (webhook idempotency)
// ----------------------------------------------------------------------------

/**
 * Records processed Stripe event ids so a redelivered/duplicate webhook grants
 * credits only once. Atomic: the insert itself is the lock — a 409 means the id
 * was already recorded by an earlier (or concurrent) delivery.
 */
export interface EventDedupeStore {
  /** Returns true if `eventId` was newly recorded (caller should proceed),
   *  false if it had already been processed. */
  markIfNew(eventId: string): Promise<boolean>;
}

export class TableStorageEventDedupeStore implements EventDedupeStore {
  constructor(private readonly table: TableClient) {}

  async markIfNew(eventId: string): Promise<boolean> {
    try {
      await this.table.createEntity({
        partitionKey: EVENT_PARTITION_KEY,
        rowKey: eventId,
        processedAt: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      if (statusOf(err) === 409) return false; // already processed
      throw err;
    }
  }
}

/** In-memory dedupe for local dev / tests. */
export class InMemoryEventDedupeStore implements EventDedupeStore {
  private readonly seen = new Set<string>();
  async markIfNew(eventId: string): Promise<boolean> {
    if (this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    return true;
  }
}

// ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------

let cachedStore: CreditGate | null = null;
let cachedDedupe: EventDedupeStore | null = null;

function connectionString(): string | undefined {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  return cs && cs.trim() ? cs.trim() : undefined;
}

/**
 * Returns the production Table Storage gate when a connection string is set,
 * otherwise the in-memory stub. Ensures the table exists on first use.
 */
export async function getCreditStore(): Promise<CreditGate> {
  if (cachedStore) return cachedStore;
  const cs = connectionString();
  if (!cs) {
    cachedStore = inMemoryCreditStore;
    return cachedStore;
  }
  const table = TableClient.fromConnectionString(cs, CREDITS_TABLE_NAME, {
    allowInsecureConnection: cs.includes('UseDevelopmentStorage'),
  });
  await table.createTable().catch((err: unknown) => {
    if (statusOf(err) !== 409) throw err; // 409 => table already exists
  });
  cachedStore = new TableStorageCreditStore(table);
  return cachedStore;
}

/** Returns the event-dedupe store matching the active credit store backend. */
export async function getEventDedupeStore(): Promise<EventDedupeStore> {
  if (cachedDedupe) return cachedDedupe;
  const cs = connectionString();
  if (!cs) {
    cachedDedupe = new InMemoryEventDedupeStore();
    return cachedDedupe;
  }
  const table = TableClient.fromConnectionString(cs, EVENTS_TABLE_NAME, {
    allowInsecureConnection: cs.includes('UseDevelopmentStorage'),
  });
  await table.createTable().catch((err: unknown) => {
    if (statusOf(err) !== 409) throw err;
  });
  cachedDedupe = new TableStorageEventDedupeStore(table);
  return cachedDedupe;
}

/** Test helper: drop the cached singletons so env changes take effect. */
export function __resetCreditStoreCache(): void {
  cachedStore = null;
  cachedDedupe = null;
}
