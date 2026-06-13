// ============================================================================
// POST /api/analyze — full contract analysis (the paid operation)
// ----------------------------------------------------------------------------
// Flow: validate -> IP rate-limit -> credit gate.check (402 if none) ->
// Claude analysis -> gate.decrement -> return analysis + creditsRemaining.
//
// Owned by lane A (LLM proxy).
// ============================================================================

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import type { AnalyzeResponse } from '../../src/lib/api-types';
import { CREDIT_COST } from '../_lib/contracts';
import { analyzeContract, MissingApiKeyError, UpstreamError } from '../_lib/anthropic';
import { rateLimit } from '../_lib/ratelimit';
import {
  BadRequest,
  clientIp,
  errorResponse,
  getCreditGate,
  jsonResponse,
  readJsonBody,
  requireClientId,
  requireString,
} from '../_lib/http';

const MAX_TEXT_CHARS = 100_000;

export async function analyze(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await readJsonBody(req);
    const clientId = requireClientId(body);
    const text = requireString(body, 'text', MAX_TEXT_CHARS);

    const limit = rateLimit('analyze', clientIp(req));
    if (!limit.allowed) {
      return errorResponse(429, 'invalid_request', 'Too many requests. Please slow down.', {
        'Retry-After': String(limit.retryAfter),
      });
    }

    const gate = getCreditGate();
    const balance = await gate.check(clientId);
    if (balance < CREDIT_COST.analyze) {
      return errorResponse(402, 'insufficient_credits', 'You are out of credits.');
    }

    const analysis = await analyzeContract(text);

    // Only decrement after a successful upstream call.
    await gate.decrement(clientId, CREDIT_COST.analyze);
    const creditsRemaining = await gate.check(clientId);

    const response: AnalyzeResponse = { analysis, creditsRemaining };
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
    ctx.error('analyze: missing ANTHROPIC_API_KEY');
    return errorResponse(500, 'internal_error', 'The service is not configured correctly.');
  }
  if (err instanceof UpstreamError) {
    ctx.warn(`analyze: upstream error: ${err.message}`);
    return errorResponse(502, 'upstream_error', err.message);
  }
  ctx.error(`analyze: unexpected error: ${String(err)}`);
  return errorResponse(500, 'internal_error', 'Something went wrong.');
}

app.http('analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'analyze',
  handler: analyze,
});
