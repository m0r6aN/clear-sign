// ============================================================================
// handleStripeEvent — pure webhook logic (Stripe/gate/dedupe injected)
// ----------------------------------------------------------------------------
// The ONLY place credits are granted. Discipline for a money endpoint:
//
//   1. Verify the Stripe signature against the RAW request body. No signature
//      or a bad signature => 400, and we never touch the ledger.
//   2. On checkout.session.completed for a PAID session, re-derive the grant
//      amount from the trusted packId map (not from any free-form metadata
//      amount), then grant to the metadata clientId.
//   3. Idempotency: dedupe by Stripe event id BEFORE granting, so a redelivered
//      or duplicated event grants credits at most once.
//
// Everything that isn't a grantable, paid, completed session is acknowledged
// with 200 (so Stripe stops retrying) but changes nothing.
// ============================================================================

import type Stripe from 'stripe';
import type { EventDedupeStore } from '../_lib/creditStore';
import { getPack } from '../checkout/packs';

/** Structural slice of the Stripe client used for signature verification. */
export interface StripeWebhookVerifier {
  webhooks: {
    constructEvent(
      payload: string | Buffer,
      signature: string,
      secret: string,
    ): Stripe.Event;
  };
}

/** The credit-granting capability the webhook needs (email is optional). */
export interface GrantingGate {
  grant(clientId: string, n: number, email?: string): Promise<void>;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

export interface HandleStripeEventArgs {
  rawBody: string;
  signature: string | undefined;
  secret: string;
  stripe: StripeWebhookVerifier;
  gate: GrantingGate;
  dedupe: EventDedupeStore;
}

export async function handleStripeEvent(
  args: HandleStripeEventArgs,
): Promise<WebhookResult> {
  const { rawBody, signature, secret, stripe, gate, dedupe } = args;

  if (!signature) {
    return { status: 400, body: { error: 'Missing stripe-signature header', code: 'unauthorized' } };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'signature verification failed';
    return { status: 400, body: { error: `Webhook signature verification failed: ${message}`, code: 'unauthorized' } };
  }

  if (event.type !== 'checkout.session.completed') {
    return { status: 200, body: { received: true, granted: false, reason: 'ignored_event_type' } };
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Only completed sessions that actually collected payment grant credits.
  if (session.payment_status !== 'paid') {
    return { status: 200, body: { received: true, granted: false, reason: 'not_paid' } };
  }

  const metadata = session.metadata ?? {};
  const clientId = (metadata.clientId ?? '').trim();
  const packId = (metadata.packId ?? '').trim();
  const email = (metadata.email ?? '').trim() || undefined;

  if (!clientId || !packId) {
    return { status: 200, body: { received: true, granted: false, reason: 'missing_metadata' } };
  }

  const pack = getPack(packId);
  if (!pack) {
    return { status: 200, body: { received: true, granted: false, reason: 'unknown_pack' } };
  }

  // Idempotency gate: only the first delivery of this event id proceeds.
  const isNew = await dedupe.markIfNew(event.id);
  if (!isNew) {
    return { status: 200, body: { received: true, granted: false, reason: 'duplicate_event' } };
  }

  await gate.grant(clientId, pack.credits, email);
  return {
    status: 200,
    body: { received: true, granted: true, clientId, credits: pack.credits },
  };
}
