import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setPendingScore,
  readPendingScores,
  clearPendingScore,
  cacheProfile,
  loadCachedProfile,
  clearCachedProfile,
} from '../../js/profile.js';

function freshStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => { data.clear(); },
  };
}

beforeEach(() => {
  global.localStorage = freshStorage();
});

describe('profile cache', () => {
  it('round-trips a profile', () => {
    const uid = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    const profile = { anonymous_user_id: uid, scores: { memory: 720 } };
    cacheProfile(uid, profile);
    expect(loadCachedProfile(uid)).toEqual(profile);
  });

  it('clearCachedProfile removes both the cache and the recovery token', () => {
    const uid = 'uid-1';
    cacheProfile(uid, { anonymous_user_id: uid, recovery_token: 'crimson-tiger-autumn-breeze' });
    clearCachedProfile(uid);
    expect(loadCachedProfile(uid)).toBeNull();
  });
});

describe('pending scores queue', () => {
  it('appends, lists, and clears by client_tx_id', () => {
    const a = { client_tx_id: 'aaa', anonymous_user_id: 'u1', score: 100 };
    const b = { client_tx_id: 'bbb', anonymous_user_id: 'u1', score: 200 };
    setPendingScore(a);
    setPendingScore(b);
    expect(readPendingScores()).toEqual([a, b]);
    clearPendingScore('aaa');
    expect(readPendingScores()).toEqual([b]);
  });
});
