// ============================================================================
// Analysis API client (browser side)
// ============================================================================

import type {
  AnalyzeResponse,
  AskResponse,
  OcrResponse,
  ContractAnalysis,
  ApiError,
} from '../lib/api-types';
import { getClientId } from './identity';

// Re-exported so existing consumers (App.tsx) get the type from one place.
export type { ContractAnalysis } from '../lib/api-types';

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: getClientId(), ...body }),
  });
  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiRequestError(err.code, err.error);
  }
  return res.json() as Promise<T>;
}

export async function analyzeContractFull(text: string): Promise<AnalyzeResponse> {
  return post<AnalyzeResponse>('/api/analyze', { text });
}

export async function askContractQuestionFull(
  text: string,
  question: string,
  context: string[],
): Promise<AskResponse> {
  return post<AskResponse>('/api/ask', { text, question, context });
}

export async function extractTextFromImageFull(dataUri: string): Promise<OcrResponse> {
  return post<OcrResponse>('/api/ocr', { dataUri });
}

export async function analyzeContract(text: string): Promise<ContractAnalysis> {
  const r = await analyzeContractFull(text);
  return r.analysis;
}

export async function askContractQuestion(
  text: string,
  question: string,
  context: string[],
): Promise<string> {
  const r = await askContractQuestionFull(text, question, context);
  return r.answer;
}

export async function extractTextFromImage(dataUri: string): Promise<string> {
  const r = await extractTextFromImageFull(dataUri);
  return r.text;
}
