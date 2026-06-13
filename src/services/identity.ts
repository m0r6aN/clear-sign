// ============================================================================
// Client identity (browser side)
// ----------------------------------------------------------------------------
// The anonymous, persistent clientId that keys the credit ledger. Generated
// once and stored in localStorage so a visitor keeps their balance across
// sessions WITHOUT an account — this is what makes the free tier zero-friction.
//
// The API client wrappers (analysisApi / billingApi) call getClientId()
// internally and attach it to every request, so feature code never threads it
// through by hand.
//
// Owned by lane L0 (foundation). Consume via getClientId(); do not edit.
// ============================================================================

const STORAGE_KEY = 'clearsign.clientId';

/**
 * Returns the persistent anonymous client id, creating and storing one on first
 * call. Falls back to an in-memory id if localStorage is unavailable (private
 * mode / SSR), so requests still carry a valid identity within the session.
 */
let memoryFallback: string | null = null;

export function getClientId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = generateId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    if (!memoryFallback) memoryFallback = generateId();
    return memoryFallback;
  }
}

function generateId(): string {
  // Prefer the platform UUID; fall back to a random-enough token.
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  // Last-resort token; uniqueness here is best-effort only.
  return `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
