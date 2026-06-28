/* MindFlex — LocalStorage-backed profile cache
 * Spec:
 *   docs/Acceptance-Criteria.md §1.4 (offline mode persistence)
 *   docs/User-Flows.md Journey 2.1 (Recovery Flow)
 */

import {
  ANONYMOUS_USER_ID_KEY,
  PENDING_SCORES_KEY,
  RECOVERY_TOKEN_HISTORY_KEY,
  setAnonymousUserId,
} from './uuid.js';

const PROFILE_CACHE_PREFIX = 'mindflex_profile_';

export function cacheProfile(uid, profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_PREFIX + uid, JSON.stringify(profile));
    if (profile && profile.recovery_token) {
      localStorage.setItem(RECOVERY_TOKEN_HISTORY_KEY, profile.recovery_token);
    }
  } catch (_) {
    /* storage may be unavailable; ignore */
  }
}

export function loadCachedProfile(uid) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_PREFIX + uid);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearCachedProfile(uid) {
  try {
    localStorage.removeItem(PROFILE_CACHE_PREFIX + uid);
    localStorage.removeItem(RECOVERY_TOKEN_HISTORY_KEY);
  } catch (_) {
    /* ignore */
  }
}

export function getCachedRecoveryToken() {
  try {
    return localStorage.getItem(RECOVERY_TOKEN_HISTORY_KEY);
  } catch (_) {
    return null;
  }
}

export function setPendingScore(payload) {
  try {
    const arr = JSON.parse(localStorage.getItem(PENDING_SCORES_KEY) || '[]');
    arr.push(payload);
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(arr));
  } catch (_) {
    /* ignore */
  }
}

export function readPendingScores() {
  try {
    const arr = JSON.parse(localStorage.getItem(PENDING_SCORES_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function clearPendingScore(clientTxId) {
  try {
    const arr = readPendingScores().filter(p => p && p.client_tx_id !== clientTxId);
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(arr));
  } catch (_) {
    /* ignore */
  }
}

export function swapAnonymousUserId(uid) {
  setAnonymousUserId(localStorage, uid);
}

export { ANONYMOUS_USER_ID_KEY, PENDING_SCORES_KEY, RECOVERY_TOKEN_HISTORY_KEY };
