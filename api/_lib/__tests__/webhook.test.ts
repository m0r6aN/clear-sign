import { describe, it, expect, vi } from 'vitest';
import { handleStripeEvent } from '../../stripe-webhook/webhook';
import { InMemoryEventDedupeStore } from '../creditStore';

const SECRET = 'whsec_test';

/** A fake Stripe whose constructEvent succeeds (parsing the body) unless the
 *  signature is the literal 'bad', in which case it throws like the real SDK. */
function fakeStripe() {
  return {
    webhooks: {
      constructEvent: vi.fn((payload: string, sig: string, _secret: string) => {
        if (sig === 'bad') {
          throw new Error('No signatures found matching the expected signature');
        }
        return JSON.parse(payload);
      }),
    },
  };
}

function completedEvent(
  id: string,
  metadata: Record<string, string>,
  over: Record<string, unknown> = {},
) {
  return JSON.stringify({
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        metadata,
        ...over,
      },
    },
  });
}

function spyGate() {
  return { grant: vi.fn(async (_c: string, _n: number, _e?: string) => {}) };
}

describe('handleStripeEvent — signature verification', () => {
  it('rejects an invalid signature with 400 and never grants', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const dedupe = new InMemoryEventDedupeStore();
    const res = await handleStripeEvent({
      rawBody: completedEvent('evt_1', { clientId: 'c1', packId: 'single' }),
      signature: 'bad',
      secret: SECRET,
      stripe,
      gate,
      dedupe,
    });
    expect(res.status).toBe(400);
    expect(gate.grant).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header with 400', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const res = await handleStripeEvent({
      rawBody: completedEvent('evt_1', { clientId: 'c1', packId: 'single' }),
      signature: undefined,
      secret: SECRET,
      stripe,
      gate,
      dedupe: new InMemoryEventDedupeStore(),
    });
    expect(res.status).toBe(400);
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    expect(gate.grant).not.toHaveBeenCalled();
  });
});

describe('handleStripeEvent — granting', () => {
  it('grants the pack credits to the metadata clientId, with the email', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const res = await handleStripeEvent({
      rawBody: completedEvent('evt_2', {
        clientId: 'client-xyz',
        packId: 'ten',
        email: 'buyer@example.com',
      }),
      signature: 'good',
      secret: SECRET,
      stripe,
      gate,
      dedupe: new InMemoryEventDedupeStore(),
    });
    expect(res.status).toBe(200);
    expect(gate.grant).toHaveBeenCalledTimes(1);
    expect(gate.grant).toHaveBeenCalledWith('client-xyz', 10, 'buyer@example.com');
  });

  it('is idempotent: a duplicate event id grants only once', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const dedupe = new InMemoryEventDedupeStore();
    const raw = completedEvent('evt_dupe', { clientId: 'c1', packId: 'triple' });
    const args = { rawBody: raw, signature: 'good', secret: SECRET, stripe, gate, dedupe };
    const first = await handleStripeEvent(args);
    const second = await handleStripeEvent(args);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(gate.grant).toHaveBeenCalledTimes(1);
    expect(gate.grant).toHaveBeenCalledWith('c1', 3, undefined);
  });

  it('acks but does not grant when clientId metadata is missing', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const res = await handleStripeEvent({
      rawBody: completedEvent('evt_3', { packId: 'single' }),
      signature: 'good',
      secret: SECRET,
      stripe,
      gate,
      dedupe: new InMemoryEventDedupeStore(),
    });
    expect(res.status).toBe(200);
    expect(gate.grant).not.toHaveBeenCalled();
  });

  it('acks but does not grant for an unknown packId', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const res = await handleStripeEvent({
      rawBody: completedEvent('evt_4', { clientId: 'c1', packId: 'mystery' }),
      signature: 'good',
      secret: SECRET,
      stripe,
      gate,
      dedupe: new InMemoryEventDedupeStore(),
    });
    expect(res.status).toBe(200);
    expect(gate.grant).not.toHaveBeenCalled();
  });

  it('does not grant when the session is not paid', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const res = await handleStripeEvent({
      rawBody: completedEvent(
        'evt_5',
        { clientId: 'c1', packId: 'single' },
        { payment_status: 'unpaid' },
      ),
      signature: 'good',
      secret: SECRET,
      stripe,
      gate,
      dedupe: new InMemoryEventDedupeStore(),
    });
    expect(res.status).toBe(200);
    expect(gate.grant).not.toHaveBeenCalled();
  });

  it('ignores unrelated event types', async () => {
    const stripe = fakeStripe();
    const gate = spyGate();
    const raw = JSON.stringify({ id: 'evt_6', type: 'payment_intent.created', data: { object: {} } });
    const res = await handleStripeEvent({
      rawBody: raw,
      signature: 'good',
      secret: SECRET,
      stripe,
      gate,
      dedupe: new InMemoryEventDedupeStore(),
    });
    expect(res.status).toBe(200);
    expect(gate.grant).not.toHaveBeenCalled();
  });
});
