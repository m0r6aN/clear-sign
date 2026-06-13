// ============================================================================
// createCheckoutSession — pure checkout logic (Stripe injected for testability)
// ----------------------------------------------------------------------------
// Validates the request, then asks Stripe to create a one-time-payment Checkout
// Session for the chosen credit pack. The clientId/packId/email ride along in
// session metadata so the webhook (the source of truth for granting credits)
// can credit the right anonymous client after payment completes.
//
// Money path: this function never grants credits. It only starts the purchase.
// Credits are granted exclusively by the signature-verified webhook.
// ============================================================================

import type Stripe from 'stripe';
import type { CheckoutRequest, CheckoutResponse } from '../../src/lib/api-types';
import { getPack } from './packs';

/** Thrown on invalid checkout input; the handler maps this to HTTP 400. */
export class CheckoutValidationError extends Error {
  readonly code = 'invalid_request' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutValidationError';
  }
}

/**
 * Structural slice of the Stripe client this module needs. The real
 * `Stripe` instance satisfies it; tests pass a mock.
 */
export interface StripeCheckoutCreator {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
      ): Promise<{ id: string; url: string | null }>;
    };
  };
}

// Conservative email shape check — Stripe re-validates, this just rejects junk.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireHttpUrl(value: string, field: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CheckoutValidationError(`${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new CheckoutValidationError(`${field} must be an http(s) URL`);
  }
}

export async function createCheckoutSession(
  req: CheckoutRequest,
  stripe: StripeCheckoutCreator,
): Promise<CheckoutResponse> {
  const clientId = (req.clientId ?? '').trim();
  if (!clientId) {
    throw new CheckoutValidationError('clientId is required');
  }

  const email = (req.email ?? '').trim();
  if (!EMAIL_RE.test(email)) {
    throw new CheckoutValidationError('a valid email is required');
  }

  const pack = getPack(req.packId);
  if (!pack) {
    throw new CheckoutValidationError(`unknown packId: ${req.packId}`);
  }

  if (!req.successUrl || !req.cancelUrl) {
    throw new CheckoutValidationError('successUrl and cancelUrl are required');
  }
  requireHttpUrl(req.successUrl, 'successUrl');
  requireHttpUrl(req.cancelUrl, 'cancelUrl');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pack.amountCents,
          product_data: { name: pack.label },
        },
      },
    ],
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    // Read back verbatim by the webhook. clientId is the credit-ledger key;
    // packId lets the webhook re-derive the grant amount from a trusted map.
    metadata: {
      clientId,
      packId: pack.id,
      credits: String(pack.credits),
      email,
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout URL');
  }

  return { url: session.url, sessionId: session.id };
}
