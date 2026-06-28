import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApiError,
  createProfile,
  getProfile,
  deleteProfile,
  restoreProfile,
  submitGameScore,
  flushPendingScores,
} from '../../js/api-client.js';

function makeFetch(responses) {
  const calls = [];
  let i = 0;
  return {
    calls,
    fetch: vi.fn(async (url, init) => {
      calls.push({ url, init });
      const r = responses[i++] || responses[responses.length - 1];
      const body = r.status === 204 ? null : JSON.stringify(r.body);
      return new Response(body, {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  };
}

beforeEach(() => {
  global.fetch = vi.fn();
  // Fresh localStorage for the queue
  const data = new Map();
  global.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => { data.clear(); },
  };
});

describe('createProfile', () => {
  it('sends POST /api/v1/profiles and parses the response', async () => {
    const { fetch, calls } = makeFetch([{ status: 201, body: { anonymous_user_id: 'u1' } }]);
    global.fetch = fetch;
    const result = await createProfile('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(result.anonymous_user_id).toBe('u1');
    expect(calls[0].url).toBe('/api/v1/profiles');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body).anonymous_user_id).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('throws ApiError on non-2xx', async () => {
    const { fetch } = makeFetch([{ status: 400, body: { error: { code: 'INVALID_PARAMETER', message: 'bad' } } }]);
    global.fetch = fetch;
    await expect(createProfile('u1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getProfile / deleteProfile / restoreProfile', () => {
  it('getProfile hits GET /api/v1/profiles/{id}', async () => {
    const { fetch, calls } = makeFetch([{ status: 200, body: { scores: {} } }]);
    global.fetch = fetch;
    await getProfile('u1');
    expect(calls[0].url).toBe('/api/v1/profiles/u1');
    expect(calls[0].init.method).toBeUndefined();
  });

  it('deleteProfile issues DELETE', async () => {
    const { fetch, calls } = makeFetch([{ status: 204, body: '' }]);
    global.fetch = fetch;
    await deleteProfile('u1');
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('restoreProfile sends the recovery token in the body', async () => {
    const { fetch, calls } = makeFetch([{ status: 200, body: { anonymous_user_id: 'u1' } }]);
    global.fetch = fetch;
    await restoreProfile('crimson-tiger-autumn-breeze');
    expect(calls[0].url).toBe('/api/v1/profiles/restore');
    expect(JSON.parse(calls[0].init.body)).toEqual({ recovery_token: 'crimson-tiger-autumn-breeze' });
  });
});

describe('submitGameScore', () => {
  it('POSTs the envelope and includes the client timezone offset', async () => {
    const { fetch, calls } = makeFetch([{ status: 200, body: { status: 'success', updatedScores: {} } }]);
    global.fetch = fetch;
    await submitGameScore('u1', 'flashmatrix', {
      score: 720,
      accuracy: 0.9,
      responseTimeMs: 200,
      roundsCompleted: 5,
      rawMetrics: { clicks: [] },
    });
    const body = JSON.parse(calls[0].init.body);
    expect(body.anonymous_user_id).toBe('u1');
    expect(body.score).toBe(720);
    expect(body.client_tx_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[0].init.headers['X-Client-Timezone-Offset']).toBeDefined();
  });

  it('queues the payload on network failure (IT-NRF-01)', async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(submitGameScore('u1', 'flashmatrix', {
      score: 100, accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1,
    })).rejects.toThrow();
    expect(JSON.parse(localStorage.getItem('mindflex_pending_scores') || '[]').length).toBe(1);
  });

  it('queues the payload on abort timeout', async () => {
    global.fetch = vi.fn(() => new Promise((_, reject) => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    }));
    await expect(submitGameScore('u1', 'flashmatrix', {
      score: 100, accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1,
    }, { timeoutMs: 50 })).rejects.toBeDefined();
    expect(JSON.parse(localStorage.getItem('mindflex_pending_scores') || '[]').length).toBe(1);
  });

  it('generates a unique client_tx_id per call', async () => {
    const { fetch } = makeFetch([
      { status: 200, body: { status: 'success', updatedScores: {} } },
      { status: 200, body: { status: 'success', updatedScores: {} } },
    ]);
    global.fetch = fetch;
    await submitGameScore('u1', 'flashmatrix', { score: 100, accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1 });
    await submitGameScore('u1', 'flashmatrix', { score: 100, accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1 });
    const a = JSON.parse(fetch.mock.calls[0][1].body).client_tx_id;
    const b = JSON.parse(fetch.mock.calls[1][1].body).client_tx_id;
    expect(a).not.toBe(b);
  });
});

describe('flushPendingScores', () => {
  it('returns zero counts when there are no queued payloads', async () => {
    const { fetch } = makeFetch([]);
    global.fetch = fetch;
    const r = await flushPendingScores();
    expect(r.flushed).toBe(0);
    expect(r.remaining).toBe(0);
  });

  it('flushes each queued payload via the provided submitter', async () => {
    // Seed two pending payloads
    localStorage.setItem('mindflex_pending_scores', JSON.stringify([
      { client_tx_id: 'tx-a', anonymous_user_id: 'u1', score: 100 },
      { client_tx_id: 'tx-b', anonymous_user_id: 'u1', score: 200 },
    ]));
    const submitter = vi.fn().mockResolvedValue({ updatedScores: { memory: 1 } });
    const r = await flushPendingScores(submitter);
    expect(submitter).toHaveBeenCalledTimes(2);
    expect(r.flushed).toBe(2);
    expect(r.remaining).toBe(0);
    expect(JSON.parse(localStorage.getItem('mindflex_pending_scores') || '[]')).toEqual([]);
  });

  it('stops flushing on first error so retries stay possible', async () => {
    localStorage.setItem('mindflex_pending_scores', JSON.stringify([
      { client_tx_id: 'tx-a', anonymous_user_id: 'u1', score: 100 },
      { client_tx_id: 'tx-b', anonymous_user_id: 'u1', score: 200 },
    ]));
    const submitter = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ updatedScores: { memory: 1 } });
    const r = await flushPendingScores(submitter);
    expect(submitter).toHaveBeenCalledTimes(1);
    expect(r.flushed).toBe(0);
    expect(r.remaining).toBe(2);
  });
});
