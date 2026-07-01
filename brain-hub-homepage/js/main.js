/* MindFlex — Host dashboard entrypoint
 * Spec: docs/PRD.md §11.1 (Global Host Dashboard)
 *       docs/User-Flows.md Journey 1 (First-Time Initialization)
 *       docs/Acceptance-Criteria.md AC-1.1..AC-1.4
 */

import {
  getOrCreateAnonymousUserId,
  generateUUID,
} from './uuid.js';
import {
  cacheProfile,
  loadCachedProfile,
  swapAnonymousUserId,
  clearCachedProfile,
} from './profile.js';
import * as api from './api-client.js';
import {
  installBridgeListener,
  dispatchGameOver,
  HANDSHAKE_TIMEOUT_MS,
} from './bridge-host.js';
import { Ticker } from './ticker.js';
import { GAMES, gameById } from './games-registry.js';
import { renderRadar } from './radar.js';
import { ProfileOverlay } from './profile-overlay.js';

const OFFLINE_BANNER_DELAY_MS = 800;

let radarChart = null;
let overlay = null;
let ticker = null;
let bridgeCtl = null;
let offlineBannerTimer = null;
let currentProfile = null;
let currentGameId = null;

function getCategoryClass(cat) {
  return `mf-badge mf-badge--${cat}`;
}

