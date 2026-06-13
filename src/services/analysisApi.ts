// ============================================================================
// Analysis API client (browser side) — STUB
// ----------------------------------------------------------------------------
// Typed wrappers around the backend analysis endpoints. The browser NEVER talks
// to an LLM provider directly anymore; it calls our own /api/* functions, which
// hold the secret key and enforce credit gating.
//
// L0 ships throwing stubs so downstream lanes can import a stable surface.
// The endpoint/wiring lane replaces the bodies with real `fetch` calls.
// ============================================================================

import type {
  AnalyzeResponse,
  AskResponse,
  OcrResponse,
  ContractAnalysis,
} from '../lib/api-types';

// Re-exported so existing consumers (App.tsx) get the type from one place.
export type { ContractAnalysis } from '../lib/api-types';

const NOT_IMPLEMENTED = 'analysisApi: not implemented (L0 stub)';

/** Analyze a contract. Returns the structured analysis. */
export async function analyzeContract(_text: string): Promise<ContractAnalysis> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Ask a follow-up question about a contract. Returns the plain-text answer. */
export async function askContractQuestion(
  _text: string,
  _question: string,
  _context: string[],
): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Extract raw text from a document image (data URI). */
export async function extractTextFromImage(_dataUri: string): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}

// Lower-level variants returning the full envelope (incl. creditsRemaining)
// are provided for the wiring lane to surface balance updates in the UI.
export async function analyzeContractFull(_text: string): Promise<AnalyzeResponse> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function askContractQuestionFull(
  _text: string,
  _question: string,
  _context: string[],
): Promise<AskResponse> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function extractTextFromImageFull(_dataUri: string): Promise<OcrResponse> {
  throw new Error(NOT_IMPLEMENTED);
}
