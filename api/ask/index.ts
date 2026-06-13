// ============================================================================
// POST /api/ask — grounded follow-up Q&A about a contract (free, gated by IP)
// ----------------------------------------------------------------------------
// Free per CREDIT_COST.ask (0): does NOT decrement credits, but still requires a
// valid clientId and is IP rate-limited to prevent free-LLM-proxy abuse. Returns
// the current balance unchanged as creditsRemaining.
//
// Owned by lane A (LLM proxy).
// ============================================================================

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import type { AskResponse } from '../../src/lib/api-types';
import { askQuestion, MissingApiKeyError, UpstreamError } from '../_lib/anthropic';
import { rateLimit } from '../_lib/ratelimit';
import {
  BadRequest,
  clientIp,
  errorResponse,
  getCreditGate,
  jsonResponse,
  optionalStringArray,
  readJsonBody,
  requireClientId,
  requireString,
} from '../_lib/http';

const MAX_TEXT_CHARS = 100_000;
const MAX_QUESTION_CHARS = 2_000;
const MAX_CONTEXT_ITEMS = 50;
const MAX_CONTEXT_ITEM_CHARS = 2_000;

export async function ask(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await readJsonBody(req);
    const clientId = requireClientId(body);
    const text = requireString(body, 'text', MAX_TEXT_CHARS);
    const question = requireString(body, 'question', MAX_QUESTION_CHARS);
    const context = optionalStringArray(body, 'context', MAX_CONTEXT_ITEMS, MAX_CONTEXT_ITEM_CHARS);

    const limit = rateLimit('ask', clientIp(req));
    if (!limit.allowed) {
      return errorResponse(429, 'invalid_request', 'Too many requests. Please slow down.', {
        'Retry-After': String(limit.retryAfter),
      });
    }

    const gate = getCreditGate();
    // ask is free — establish identity / balance but never decrement.
    const creditsRemaining = await gate.check(clientId);

    const answer = await askQuestion(text, question, context);

    const response: AskResponse = { answer, creditsRemaining };
    return jsonResponse(200, response);
  } catch (err) {
    return handleError(err, ctx);
  }
}

function handleError(err: unknown, ctx: InvocationContext): HttpResponseInit {
  if (err instanceof BadRequest) {
    return errorResponse(err.httpStatus, err.code, err.message);
  }
  if (err instanceof MissingApiKeyError) {
    ctx.error('ask: missing ANTHROPIC_API_KEY');
    return errorResponse(500, 'internal_error', 'The service is not configured correctly.');
  }
  if (err instanceof UpstreamError) {
    ctx.warn(`ask: upstream error: ${err.message}`);
    return errorResponse(502, 'upstream_error', err.message);
  }
  ctx.error(`ask: unexpected error: ${String(err)}`);
  return errorResponse(500, 'internal_error', 'Something went wrong.');
}

app.http('ask', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ask',
  handler: ask,
});
