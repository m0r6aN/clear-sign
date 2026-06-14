// ============================================================================
// Analyze prompt + schema (mirror of the production analyze contract)
// ----------------------------------------------------------------------------
// This MUST stay faithful to what api/_lib/anthropic.ts will send in production
// so the eval measures the real task. It reproduces:
//   - the system instruction from the original prototype (geminiService.ts)
//   - the user prompt shape
//   - the ContractAnalysis JSON schema (src/lib/api-types.ts)
//
// Lane A owns the production prompt; this is the eval's copy. If Lane A's prompt
// diverges, update this file and re-run. ADVISORY lane — we never import from
// api/_lib/anthropic.ts (it may not exist yet and is not ours to touch).
// ============================================================================

/** System instruction — verbatim from the prototype's analyze call. */
export const ANALYZE_SYSTEM =
  'You are an expert legal AI assistant. Your job is to translate dense legal ' +
  'text into plain English, highlight obligations, and flag potential risks for ' +
  'the user.';

/** User prompt builder — same shape as the prototype. */
export function analyzeUserPrompt(contractText: string): string {
  return `Analyze the following legal contract and extract the key details.\n\nContract Text:\n${contractText}`;
}

/**
 * JSON schema for structured outputs (output_config.format).
 * Matches ContractAnalysis in src/lib/api-types.ts. All objects carry
 * additionalProperties:false as required by the structured-outputs feature.
 */
export const ANALYZE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Plain English summary of the contract' },
    redFlags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          lineReference: { type: 'string' },
        },
        required: ['description', 'severity'],
      },
    },
    obligations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          party: { type: 'string' },
        },
        required: ['description', 'party'],
      },
    },
  },
  required: ['summary', 'redFlags', 'obligations'],
} as const;
