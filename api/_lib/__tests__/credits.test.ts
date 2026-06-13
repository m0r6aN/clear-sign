import { describe, it, expect } from 'vitest';
import { readCredits, CreditsValidationError } from '../../credits/credits';
import { InMemoryCreditStore } from '../creditStore';
import { FREE_CREDITS } from '../contracts';

describe('readCredits', () => {
  it('returns the free-tier balance for an unseen client', async () => {
    const gate = new InMemoryCreditStore();
    const res = await readCredits('new-client', gate);
    expect(res).toEqual({ credits: FREE_CREDITS });
  });

  it('reflects the current balance after spend', async () => {
    const gate = new InMemoryCreditStore(5);
    await gate.decrement('c1', 2);
    expect(await readCredits('c1', gate)).toEqual({ credits: 3 });
  });

  it('rejects an empty clientId', async () => {
    const gate = new InMemoryCreditStore();
    await expect(readCredits('  ', gate)).rejects.toBeInstanceOf(
      CreditsValidationError,
    );
  });
});
