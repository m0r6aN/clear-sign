// ============================================================================
// readCredits — pure balance-read logic for GET /api/credits
// ----------------------------------------------------------------------------
// Returns the current credit balance for an anonymous clientId. Reading is
// side-effect-light: the gate seeds the free-tier grant on first sight, so a
// brand-new client sees FREE_CREDITS here.
// ============================================================================

import type { CreditGate } from '../_lib/contracts';
import type { CreditsResponse } from '../../src/lib/api-types';

/** Thrown on invalid input; the handler maps this to HTTP 400. */
export class CreditsValidationError extends Error {
  readonly code = 'invalid_request' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CreditsValidationError';
  }
}

export async function readCredits(
  clientId: string,
  gate: CreditGate,
): Promise<CreditsResponse> {
  const id = (clientId ?? '').trim();
  if (!id) {
    throw new CreditsValidationError('clientId is required');
  }
  const credits = await gate.check(id);
  return { credits };
}
