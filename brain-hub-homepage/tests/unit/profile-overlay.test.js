import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ProfileOverlay } from '../../js/profile-overlay.js';

function setupDom() {
  const html = `
    <div id="overlay">
      <div data-mf-role="recovery-token"></div>
      <button data-mf-role="copy-token"></button>
      <input data-mf-role="import-token" />
      <button data-mf-role="restore-submit"></button>
      <div data-mf-role="import-error"></div>
      <button data-mf-role="close-overlay"></button>
      <button data-mf-role="delete-data"></button>
      <div data-mf-role="confirm-delete">
        <button data-mf-role="confirm-no"></button>
        <button data-mf-role="confirm-yes"></button>
      </div>
    </div>
  `;
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  global.window = dom.window;
  return dom.window.document.getElementById('overlay');
}

beforeEach(() => {
  global.navigator = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
});

describe('ProfileOverlay', () => {
  it('writes recovery token into the token element when setProfile is called', () => {
    const root = setupDom();
    const overlay = new ProfileOverlay(root, {});
    overlay.setProfile({ recovery_token: 'crimson-tiger-autumn-breeze' });
    expect(root.querySelector('[data-mf-role="recovery-token"]').textContent)
      .toBe('crimson-tiger-autumn-breeze');
  });

  it('shows and hides the overlay', () => {
    const root = setupDom();
    const overlay = new ProfileOverlay(root, {});
    overlay.show();
    expect(root.classList.contains('mf-overlay--visible')).toBe(true);
    overlay.hide();
    expect(root.classList.contains('mf-overlay--visible')).toBe(false);
  });

  it('shows the local validation error on bad recovery token format (FT-PBR-02)', () => {
    const root = setupDom();
    const overlay = new ProfileOverlay(root, {});
    const input = root.querySelector('[data-mf-role="import-token"]');
    input.value = 'tiger';
    root.querySelector('[data-mf-role="restore-submit"]').click();
    expect(root.querySelector('[data-mf-role="import-error"]').textContent)
      .toMatch(/Invalid token format/);
  });

  it('invokes onRestore only when token is well-formed', () => {
    const root = setupDom();
    const onRestore = vi.fn();
    const overlay = new ProfileOverlay(root, { onRestore });
    const input = root.querySelector('[data-mf-role="import-token"]');
    input.value = 'crimson-tiger-autumn-breeze';
    root.querySelector('[data-mf-role="restore-submit"]').click();
    expect(onRestore).toHaveBeenCalledWith('crimson-tiger-autumn-breeze');
  });

  it('opens confirm modal on Delete All Data', () => {
    const root = setupDom();
    const overlay = new ProfileOverlay(root, {});
    root.querySelector('[data-mf-role="delete-data"]').click();
    expect(root.querySelector('[data-mf-role="confirm-delete"]').classList.contains('mf-confirm--visible'))
      .toBe(true);
  });

  it('Cancel hides the confirm modal without firing onDeleteAll', () => {
    const root = setupDom();
    const onDeleteAll = vi.fn();
    const overlay = new ProfileOverlay(root, { onDeleteAll });
    root.querySelector('[data-mf-role="delete-data"]').click();
    root.querySelector('[data-mf-role="confirm-no"]').click();
    expect(onDeleteAll).not.toHaveBeenCalled();
  });

  it('Confirm fires onDeleteAll', () => {
    const root = setupDom();
    const onDeleteAll = vi.fn();
    const overlay = new ProfileOverlay(root, { onDeleteAll });
    root.querySelector('[data-mf-role="delete-data"]').click();
    root.querySelector('[data-mf-role="confirm-yes"]').click();
    expect(onDeleteAll).toHaveBeenCalled();
  });

  it('Copy Code copies the token to the clipboard', async () => {
    const root = setupDom();
    const overlay = new ProfileOverlay(root, {});
    overlay.setProfile({ recovery_token: 'crimson-tiger-autumn-breeze' });
    root.querySelector('[data-mf-role="copy-token"]').click();
    await Promise.resolve();
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('crimson-tiger-autumn-breeze');
  });
});
