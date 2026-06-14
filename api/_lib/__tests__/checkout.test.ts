import { describe, it, expect, vi } from 'vitest';
import { createCheckoutSession, CheckoutValidationError } from '../../checkout/checkout';
import { PACKS, getPack } from '../../checkout/packs';
import { FixedWindowRateLimiter } from '../../checkout/rateLimit';
import type { CheckoutRequest } from '../../../src/lib/api-types';

function validReq(over: Partial<CheckoutRequest> = {}): CheckoutRequest {
  return {
    clientId: 'client-1',
    packId: 'triple',
    email: 'buyer@example.com',
    successUrl: 'https://app.example/success',
    cancelUrl: 'https://app.example/cancel',
    ...over,
  };
}

function fakeStripe() {
  const create = vi.fn(async (_params: unknown) => ({
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/c/pay/cs_test_123',
  }));
  return { checkout: { sessions: { create } } };
}

describe('packs', () => {
  it('prices the three packs as $7/1, $15/3, $29/10', () => {
    expect(getPack('single')).toMatchObject({ credits: 1, amountCents: 700 });
    expect(getPack('triple')).toMatchObject({ credits: 3, amountCents: 1500 });
    expect(getPack('ten')).toMatchObject({ credits: 10, amountCents: 2900 });
  });

  it('returns undefined for an unknown pack', () => {
    expect(getPack('nope')).toBeUndefined();
  });
});

describe('createCheckoutSession', () => {
  it('creates a one-time payment session for the requested pack', async () => {
    const stripe = fakeStripe();
    const res = await createCheckoutSession(validReq(), stripe);
    expect(res).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      sessionId: 'cs_test_123',
    });
    const params = stripe.checkout.sessions.create.mock.calls[0][0] as any;
    expect(params.mode).toBe('payment');
    expect(params.success_url).toBe('https://app.example/success');
    expect(params.cancel_url).toBe('https://app.example/cancel');
    const item = params.line_items[0];
    expect(item.quantity).toBe(1);
    expect(item.price_data.currency).toBe('usd');
    expect(item.price_data.unit_amount).toBe(PACKS.triple.amountCents);
  });

  it('puts clientId, packId and email in session metadata so the webhook can credit the buyer', async () => {
    const stripe = fakeStripe();
    await createCheckoutSession(validReq(), stripe);
    const params = stripe.checkout.sessions.create.mock.calls[0][0] as any;
    expect(params.metadata.clientId).toBe('client-1');
    expect(params.metadata.packId).toBe('triple');
    expect(params.customer_email).toBe('buyer@example.com');
  });

  it('rejects an unknown packId without calling Stripe', async () => {
    const stripe = fakeStripe();
    await expect(
      createCheckoutSession(validReq({ packId: 'mystery' }), stripe),
    ).rejects.toBeInstanceOf(CheckoutValidationError);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a missing clientId', async () => {
    const stripe = fakeStripe();
    await expect(
      createCheckoutSession(validReq({ clientId: '   ' }), stripe),
    ).rejects.toBeInstanceOf(CheckoutValidationError);
  });

  it('rejects a malformed email', async () => {
    const stripe = fakeStripe();
    await expect(
      createCheckoutSession(validReq({ email: 'not-an-email' }), stripe),
    ).rejects.toBeInstanceOf(CheckoutValidationError);
  });

  it('rejects a non-http(s) successUrl (open-redirect guard)', async () => {
    const stripe = fakeStripe();
    await expect(
      createCheckoutSession(validReq({ successUrl: 'javascript:alert(1)' }), stripe),
    ).rejects.toBeInstanceOf(CheckoutValidationError);
  });
});

describe('FixedWindowRateLimiter', () => {
  it('allows up to the limit then blocks within a window', () => {
    let t = 1_000_000;
    const rl = new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(rl.allow('1.2.3.4')).toBe(true);
    expect(rl.allow('1.2.3.4')).toBe(true);
    expect(rl.allow('1.2.3.4')).toBe(true);
    expect(rl.allow('1.2.3.4')).toBe(false);
  });

  it('tracks distinct keys independently', () => {
    let t = 1_000_000;
    const rl = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, now: () => t });
    expect(rl.allow('a')).toBe(true);
    expect(rl.allow('b')).toBe(true);
    expect(rl.allow('a')).toBe(false);
  });

  it('resets after the window elapses', () => {
    let t = 1_000_000;
    const rl = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, now: () => t });
    expect(rl.allow('a')).toBe(true);
    expect(rl.allow('a')).toBe(false);
    t += 60_001;
    expect(rl.allow('a')).toBe(true);
  });
});
