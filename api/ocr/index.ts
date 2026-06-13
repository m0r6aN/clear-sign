// ============================================================================
// POST /api/ocr — extract raw text from a document image (free, gated by IP)
// ----------------------------------------------------------------------------
// Free per CREDIT_COST.ocr (0): does NOT decrement credits, but still requires a
// valid clientId and is IP rate-limited. Accepts a base64 image data URI,
// validates the mime type and decoded size, and returns the transcribed text.
//
// Owned by lane A (LLM proxy).
// ============================================================================

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import type { OcrResponse } from '../../src/lib/api-types';
import { ocrImage, MissingApiKeyError, UpstreamError } from '../_lib/anthropic';
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

// Claude vision supports these image types.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_DATAURI_CHARS = 7_500_000; // ~5.4 MB decoded; comfortably within request limits.
const MAX_DECODED_BYTES = 5 * 1024 * 1024; // 5 MB image cap.

interface ParsedDataUri {
  mediaType: string;
  base64Data: string;
}

/** Parse and validate a `data:<mime>;base64,<data>` URI. */
function parseImageDataUri(dataUri: string): ParsedDataUri {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUri);
  if (!match) {
    throw new BadRequest(400, 'invalid_request', 'dataUri must be a base64 image data URI.');
  }
  const mediaType = match[1].toLowerCase();
  if (!ALLOWED_MIME.has(mediaType)) {
    throw new BadRequest(
      400,
      'invalid_request',
      'Unsupported image type. Use JPEG, PNG, GIF, or WebP.',
    );
  }
  const base64Data = match[2].replace(/\s+/g, '');
  // Validate it's real base64 and within the size cap.
  const decodedBytes = Math.floor((base64Data.length * 3) / 4);
  if (decodedBytes === 0) {
    throw new BadRequest(400, 'invalid_request', 'The image is empty.');
  }
  if (decodedBytes > MAX_DECODED_BYTES) {
    throw new BadRequest(413, 'invalid_request', 'The image is too large (max 5 MB).');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) {
    throw new BadRequest(400, 'invalid_request', 'The image data is not valid base64.');
  }
  return { mediaType, base64Data };
}

export async function ocr(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await readJsonBody(req);
    const clientId = requireClientId(body);
    const dataUri = requireString(body, 'dataUri', MAX_DATAURI_CHARS);
    const { mediaType, base64Data } = parseImageDataUri(dataUri);

    const limit = rateLimit('ocr', clientIp(req));
    if (!limit.allowed) {
      return errorResponse(429, 'invalid_request', 'Too many requests. Please slow down.', {
        'Retry-After': String(limit.retryAfter),
      });
    }

    const gate = getCreditGate();
    // ocr is free — establish identity / balance but never decrement.
    const creditsRemaining = await gate.check(clientId);

    const text = await ocrImage(mediaType, base64Data);

    const response: OcrResponse = { text, creditsRemaining };
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
    ctx.error('ocr: missing ANTHROPIC_API_KEY');
    return errorResponse(500, 'internal_error', 'The service is not configured correctly.');
  }
  if (err instanceof UpstreamError) {
    ctx.warn(`ocr: upstream error: ${err.message}`);
    return errorResponse(502, 'upstream_error', err.message);
  }
  ctx.error(`ocr: unexpected error: ${String(err)}`);
  return errorResponse(500, 'internal_error', 'Something went wrong.');
}

app.http('ocr', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ocr',
  handler: ocr,
});