function renderGames(profile) {
  const grid = document.getElementById('mf-grid');
  if (!grid) return;
  const bestScores = (profile && profile._bestScores) || {};
  grid.innerHTML = '';
  for (const game of GAMES) {
    const card = document.createElement('article');
    card.className = 'mf-card' + (game.disabled ? ' mf-card--disabled' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Play ${game.title}, ${game.categoryLabel}`);
    card.dataset.gameId = game.id;
    const best = bestScores[game.id] || (profile && profile.scores && profile.scores[game.category] > 0 ? profile.scores[game.category] : null);
    card.innerHTML = `
      <div class="mf-card__meta">
        <span class="${getCategoryClass(game.category)}">${game.categoryLabel}</span>
        <span>Diff: ${game.difficulty}</span>
      </div>
      <h3 class="mf-card__title">${game.icon} ${game.title}</h3>
      <div class="mf-card__best">${best != null ? `Best: ${best}` : 'Best: --'}</div>
    `;
    if (!game.disabled) {
      card.addEventListener('click', () => openGameStage(game));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openGameStage(game);
        }
      });
    } else {
      card.setAttribute('aria-disabled', 'true');
    }
    grid.appendChild(card);
  }
}

function applySidebarFilters() {
  const sidebarFilters = document.querySelectorAll('[data-mf-filter]');
  const activeCats = new Set();
  sidebarFilters.forEach(el => {
    const isChecked = el.checked;
    if (isChecked) activeCats.add(el.dataset.mfFilter);
    const label = el.closest('.mf-sidebar__filter');
    if (label) {
      label.classList.toggle('mf-sidebar__filter--active', isChecked);
    }
  });

  const cards = document.querySelectorAll('[data-game-id]');
  cards.forEach(card => {
    const game = gameById(card.dataset.gameId);
    if (!game) return;
    if (activeCats.size === 0 || activeCats.has(game.category)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });

  // Pill highlights in main
  document.querySelectorAll('[data-mf-pill]').forEach(pill => {
    const isActive = activeCats.has(pill.dataset.mfPill);
    pill.classList.toggle('mf-main__filter-pill--active', isActive);
    pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderDailyTracker(profile) {
  const el = document.getElementById('mf-daily-progress');
  if (!el) return;
  const played = (profile && profile.daily_games_played) || 0;
  const goal = (profile && profile.daily_goal) || 3;
  el.textContent = `${played}/${goal}`;
}

function renderRating(profile) {
  const el = document.getElementById('mf-rating');
  if (!el) return;
  const scores = profile && profile.scores || {};
  const vals = Object.values(scores).map(v => Number(v) || 0);
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  el.textContent = String(avg);
}

function renderOverlayProfile(profile) {
  if (overlay && profile) overlay.setProfile(profile);
}

function renderStreak(profile) {
  const el = document.getElementById('mf-streak');
  if (!el) return;
  const streak = (profile && profile.current_streak) || 0;
  el.textContent = `${streak} day${streak === 1 ? '' : 's'}`;
}

function renderRadarChart(profile) {
  const canvas = document.getElementById('mf-radar-canvas');
  if (!canvas) return;
  // Wait for Chart.js to be available globally (loaded via CDN).
  if (typeof window.Chart !== 'function') {
    setTimeout(() => renderRadarChart(profile), 50);
    return;
  }
  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }
  const scores = (profile && profile.scores) || {};
  radarChart = renderRadar(canvas, scores, window.Chart);
}

async function openGameStage(game) {
  if (game.disabled) return;
  const stage = document.getElementById('mf-stage');
  const lobby = document.getElementById('mf-lobby');
  const titleEl = document.getElementById('mf-stage-title');
  const frameWrap = document.getElementById('mf-stage-frame');
  const failureEl = document.getElementById('mf-stage-failure');
  if (!stage || !lobby || !frameWrap) return;

  titleEl.textContent = `Game Title: ${game.title} - ${game.categoryLabel} Training`;
  failureEl.style.display = 'none';

  lobby.style.display = 'none';
  stage.style.display = 'flex';
  currentGameId = game.id;

  // Build iframe per Architecture §4.1
  const oldIframe = frameWrap.querySelector('iframe');
  if (oldIframe) oldIframe.remove();
  const iframe = document.createElement('iframe');
  iframe.src = game.path;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.title = `${game.title} game`;
  iframe.className = 'mf-stage__frame-iframe';
  frameWrap.appendChild(iframe);

  // Wire the host bridge listener for the new iframe.
  // The global listener installed at boot handles origin checks + game-over
  // dispatch. Here we add per-stage callbacks for handshake timeout and the
  // close-on-completion behavior.
  if (bridgeCtl) bridgeCtl.stop();
  bridgeCtl = installBridgeListener({
    onGameOver: async (env) => {
      const uid = getOrCreateAnonymousUserId();
      updateBestScore(game.id, env.score);
      try {
        const result = await dispatchGameOver(uid, game.id, env, (u, n, p) => api.submitGameScore(u, n, p));
        await onScoreSubmitted(result);
      } catch (err) {
        console.warn('[MindFlex] Score submission deferred.', err);
        // The offline queue has the payload; UI already shows the optimistic update.
      } finally {
        closeGameStage();
      }
    },
    onHandshake: () => {
      if (bridgeCtl && bridgeCtl.stopHandshakeTimer) bridgeCtl.stopHandshakeTimer();
      failureEl.style.display = 'none';
    },
    onHandshakeTimeout: () => {
      failureEl.style.display = 'flex';
    },
  });
  bridgeCtl.startHandshakeTimer();
}

function closeGameStage() {
  const stage = document.getElementById('mf-stage');
  const lobby = document.getElementById('mf-lobby');
  const frameWrap = document.getElementById('mf-stage-frame');
  if (lobby) lobby.style.display = '';
  if (stage) stage.style.display = 'none';
  if (frameWrap) {
    const iframe = frameWrap.querySelector('iframe');
    if (iframe) iframe.remove();
  }
  currentGameId = null;
  if (bridgeCtl) {
    bridgeCtl.stop();
    bridgeCtl = null;
  }
}

function updateBestScore(gameId, score) {
  if (!currentProfile) return;
  if (!currentProfile._bestScores) {
    currentProfile._bestScores = {};
  }
  const currentBest = currentProfile._bestScores[gameId] || 0;
  if (score > currentBest) {
    currentProfile._bestScores[gameId] = score;
    cacheProfile(currentProfile.anonymous_user_id, currentProfile);
    renderGames(currentProfile);
  }
}

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function checkAndResetDailyGoal(profile) {
  if (!profile) return;
  const today = getLocalDateString();
  
  let profileLocalDate = profile._lastActiveDate;
  if (!profileLocalDate && profile.last_active_at) {
    const d = new Date(profile.last_active_at);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      profileLocalDate = `${year}-${month}-${day}`;
    }
  }
  
  if (profileLocalDate && profileLocalDate !== today) {
    profile.daily_games_played = 0;
  }
  profile._lastActiveDate = today;
}

async function onScoreSubmitted(result) {
  if (result && result.updatedScores && currentProfile) {
    currentProfile.scores = result.updatedScores;
    currentProfile.current_streak = result.current_streak || currentProfile.current_streak || 0;
    checkAndResetDailyGoal(currentProfile);
    currentProfile.daily_games_played = (currentProfile.daily_games_played || 0) + 1;
    cacheProfile(currentProfile.anonymous_user_id, currentProfile);
    renderGames(currentProfile);
    renderRating(currentProfile);
    renderRadarChart(currentProfile);
    renderDailyTracker(currentProfile);
    renderStreak(currentProfile);
    renderOverlayProfile(currentProfile);
    ticker.pushMessage(`Anonymous profile crossed ${currentProfile.scores.memory} memory!`);
  }
}

async function bootstrapProfile() {
  const uid = getOrCreateAnonymousUserId();
  const cached = loadCachedProfile(uid);

  if (cached) {
    checkAndResetDailyGoal(cached);
    currentProfile = cached;
    renderGames(currentProfile);
    renderRating(currentProfile);
    renderRadarChart(currentProfile);
    renderDailyTracker(currentProfile);
    renderStreak(currentProfile);
    renderOverlayProfile(currentProfile);
  }

  try {
    let profile;
    if (cached) {
      // If we have cached profile locally, it means we already registered.
      // Call GET first to avoid unnecessary POST 409 network conflict logs in console.
      try {
        profile = await api.getProfile(uid);
      } catch (err) {
        if (err && err.status === 404) {
          // If the profile was deleted from server or not found, recreate it.
          profile = await api.createProfile(uid);
        } else {
          throw err;
        }
      }
    } else {
      // New user, POST to create it.
      profile = await api.createProfile(uid).catch(async (err) => {
        if (err && err.status === 409) {
          return await api.getProfile(uid);
        }
        throw err;
      });
    }
    currentProfile = profile;
    checkAndResetDailyGoal(currentProfile);
    cacheProfile(uid, currentProfile);
    renderGames(currentProfile);
    renderRating(currentProfile);
    renderRadarChart(currentProfile);
    renderDailyTracker(currentProfile);
    renderStreak(currentProfile);
    renderOverlayProfile(currentProfile);
    hideOfflineBanner();
    // Drain offline queue if any.
    try { await api.flushPendingScores(); } catch (_) { /* ignore */ }
  } catch (err) {
    console.warn('[MindFlex] Profile bootstrap failed; staying in offline mode.', err);
    showOfflineBanner();
  }
}

function showOfflineBanner() {
  const banner = document.getElementById('mf-offline');
  if (!banner) return;
  banner.textContent = 'Offline mode — your scores will sync when the connection returns.';
  banner.classList.add('mf-offline--visible');
  if (offlineBannerTimer) clearTimeout(offlineBannerTimer);
  offlineBannerTimer = setTimeout(hideOfflineBanner, 6000);
}

function hideOfflineBanner() {
  const banner = document.getElementById('mf-offline');
  if (banner) banner.classList.remove('mf-offline--visible');
}

async function handleRestore(recoveryToken) {
  try {
    const profile = await api.restoreProfile(recoveryToken);
    swapAnonymousUserId(profile.anonymous_user_id);
    checkAndResetDailyGoal(profile);
    cacheProfile(profile.anonymous_user_id, profile);
    currentProfile = profile;
    renderGames(currentProfile);
    renderRating(currentProfile);
    renderRadarChart(currentProfile);
    renderDailyTracker(currentProfile);
    renderStreak(currentProfile);
    renderOverlayProfile(currentProfile);
    overlay && overlay.hide();
    window.location.reload();
  } catch (err) {
    overlay && overlay.setImportError(
      err && err.status === 404
        ? 'Invalid Recovery Token. Please verify and try again.'
        : 'Unable to restore profile. Please try again later.'
    );
  }
}

async function handleDeleteAll() {
  if (!currentProfile) return;
  const uid = currentProfile.anonymous_user_id;
  try {
    await api.deleteProfile(uid);
  } catch (err) {
    console.warn('[MindFlex] Delete API call failed; clearing locally.', err);
  }
  // Hard wipe per PRD §13.3
  clearCachedProfile(uid);
  const fresh = generateUUID();
  swapAnonymousUserId(fresh);
  currentProfile = null;
  overlay && overlay.hide();
  window.location.reload();
}

function bindGlobalUi() {
  // Sidebar hamburger
  const menuBtn = document.getElementById('mf-menu-button');
  const sidebar = document.getElementById('mf-sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('mf-sidebar--open'));
  }
  // Sidebar filters
  document.querySelectorAll('[data-mf-filter]').forEach(el => {
    el.addEventListener('change', applySidebarFilters);
  });
  // Pill filters in main
  document.querySelectorAll('[data-mf-pill]').forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.dataset.mfPill;
      const checkbox = document.querySelector(`[data-mf-filter="${cat}"]`);
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        applySidebarFilters();
      }
    });
  });
  // Avatar opens profile overlay
  const avatar = document.getElementById('mf-avatar');
  if (avatar) {
    avatar.addEventListener('click', () => overlay && overlay.show());
  }
  // Back-to-lobby button in stage header
  const backBtn = document.getElementById('mf-stage-back');
  if (backBtn) {
    backBtn.addEventListener('click', closeGameStage);
  }
  // Initialize filter active classes on boot
  applySidebarFilters();
}

function boot() {
  const overlayRoot = document.getElementById('mf-overlay');
  overlay = new ProfileOverlay(overlayRoot, {
    onRestore: handleRestore,
    onDeleteAll: handleDeleteAll,
  });

  const tickerTrack = document.querySelector('.mf-topbar__ticker-track');
  ticker = new Ticker(tickerTrack);
  ticker.start();

  // Always-on origin-rejection listener for security (FT-SSB-02). This is
  // distinct from the per-stage listener that is installed when a game
  // iframe is mounted.
  if (!bridgeCtl) {
    bridgeCtl = installBridgeListener({
      onGameOver: async (env) => {
        const uid = getOrCreateAnonymousUserId();
        const targetGameId = currentGameId || 'flashmatrix';
        updateBestScore(targetGameId, env.score);
        try {
          const result = await dispatchGameOver(uid, targetGameId, env, (u, n, p) => api.submitGameScore(u, n, p));
          await onScoreSubmitted(result);
        } catch (err) {
          console.warn('[MindFlex] Score submission deferred.', err);
        } finally {
          if (currentGameId) closeGameStage();
        }
      },
      onHandshake: () => { /* lobby is not awaiting a handshake */ },
      onHandshakeTimeout: () => { /* lobby is not awaiting a handshake */ },
    });
  }

  bindGlobalUi();
  bootstrapProfile();
  // Expose a small API for tests / debugging.
  window.MindFlexHost = {
    bootstrapProfile,
    getProfile: () => currentProfile,
    openGameStage,
    closeGameStage,
    dispatchGameOver,
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
