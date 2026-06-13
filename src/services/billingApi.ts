// ============================================================================
// Billing API client (browser side)
// ============================================================================

import type { CreditsResponse, CheckoutResponse, CreditPackId } from '../lib/api-types';
import { getClientId } from './identity';
import { ApiRequestError } from './analysisApi';

export async function getCredits(): Promise<CreditsResponse> {
  const params = new URLSearchParams({ clientId: getClientId() });
  const res = await fetch(`/api/credits?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiRequestError(err.code, err.error);
  }
  return res.json() as Promise<CreditsResponse>;
}

export async function createCheckoutSession(
  packId: CreditPackId,
  email: string,
): Promise<CheckoutResponse> {
  const base = window.location.origin + window.location.pathname;
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: getClientId(),
      packId,
      email,
      successUrl: `${base}?payment=success`,
      cancelUrl: `${base}?payment=cancelled`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiRequestError(err.code, err.error);
  }
  return res.json() as Promise<CheckoutResponse>;
}
