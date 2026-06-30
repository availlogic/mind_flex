import worker from '../../cloudflare-router.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Cloudflare Worker Router', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes API requests to the backend API tunnel and deletes Host header', async () => {
    const globalFetch = vi.fn().mockResolvedValue(new Response('API OK'));
    vi.stubGlobal('fetch', globalFetch);

    const request = new Request('https://mindflex-hub.maxithome.com/api/v1/profiles', {
      method: 'POST',
      headers: {
        'host': 'mindflex-hub.maxithome.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ test: true }),
    });

    const response = await worker.fetch(request);
    const bodyText = await response.text();
    expect(bodyText).toBe('API OK');
    
    expect(globalFetch).toHaveBeenCalled();
    const [calledUrl, calledOptions] = globalFetch.mock.calls[0];
    expect(calledUrl).toBe('https://mindflex-api.maxithome.com/api/v1/profiles');
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers.get('host')).toBeNull();
  });

  it('redirects game requests without a trailing slash to append one', async () => {
    const request = new Request('https://mindflex-hub.maxithome.com/games/memory/flashmatrix', {
      method: 'GET',
    });

    const response = await worker.fetch(request);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://mindflex-hub.maxithome.com/games/memory/flashmatrix/');
  });

  it('redirects nested game requests without a trailing slash (e.g. dynamic category/game)', async () => {
    const request = new Request('https://mindflex-hub.maxithome.com/games/speed/reflex-check', {
      method: 'GET',
    });

    const response = await worker.fetch(request);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://mindflex-hub.maxithome.com/games/speed/reflex-check/');
  });

  it('routes game requests with trailing slash to the correct Pages domain and strips prefix', async () => {
    const globalFetch = vi.fn().mockResolvedValue(new Response('Game Matrix Home'));
    vi.stubGlobal('fetch', globalFetch);

    const request = new Request('https://mindflex-hub.maxithome.com/games/memory/flashmatrix/', {
      method: 'GET',
    });

    const response = await worker.fetch(request);
    const bodyText = await response.text();
    expect(bodyText).toBe('Game Matrix Home');

    expect(globalFetch).toHaveBeenCalled();
    const [calledUrl] = globalFetch.mock.calls[0];
    expect(calledUrl).toBe('https://game-memory-flashmatrix.pages.dev/');
  });

  it('routes game assets to the correct dynamic Pages domain and strips prefix', async () => {
    const globalFetch = vi.fn().mockResolvedValue(new Response('Game JS Asset'));
    vi.stubGlobal('fetch', globalFetch);

    const request = new Request('https://mindflex-hub.maxithome.com/games/speed/reflex-check/assets/main.js', {
      method: 'GET',
    });

    const response = await worker.fetch(request);
    const bodyText = await response.text();
    expect(bodyText).toBe('Game JS Asset');

    expect(globalFetch).toHaveBeenCalled();
    const [calledUrl] = globalFetch.mock.calls[0];
    expect(calledUrl).toBe('https://game-speed-reflex-check.pages.dev/assets/main.js');
  });

  it('routes other dashboard requests to the default homepage Pages domain', async () => {
    const globalFetch = vi.fn().mockResolvedValue(new Response('Dashboard Home'));
    vi.stubGlobal('fetch', globalFetch);

    const request = new Request('https://mindflex-hub.maxithome.com/', {
      method: 'GET',
    });

    const response = await worker.fetch(request);
    const bodyText = await response.text();
    expect(bodyText).toBe('Dashboard Home');

    expect(globalFetch).toHaveBeenCalled();
    const [calledUrl] = globalFetch.mock.calls[0];
    expect(calledUrl).toBe('https://brain-hub-homepage.pages.dev/');
  });
});
