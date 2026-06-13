// ============================================================================
// Backend contracts (Azure Functions side)
// ----------------------------------------------------------------------------
// Interfaces shared across api/* handlers: the credit ledger abstraction and
// the handler signatures every endpoint lane implements against.
//
// Owned by lane L0 (foundation). Downstream endpoint lanes implement these;
// they must not edit this file.
// ============================================================================

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AskRequest,
  AskResponse,
  OcrRequest,
  OcrResponse,
  CreditsRequest,
  CreditsResponse,
  CheckoutRequest,
  CheckoutResponse,
} from '../../src/lib/api-types';

// ----------------------------------------------------------------------------
// Credit ledger
// ----------------------------------------------------------------------------

/**
 * The credit ledger seam. Every metered endpoint checks a balance before doing
 * work and decrements after a successful upstream call.
 *
 * Implementations:
 *   - api/_lib/creditStore.ts   in-memory stub (L0; tests / local dev)
 *   - (later) a Table Storage-backed gate for production
 */
export interface CreditGate {
  /** Returns the current credit balance for the given email (0 if unknown). */
  check(email: string): Promise<number>;
  /**
   * Atomically subtracts `n` credits from the email's balance.
   * Implementations should clamp at zero and must not go negative.
   */
  decrement(email: string, n: number): Promise<void>;
}

/** Thrown by a CreditGate / handler when the caller lacks enough credits. */
export class InsufficientCreditsError extends Error {
  readonly code = 'insufficient_credits' as const;
  constructor(message = 'Insufficient credits') {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

// ----------------------------------------------------------------------------
// Handler contracts
// ----------------------------------------------------------------------------
//
// Endpoint lanes implement a function matching the relevant signature. These
// are the pure request -> response contracts; the HTTP plumbing (reading the
// body, writing status codes) is the endpoint lane's responsibility, but the
// validated input and the success payload must conform to these types.

export type AnalyzeHandler = (req: AnalyzeRequest, gate: CreditGate) => Promise<AnalyzeResponse>;
export type AskHandler = (req: AskRequest, gate: CreditGate) => Promise<AskResponse>;
export type OcrHandler = (req: OcrRequest, gate: CreditGate) => Promise<OcrResponse>;
export type CreditsHandler = (req: CreditsRequest, gate: CreditGate) => Promise<CreditsResponse>;
export type CheckoutHandler = (req: CheckoutRequest) => Promise<CheckoutResponse>;

/** Credit cost per metered operation. Single source for pricing the work. */
export const CREDIT_COST = {
  analyze: 1,
  ask: 1,
  ocr: 1,
} as const;

export type MeteredOperation = keyof typeof CREDIT_COST;
