/* MindFlex — API client (wraps fetch with offline queue)
 * Spec: docs/User-Flows.md Journey 1 (Recovery Flow)
 *       docs/Integration-Test-Cases.md IT-NRF-01 (offline persistence)
 */

import {
  readPendingScores,
  setPendingScore,
  clearPendingScore,
} from './profile.js';

const DEFAULT_TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details || {};
  }
}

async function fetchJSON(url, init = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    const text = await resp.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
    if (!resp.ok) {
      const err = body && body.error ? body.error : null;
      throw new ApiError(
        err ? err.code : 'HTTP_ERROR',
        err ? err.message : `HTTP ${resp.status}`,
        resp.status,
        err ? err.details : {}
      );
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function createProfile(uid, opts = {}) {
  return fetchJSON('/api/v1/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonymous_user_id: uid }),
  }, opts);
}

export async function getProfile(uid, opts = {}) {
  return fetchJSON(`/api/v1/profiles/${encodeURIComponent(uid)}`, {}, opts);
}

export async function deleteProfile(uid, opts = {}) {
  return fetchJSON(`/api/v1/profiles/${encodeURIComponent(uid)}`, { method: 'DELETE' }, opts);
}

export async function restoreProfile(recoveryToken, opts = {}) {
  return fetchJSON('/api/v1/profiles/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recovery_token: recoveryToken }),
  }, opts);
}

function clientTzOffsetHeader() {
  const offset = -new Date().getTimezoneOffset(); // minutes EAST of UTC
  return { 'X-Client-Timezone-Offset': String(offset) };
}

function clientTxId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback v4 generator inline to keep this file dependency-free.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function submitGameScore(uid, gameName, payload, opts = {}) {
  const body = {
    anonymous_user_id: uid,
    client_tx_id: clientTxId(),
    _game_name: gameName,
    score: payload.score,
    accuracy: payload.accuracy,
    responseTimeMs: payload.responseTimeMs,
    roundsCompleted: payload.roundsCompleted,
    rawMetrics: payload.rawMetrics || { clicks: [] },
  };
  try {
    const result = await fetchJSON(
      `/api/v1/games/${encodeURIComponent(gameName)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...clientTzOffsetHeader() },
        body: JSON.stringify(body),
      },
      opts
    );
    return result;
  } catch (err) {
    // Queue for later retry on network failures and 5xx (IT-NRF-01).
    const transient =
      err instanceof TypeError ||
      err.name === 'AbortError' ||
      (err.status !== undefined && err.status >= 500);
    if (transient) {
      setPendingScore(body);
    }
    throw err;
  }
}

export async function flushPendingScores(submitter = submitGameScore, { silent = true } = {}) {
  const queued = readPendingScores();
  if (queued.length === 0) return { flushed: 0, remaining: 0 };
  let flushed = 0;
  for (const payload of queued) {
    try {
      await submitter(payload.anonymous_user_id, payload._game_name || 'flashmatrix', payload);
      clearPendingScore(payload.client_tx_id);
      flushed += 1;
    } catch (err) {
      if (!silent) console.warn('[MindFlex] Flush failed; will retry later.', err);
      break;
    }
  }
  const remaining = readPendingScores().length;
  return { flushed, remaining };
}
