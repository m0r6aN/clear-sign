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
 * Returns the hosted Checkout URL the client should redirect to.
 */
export async function createCheckoutSession(
  _packId: CreditPackId,
): Promise<CheckoutResponse> {
  throw new Error(NOT_IMPLEMENTED);
}
