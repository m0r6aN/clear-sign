// ============================================================================
// ClearSign shared API contract
// ----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for request/response shapes exchanged between the
// browser client (src/services/*) and the backend functions (api/*).
//
// Both sides import from here. Do not redefine these shapes elsewhere.
// Owned by lane L0 (foundation). Downstream lanes consume; they must not edit.
// ============================================================================

// ----------------------------------------------------------------------------
// Domain model
// ----------------------------------------------------------------------------

export type Severity = 'high' | 'medium' | 'low';

export interface RedFlag {
  description: string;
  severity: Severity;
  /** Optional pointer back into the source text (e.g. clause/line). */
  lineReference?: string;
}

export interface Obligation {
  description: string;
  /** Which party carries the obligation. */
  party: string;
}

/** Result of a full contract analysis. */
export interface ContractAnalysis {
  summary: string;
  redFlags: RedFlag[];
  obligations: Obligation[];
}

// ----------------------------------------------------------------------------
// Common envelope
// ----------------------------------------------------------------------------

/**
 * Caller identity used for credit accounting. The anonymous `clientId` is the
 * credit-ledger key (see CreditGate in api/_lib/contracts.ts) — generated and
 * persisted client-side (see src/services/identity.ts) and present on every
 * request. This enables a zero-friction free tier: no email needed to try the
 * product. Email is collected only at checkout (see CheckoutRequest) for the
 * Stripe receipt + lead capture, and is linked to the same clientId.
 */
export interface CallerIdentity {
  clientId: string;
}

/** Uniform error body returned by every endpoint on failure. */
export interface ApiError {
  error: string;
  /** Stable, machine-readable code for client branching. */
  code?: ApiErrorCode;
}

export type ApiErrorCode =
  | 'insufficient_credits'
  | 'invalid_request'
  | 'unauthorized'
  | 'upstream_error'
  | 'not_implemented'
  | 'internal_error';

// ----------------------------------------------------------------------------
// POST /api/analyze  — analyze a contract
// ----------------------------------------------------------------------------

export interface AnalyzeRequest extends CallerIdentity {
  text: string;
}

export interface AnalyzeResponse {
  analysis: ContractAnalysis;
  /** Credits remaining after this call was charged. */
  creditsRemaining: number;
}

// ----------------------------------------------------------------------------
// POST /api/ask  — ask a follow-up question about a contract
// ----------------------------------------------------------------------------

export interface AskRequest extends CallerIdentity {
  text: string;
  question: string;
  /** Selected red flags / obligations supplied as additional context. */
  context: string[];
}

export interface AskResponse {
  answer: string;
  creditsRemaining: number;
}

// ----------------------------------------------------------------------------
// POST /api/ocr  — extract text from a document image
// ----------------------------------------------------------------------------

export interface OcrRequest extends CallerIdentity {
  /** Data URI: `data:<mime>;base64,<data>`. */
  dataUri: string;
}

export interface OcrResponse {
  text: string;
  creditsRemaining: number;
}

// ----------------------------------------------------------------------------
// GET /api/credits  — read the current credit balance
// ----------------------------------------------------------------------------

export interface CreditsRequest extends CallerIdentity {}

export interface CreditsResponse {
  credits: number;
}

// ----------------------------------------------------------------------------
// POST /api/checkout  — start a Stripe Checkout session for a credit pack
// ----------------------------------------------------------------------------

/** Identifier for a purchasable credit pack (resolved to a Stripe price). */
export type CreditPackId = string;

export interface CheckoutRequest extends CallerIdentity {
  packId: CreditPackId;
  /**
   * Buyer email — collected at checkout (the first point we ask for it).
   * Used for the Stripe receipt and lead capture; purchased credits are still
   * granted to the request's clientId so the free→paid balance is continuous.
   */
  email: string;
  /** Where Stripe should redirect on success. */
  successUrl: string;
  /** Where Stripe should redirect if the user cancels. */
  cancelUrl: string;
}

export interface CheckoutResponse {
  /** Stripe-hosted Checkout URL the client should redirect to. */
  url: string;
  sessionId: string;
}
