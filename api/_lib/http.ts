// ============================================================================
// HTTP plumbing shared by the LLM-proxy endpoints (analyze / ask / ocr)
// ----------------------------------------------------------------------------
// Body parsing, input validation, client-IP extraction, the credit-gate
// provider, and uniform JSON/error responses. Keeps each handler focused on its
// one operation.
//
// Owned by lane A (LLM proxy).
// ============================================================================

import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import type { ApiError, ApiErrorCode } from '../../src/lib/api-types';
import type { CreditGate } from './contracts';
import { getCreditStore } from './creditStore';

// ----------------------------------------------------------------------------
// Credit gate provider
// ----------------------------------------------------------------------------
//
// Delegates to lane B's getCreditStore() factory, which returns the Table
// Storage-backed gate when AZURE_STORAGE_CONNECTION_STRING is set, and the
// in-memory stub otherwise (local dev / tests). Handlers depend on this
// accessor, not on a concrete store.
export async function getCreditGate(): Promise<CreditGate> {
  return getCreditStore();
}

// ----------------------------------------------------------------------------
// Responses
// ----------------------------------------------------------------------------

export function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: body,
    headers: { 'Content-Type': 'application/json' },
  };
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  extraHeaders?: Record<string, string>,
): HttpResponseInit {
  const body: ApiError = { error: message, code };
  return {
    status,
    jsonBody: body,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  };
}

// ----------------------------------------------------------------------------
// Request parsing / validation
// ----------------------------------------------------------------------------

/** A validation failure carrying the HTTP shape to return. */
export class BadRequest extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Parse a JSON body, throwing BadRequest on malformed input. */
export async function readJsonBody(req: HttpRequest): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new BadRequest(400, 'invalid_request', 'Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequest(400, 'invalid_request', 'Request body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

/** Extract and validate the clientId present on every request. */
export function requireClientId(body: Record<string, unknown>): string {
  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.trim().length === 0) {
    throw new BadRequest(400, 'invalid_request', 'A clientId is required.');
  }
  if (clientId.length > 200) {
    throw new BadRequest(400, 'invalid_request', 'clientId is too long.');
  }
  return clientId.trim();
}

/** Require a non-empty string field, capped at maxLen characters. */
export function requireString(
  body: Record<string, unknown>,
  field: string,
  maxLen: number,
): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequest(400, 'invalid_request', `Field "${field}" is required.`);
  }
  if (value.length > maxLen) {
    throw new BadRequest(
      413,
      'invalid_request',
      `Field "${field}" exceeds the maximum length of ${maxLen} characters.`,
    );
  }
  return value;
}

/** Optional string[] field, capped in count and per-item length. */
export function optionalStringArray(
  body: Record<string, unknown>,
  field: string,
  maxItems: number,
  maxItemLen: number,
): string[] {
  const value = body[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new BadRequest(400, 'invalid_request', `Field "${field}" must be an array of strings.`);
  }
  if (value.length > maxItems) {
    throw new BadRequest(400, 'invalid_request', `Field "${field}" has too many items.`);
  }
  return value.map((item, i) => {
    if (typeof item !== 'string') {
      throw new BadRequest(400, 'invalid_request', `Field "${field}[${i}]" must be a string.`);
    }
    return item.slice(0, maxItemLen);
  });
}

// ----------------------------------------------------------------------------
// Client IP
// ----------------------------------------------------------------------------

/**
 * Best-effort client IP for rate limiting. Behind Azure's front end the real IP
 * is in x-forwarded-for (first hop). Falls back to other forwarding headers and
 * finally a constant bucket so the limiter still degrades safely.
 */
export function clientIp(req: HttpRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return stripPort(first);
  }
  const real = req.headers.get('x-real-ip') || req.headers.get('x-client-ip');
  if (real) return stripPort(real.trim());
  return 'unknown';
}

function stripPort(ipMaybeWithPort: string): string {
  // IPv4:port -> IPv4 ; leave IPv6 (which contains colons) intact.
  const isIpv4WithPort = /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ipMaybeWithPort);
  return isIpv4WithPort ? ipMaybeWithPort.split(':')[0] : ipMaybeWithPort;
}
