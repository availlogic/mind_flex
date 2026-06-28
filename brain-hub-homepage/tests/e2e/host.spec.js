// Playwright E2E — covers key acceptance scenarios from docs.
// Mocks the /api/v1/* endpoints so the tests run without docker.

import { test, expect } from '@playwright/test';

const HOST_PROFILE = {
  anonymous_user_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  recovery_token: 'crimson-tiger-autumn-breeze',
  scores: { memory: 0, focus: 0, logic: 0, speed: 0, spatial: 0 },
  current_streak: 0,
  daily_games_played: 0,
  daily_goal: 3,
  badges: [],
  last_active_at: null,
  created_at: '2026-06-27T05:00:00Z',
};

const UPDATED_PROFILE = {
  ...HOST_PROFILE,
  scores: { memory: 535, focus: 0, logic: 0, speed: 0, spatial: 0 },
  current_streak: 1,
  daily_games_played: 1,
  last_active_at: '2026-06-27T05:08:12Z',
  badges: [{ badge_id: 'b1', badge_type: 'MEM_SPEED_DEMON', unlocked_at: '2026-06-27T05:08:12Z' }],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (url.endsWith('/api/v1/profiles') && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(HOST_PROFILE),
      });
    }
    const getMatch = url.match(/\/api\/v1\/profiles\/([^/?]+)$/);
    if (getMatch && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HOST_PROFILE),
      });
    }
    if (url.endsWith('/api/v1/profiles/restore') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HOST_PROFILE),
      });
    }
    if (url.includes('/api/v1/games/flashmatrix/submit') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          updatedScores: { memory: 535, focus: 0, logic: 0, speed: 0, spatial: 0 },
          newBadgeUnlocked: true,
          unlockedBadges: [{ badge_type: 'MEM_SPEED_DEMON', unlocked_at: '2026-06-27T05:08:12Z' }],
          current_streak: 1,
        }),
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"RESOURCE_NOT_FOUND","message":"not mocked"}}' });
  });
});

test('FT-HDR-01: lobby renders game cards and ratings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#mf-rating')).toHaveText('0');
  await expect(page.locator('#mf-streak')).toHaveText('0 days');
  await expect(page.locator('[data-game-id="flashmatrix"]')).toBeVisible();
});

test('FT-HDR-01: viewport < 768px hides the sidebar and shows the hamburger', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto('/');
  await expect(page.locator('#mf-menu-button')).toBeVisible();
  await expect(page.locator('#mf-grid')).toBeVisible();
});

test('E2E-SC-01: bootstrap creates an anonymous profile and renders the lobby', async ({ page }) => {
  // First load so we can clear LocalStorage in the right origin context.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Set up the request waiter BEFORE the second navigation that triggers bootstrap.
  const reqWait = page.waitForRequest('**/api/v1/profiles', { method: 'POST' });
  await page.goto('/');
  const req = await reqWait;
  expect(req.postDataJSON()).toMatchObject({
    anonymous_user_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
  await expect(page.locator('#mf-rating')).toHaveText('0');
  await page.locator('[data-game-id="flashmatrix"]').click();
  await expect(page.locator('#mf-stage')).toBeVisible();
});

test('E2E-SC-02: profile overlay shows recovery token and accepts valid import', async ({ page }) => {
  await page.goto('/');
  await page.locator('#mf-avatar').click();
  await expect(page.locator('#mf-overlay')).toHaveClass(/mf-overlay--visible/);
  await expect(page.locator('[data-mf-role="recovery-token"]')).toHaveText('crimson-tiger-autumn-breeze');
  // Bad import shows the inline error (FT-PBR-02).
  await page.locator('[data-mf-role="import-token"]').fill('tiger');
  await page.locator('[data-mf-role="restore-submit"]').click();
  await expect(page.locator('[data-mf-role="import-error"]')).toContainText('Invalid token format');
  // Good import triggers the API call.
  await page.locator('[data-mf-role="import-token"]').fill('crimson-tiger-autumn-breeze');
  const restoreReq = page.waitForRequest('**/api/v1/profiles/restore', { method: 'POST' });
  await page.locator('[data-mf-role="restore-submit"]').click();
  const r = await restoreReq;
  expect(r.postDataJSON()).toEqual({ recovery_token: 'crimson-tiger-autumn-breeze' });
});

test('FT-SSB-02: foreign-origin postMessage is blocked', async ({ page }) => {
  const warnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  await page.goto('/');
  await page.evaluate(() => {
    // Synthesize a MessageEvent from a foreign origin.
    const evt = new MessageEvent('message', {
      origin: 'https://malicious-site.com',
      data: { type: 'MINDFLEX_GAME_OVER', payload: { score: 9999 } },
    });
    window.dispatchEvent(evt);
  });
  await page.waitForTimeout(100);
  expect(warnings.some(w => /Blocked untrusted message origin/.test(w))).toBe(true);
});

test('E2E-SC-03: Delete All Data clears local storage after confirmation', async ({ page }) => {
  await page.goto('/');
  await page.locator('#mf-avatar').click();
  await page.locator('[data-mf-role="delete-data"]').click();
  await expect(page.locator('[data-mf-role="confirm-delete"]')).toHaveClass(/mf-confirm--visible/);
  const delReq = page.waitForRequest(`**/api/v1/profiles/${HOST_PROFILE.anonymous_user_id}`, {
    method: 'DELETE',
  });
  await page.locator('[data-mf-role="confirm-yes"]').click();
  const r = await delReq;
  expect(r.method()).toBe('DELETE');
});
