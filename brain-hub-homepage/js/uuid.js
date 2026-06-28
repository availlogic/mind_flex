/* MindFlex — UUID v4 generator + validators
 * Spec: docs/Acceptance-Criteria.md §1.1 (must generate a valid version 4 UUID)
 *      docs/Functional-Test-Cases.md FT-APC-02 (UUID validation rules)
 */

export const ANONYMOUS_USER_ID_KEY = 'anonymous_user_id';
export const PENDING_SCORES_KEY = 'mindflex_pending_scores';
export const RECOVERY_TOKEN_HISTORY_KEY = 'mindflex_recovery_token';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidUUID(v) {
  return typeof v === 'string' && UUID_V4_RE.test(v);
}

const RECOVERY_TOKEN_RE = /^[a-z]+(-[a-z]+){3}$/;

export function isValidRecoveryToken(v) {
  return typeof v === 'string' && RECOVERY_TOKEN_RE.test(v);
}

export function getOrCreateAnonymousUserId(storage = localStorage) {
  const existing = storage.getItem(ANONYMOUS_USER_ID_KEY);
  if (isValidUUID(existing)) return existing;
  const fresh = generateUUID();
  storage.setItem(ANONYMOUS_USER_ID_KEY, fresh);
  return fresh;
}

export function setAnonymousUserId(storage, value) {
  storage.setItem(ANONYMOUS_USER_ID_KEY, value);
}

export function clearAnonymousUserId(storage) {
  storage.removeItem(ANONYMOUS_USER_ID_KEY);
  storage.removeItem(RECOVERY_TOKEN_HISTORY_KEY);
}
