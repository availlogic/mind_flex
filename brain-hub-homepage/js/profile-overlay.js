/* MindFlex — Profile overlay slide-down sheet
 * Spec: docs/Screen-Specs.md §3 (Profile Overlay)
 *       docs/UI-Layouts.md §4 (Profile Dropdown Overlay wireframe)
 *       docs/User-Flows.md Journey 2 (Backup & Recovery)
 */

import { isValidRecoveryToken } from './uuid.js';

export class ProfileOverlay {
  constructor(root, callbacks) {
    this.root = root;
    this.callbacks = callbacks || {};
    // Elements inside the overlay panel.
    this.tokenEl = root.querySelector('[data-mf-role="recovery-token"]');
    this.copyBtn = root.querySelector('[data-mf-role="copy-token"]');
    this.importInput = root.querySelector('[data-mf-role="import-token"]');
    this.restoreBtn = root.querySelector('[data-mf-role="restore-submit"]');
    this.importErrorEl = root.querySelector('[data-mf-role="import-error"]');
    this.closeBtn = root.querySelector('[data-mf-role="close-overlay"]');
    this.deleteBtn = root.querySelector('[data-mf-role="delete-data"]');
    this.streakEl = root.querySelector('#mf-overlay-streak');
    // Confirm modal lives at document scope (sibling of overlay) so its
    // querySelector searches the whole document.
    const doc = root.ownerDocument || document;
    this.confirmEl = doc.querySelector('[data-mf-role="confirm-delete"]');
    this.confirmYes = doc.querySelector('[data-mf-role="confirm-yes"]');
    this.confirmNo = doc.querySelector('[data-mf-role="confirm-no"]');
    this.bind();
  }

  bind() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(this.tokenEl.textContent.trim());
        } catch (_) {
          // Fallback for older browsers
          const range = document.createRange();
          range.selectNode(this.tokenEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          try { document.execCommand('copy'); } catch (_) { /* ignore */ }
        }
      });
    }
    if (this.restoreBtn) {
      this.restoreBtn.addEventListener('click', () => {
        const value = (this.importInput && this.importInput.value || '').trim();
        if (!isValidRecoveryToken(value)) {
          this.setImportError('Invalid token format. Must be 4 dash-separated words.');
          return;
        }
        this.setImportError('');
        this.callbacks.onRestore && this.callbacks.onRestore(value);
      });
    }
    if (this.importInput) {
      this.importInput.addEventListener('input', () => {
        if (this.importErrorEl) this.importErrorEl.textContent = '';
      });
    }
    if (this.deleteBtn) {
      this.deleteBtn.addEventListener('click', () => this.showConfirm());
    }
    if (this.confirmNo) {
      this.confirmNo.addEventListener('click', () => this.hideConfirm());
    }
    if (this.confirmYes) {
      this.confirmYes.addEventListener('click', () => {
        this.hideConfirm();
        this.callbacks.onDeleteAll && this.callbacks.onDeleteAll();
      });
    }
    // Click outside the card closes the overlay (User-Flows §3.1).
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.hide();
    });
  }

  setProfile(profile) {
    if (this.tokenEl && profile && profile.recovery_token) {
      this.tokenEl.textContent = profile.recovery_token;
    }
    if (this.streakEl && profile) {
      const streak = profile.current_streak || 0;
      this.streakEl.textContent = `${streak} day${streak === 1 ? '' : 's'}`;
    }
    if (this.tokenEl && profile && profile.badges) {
      // No-op for MVP; reserved for future badges display.
    }
  }

  setImportError(msg) {
    if (this.importErrorEl) this.importErrorEl.textContent = msg;
  }

  show() {
    this.root.classList.add('mf-overlay--visible');
  }

  hide() {
    this.root.classList.remove('mf-overlay--visible');
  }

  showConfirm() {
    if (this.confirmEl) this.confirmEl.classList.add('mf-confirm--visible');
  }

  hideConfirm() {
    if (this.confirmEl) this.confirmEl.classList.remove('mf-confirm--visible');
  }
}
