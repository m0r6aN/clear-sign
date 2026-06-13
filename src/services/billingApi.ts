// ============================================================================
// Billing API client (browser side) — STUB
// ----------------------------------------------------------------------------
// Typed wrappers around the credit + checkout endpoints. L0 ships throwing
// stubs; the billing lane replaces the bodies with real `fetch` calls.
// ============================================================================

import type {
  CreditsResponse,
  CheckoutResponse,
  CreditPackId,
} from '../lib/api-types';

const NOT_IMPLEMENTED = 'billingApi: not implemented (L0 stub)';

/** Read the caller's current credit balance. */
export async function getCredits(): Promise<CreditsResponse> {
  throw new Error(NOT_IMPLEMENTED);
}

/**
 * Start a Stripe Checkout session for a credit pack.
 * `email` is collected at the paywall (first time we ask) for the receipt +
 * lead capture; the clientId is attached internally so purchased credits land
 * on the same balance as the free tier. Returns the hosted Checkout URL the
 * client should redirect to.
 */
export async function createCheckoutSession(
  _packId: CreditPackId,
  _email: string,
): Promise<CheckoutResponse> {
  throw new Error(NOT_IMPLEMENTED);
}
