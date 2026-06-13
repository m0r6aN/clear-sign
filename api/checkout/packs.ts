// ============================================================================
// Credit packs — the single source of truth for what each pack costs and grants
// ----------------------------------------------------------------------------
// Both the checkout endpoint (to price the Stripe line item) and the webhook
// (to re-derive how many credits to grant from the purchased packId) read from
// here. The webhook deliberately re-derives credits from the packId rather than
// trusting a free-form amount in session metadata — the packId is the only
// thing it needs to trust, and it maps to a fixed, server-controlled grant.
// ============================================================================

import type { CreditPackId } from '../../src/lib/api-types';

export interface CreditPack {
  id: CreditPackId;
  /** Credits granted on purchase. */
  credits: number;
  /** Price in the smallest currency unit (USD cents). */
  amountCents: number;
  /** Human label shown on the Stripe Checkout line item. */
  label: string;
}

/** Beachhead pricing: $7/1, $15/3, $29/10. */
export const PACKS: Record<string, CreditPack> = {
  single: { id: 'single', credits: 1, amountCents: 700, label: 'ClearSign — 1 credit' },
  triple: { id: 'triple', credits: 3, amountCents: 1500, label: 'ClearSign — 3 credits' },
  ten: { id: 'ten', credits: 10, amountCents: 2900, label: 'ClearSign — 10 credits' },
};

/** Look up a pack by id, or undefined if the id is not a known pack. */
export function getPack(id: string): CreditPack | undefined {
  return Object.prototype.hasOwnProperty.call(PACKS, id) ? PACKS[id] : undefined;
}
