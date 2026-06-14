// ============================================================================
// POST /api/checkout — Azure Functions v4 HTTP wrapper
// ----------------------------------------------------------------------------
// Thin adapter: IP rate-limit -> parse body -> createCheckoutSession (pure,
// tested) -> HTTP response. No credit logic lives here.
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Stripe from 'stripe';
import { createCheckoutSession, CheckoutValidationError } from './checkout';
import { checkoutRateLimiter } from './rateLimit';
import type { ApiError, CheckoutRequest } from '../../src/lib/api-types';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-08-27.basil';

function clientIp(req: HttpRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-azure-clientip') ?? 'unknown';
}

function fail(status: number, error: string, code?: ApiError['code']): HttpResponseInit {
  return { status, jsonBody: { error, ...(code ? { code } : {}) } satisfies ApiError };
}

export async function checkout(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  if (!checkoutRateLimiter.allow(clientIp(req))) {
    return fail(429, 'Too many checkout attempts. Please try again shortly.');
  }

  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return fail(400, 'Request body must be valid JSON', 'invalid_request');
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    ctx.error('STRIPE_SECRET_KEY is not configured');
    return fail(500, 'Payments are not configured', 'internal_error');
  }

  const stripe = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });
  try {
    const result = await createCheckoutSession(body, stripe);
    return { status: 200, jsonBody: result };
  } catch (e) {
    if (e instanceof CheckoutValidationError) {
      return fail(400, e.message, 'invalid_request');
    }
    ctx.error('checkout session creation failed', e);
    return fail(502, 'Failed to create checkout session', 'upstream_error');
  }
}

app.http('checkout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'checkout',
  handler: checkout,
});
