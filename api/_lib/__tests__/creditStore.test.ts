import { describe, it, expect } from 'vitest';
import { FakeTableClient } from './fakeTable';
import {
  TableStorageCreditStore,
  TableStorageEventDedupeStore,
  BALANCE_ROW_KEY,
} from '../creditStore';
import { InsufficientCreditsError, FREE_CREDITS } from '../contracts';

const CLIENT = 'client-abc';

function makeStore(opts?: { freeCredits?: number; maxRetries?: number }) {
  const table = new FakeTableClient();
  const store = new TableStorageCreditStore(table.asTableClient(), opts);
  return { table, store };
}

describe('TableStorageCreditStore.check', () => {
  it('grants FREE_CREDITS on first sight and persists the row', async () => {
    const { table, store } = makeStore();
    const balance = await store.check(CLIENT);
    expect(balance).toBe(FREE_CREDITS);
    expect(table.peekCredits(CLIENT, BALANCE_ROW_KEY)).toBe(FREE_CREDITS);
  });

  it('returns the existing balance on subsequent sight (no re-grant)', async () => {
    const { store } = makeStore();
    await store.check(CLIENT);
    await store.decrement(CLIENT, 1);
    const balance = await store.check(CLIENT);
    expect(balance).toBe(FREE_CREDITS - 1);
  });
});

describe('TableStorageCreditStore.decrement', () => {
  it('subtracts credits on a sufficient balance', async () => {
    const { table, store } = makeStore({ freeCredits: 5 });
    await store.decrement(CLIENT, 2);
    expect(table.peekCredits(CLIENT, BALANCE_ROW_KEY)).toBe(3);
  });

  it('throws InsufficientCreditsError and leaves the balance unchanged', async () => {
    const { table, store } = makeStore({ freeCredits: 1 });
    await store.check(CLIENT);
    await expect(store.decrement(CLIENT, 2)).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
    expect(table.peekCredits(CLIENT, BALANCE_ROW_KEY)).toBe(1);
  });

  it('never goes negative under concurrent decrements (no lost updates)', async () => {
    const { table, store } = makeStore({ freeCredits: 5 });
    await store.check(CLIENT);
    // 5 concurrent single-credit decrements against a balance of 5.
    await Promise.all(
      Array.from({ length: 5 }, () => store.decrement(CLIENT, 1)),
    );
    expect(table.peekCredits(CLIENT, BALANCE_ROW_KEY)).toBe(0);
    // The optimistic-concurrency path must have actually fired at least once,
    // otherwise the test isn't proving anything about lost updates.
    expect(table.conflicts).toBeGreaterThan(0);
    // A further decrement must now fail rather than go negative.
    await expect(store.decrement(CLIENT, 1)).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
  });

  it('grants exactly the right total under concurrent decrement + grant', async () => {
    const { table, store } = makeStore({ freeCredits: 10 });
    await store.check(CLIENT);
    await Promise.all([
      store.decrement(CLIENT, 3),
      store.grant(CLIENT, 5),
      store.decrement(CLIENT, 2),
    ]);
    // 10 - 3 + 5 - 2 = 10
    expect(table.peekCredits(CLIENT, BALANCE_ROW_KEY)).toBe(10);
  });
});

describe('TableStorageCreditStore.grant', () => {
  it('creates the row and grants credits for an unseen client', async () => {
    const { table, store } = makeStore();
    await store.grant(CLIENT, 10);
    // First sight grants FREE_CREDITS, then the purchase adds 10.
    expect(table.peekCredits(CLIENT, BALANCE_ROW_KEY)).toBe(FREE_CREDITS + 10);
  });

  it('stores the buyer email as an attribute on the client record', async () => {
    const { table, store } = makeStore();
    await store.grant(CLIENT, 3, 'buyer@example.com');
    expect(table.peek(CLIENT, BALANCE_ROW_KEY)?.email).toBe('buyer@example.com');
  });
});

describe('TableStorageEventDedupeStore', () => {
  it('returns true the first time an event id is seen, false thereafter', async () => {
    const table = new FakeTableClient();
    const dedupe = new TableStorageEventDedupeStore(table.asTableClient());
    expect(await dedupe.markIfNew('evt_1')).toBe(true);
    expect(await dedupe.markIfNew('evt_1')).toBe(false);
    expect(await dedupe.markIfNew('evt_2')).toBe(true);
  });

  it('records only the first of concurrent duplicate marks', async () => {
    const table = new FakeTableClient();
    const dedupe = new TableStorageEventDedupeStore(table.asTableClient());
    const results = await Promise.all([
      dedupe.markIfNew('evt_dup'),
      dedupe.markIfNew('evt_dup'),
      dedupe.markIfNew('evt_dup'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
