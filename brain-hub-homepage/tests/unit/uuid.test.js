import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateUUID,
  isValidUUID,
  isValidRecoveryToken,
  getOrCreateAnonymousUserId,
  ANONYMOUS_USER_ID_KEY,
} from '../../js/uuid.js';

function freshStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => { data.clear(); },
  };
}

describe('UUID v4 generator', () => {
  it('returns a valid v4 UUID', () => {
    const id = generateUUID();
    expect(isValidUUID(id)).toBe(true);
  });

  it('returns distinct UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(ids.size).toBe(100);
  });

  it('the 13th hex digit is "4" and the 17th is in {8,9,a,b}', () => {
    const id = generateUUID();
    const stripped = id.replace(/-/g, '');
    expect(stripped[12]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(stripped[16].toLowerCase());
  });
});

describe('isValidUUID', () => {
  it('rejects empty and non-string inputs', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
    expect(isValidUUID(123)).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });
});

describe('isValidRecoveryToken', () => {
  it('accepts well-formed tokens', () => {
    expect(isValidRecoveryToken('crimson-tiger-autumn-breeze')).toBe(true);
  });
  it('rejects wrong arity or upper-case', () => {
    expect(isValidRecoveryToken('tiger')).toBe(false);
    expect(isValidRecoveryToken('Crimson-tiger-autumn-breeze')).toBe(false);
    expect(isValidRecoveryToken('a-b-c-d-e')).toBe(false);
  });
});

describe('getOrCreateAnonymousUserId', () => {
  it('creates and persists a UUID when none exists', () => {
    const s = freshStorage();
    const id = getOrCreateAnonymousUserId(s);
    expect(isValidUUID(id)).toBe(true);
    expect(s.getItem(ANONYMOUS_USER_ID_KEY)).toBe(id);
  });

  it('returns the existing UUID when storage has a valid one', () => {
    const s = freshStorage();
    s.setItem(ANONYMOUS_USER_ID_KEY, '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(getOrCreateAnonymousUserId(s)).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('regenerates when stored value is malformed', () => {
    const s = freshStorage();
    s.setItem(ANONYMOUS_USER_ID_KEY, 'bad-id');
    const id = getOrCreateAnonymousUserId(s);
    expect(isValidUUID(id)).toBe(true);
    expect(s.getItem(ANONYMOUS_USER_ID_KEY)).toBe(id);
  });
});
