// ============================================================================
// POST /api/stripe-webhook — Azure Functions v4 HTTP wrapper
// ----------------------------------------------------------------------------
// Reads the RAW request body (required for signature verification — never parse
// it before constructEvent), wires up the production gate + event-dedupe store,
// and delegates all decisions to handleStripeEvent (pure, tested).
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Stripe from 'stripe';
import { handleStripeEvent } from './webhook';
import { getCreditStore, getEventDedupeStore } from '../_lib/creditStore';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-08-27.basil';

export async function stripeWebhook(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !apiKey) {
    ctx.error('Stripe webhook is not configured (missing secret(s))');
    return { status: 500, jsonBody: { error: 'Webhook not configured', code: 'internal_error' } };
  }

  const stripe = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') ?? undefined;

  const gate = await getCreditStore();
  const dedupe = await getEventDedupeStore();

  try {
    const result = await handleStripeEvent({
      rawBody,
      signature,
      secret: webhookSecret,
      stripe,
      gate,
      dedupe,
    });
    return { status: result.status, jsonBody: result.body };
  } catch (e) {
    // A failure here (e.g. storage hiccup AFTER signature verification) should
    // return 5xx so Stripe retries — dedupe keeps the retry idempotent.
    ctx.error('stripe webhook processing failed', e);
    return { status: 500, jsonBody: { error: 'Webhook processing failed', code: 'internal_error' } };
  }
}

app.http('stripe-webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'stripe-webhook',
  handler: stripeWebhook,
});
