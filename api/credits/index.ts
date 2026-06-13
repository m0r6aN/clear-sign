// ============================================================================
// GET /api/credits?clientId=... — Azure Functions v4 HTTP wrapper
// ----------------------------------------------------------------------------
// Returns the current credit balance for an anonymous clientId.
// ============================================================================

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readCredits, CreditsValidationError } from './credits';
import { getCreditStore } from '../_lib/creditStore';
import type { ApiError } from '../../src/lib/api-types';

function fail(status: number, error: string, code?: ApiError['code']): HttpResponseInit {
  return { status, jsonBody: { error, ...(code ? { code } : {}) } satisfies ApiError };
}

export async function credits(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const clientId = req.query.get('clientId') ?? '';
  const gate = await getCreditStore();
  try {
    const result = await readCredits(clientId, gate);
    return { status: 200, jsonBody: result };
  } catch (e) {
    if (e instanceof CreditsValidationError) {
      return fail(400, e.message, 'invalid_request');
    }
    ctx.error('credits lookup failed', e);
    return fail(500, 'Failed to read credit balance', 'internal_error');
  }
}

app.http('credits', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'credits',
  handler: credits,
});
