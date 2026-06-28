/* MindFlex — Host-side bridge listener
 * Spec:
 *   docs/Architecture.md §4.1 (Strict Same-Origin Sandboxing)
 *   docs/PRD.md §12.2 (Iframe Origin Enforcement)
 *   docs/Functional-Test-Cases.md FT-SSB-01, FT-SSB-02
 *   docs/Test-Strategy.md AUD-04 (5-second handshake timeout fallback)
 */

import { submitGameScore } from './api-client.js';

export const GAME_OVER_TYPE = 'MINDFLEX_GAME_OVER';
export const HANDSHAKE_TYPE = 'MINDFLEX_BRIDGE_READY';

export const HANDSHAKE_TIMEOUT_MS = 5000;

/**
 * Install the postMessage listener on the host window.
 *
 * @param {object} callbacks
 * @param {(envelope:object) => void} callbacks.onGameOver  Invoked when a
 *        trusted MINDFLEX_GAME_OVER message is received.
 * @param {() => void} [callbacks.onHandshake]              Invoked when a
 *        trusted MINDFLEX_BRIDGE_READY is received.
 * @param {(reason:string) => void} [callbacks.onHandshakeTimeout]
 *        Invoked when no handshake is received within HANDSHAKE_TIMEOUT_MS
 *        after `startHandshakeTimer()` is called.
 * @returns {{stop: () => void, startHandshakeTimer: () => void}}
 */
export function installBridgeListener(callbacks) {
  function handler(event) {
    // FT-SSB-02 — explicit origin check.
    if (event.origin !== window.location.origin) {
      console.warn('Blocked untrusted message origin:', event.origin);
      return;
    }
    const data = event.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

    if (data.type === GAME_OVER_TYPE && data.payload) {
      callbacks.onGameOver && callbacks.onGameOver({
        score: Number(data.payload.score) || 0,
        timestamp: data.payload.timestamp,
        details: data.payload.details || {},
        sourceOrigin: event.origin,
        sourceWindow: event.source,
      });
      return;
    }
    if (data.type === HANDSHAKE_TYPE) {
      callbacks.onHandshake && callbacks.onHandshake();
      return;
    }
  }

  window.addEventListener('message', handler);

  let timer = null;
  function startHandshakeTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      callbacks.onHandshakeTimeout &&
        callbacks.onHandshakeTimeout('handshake_timeout');
    }, HANDSHAKE_TIMEOUT_MS);
  }
  function stopHandshakeTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  // Wrap the user-supplied onHandshake so it also stops the handshake timer.
  const userOnHandshake = callbacks.onHandshake;
  const wrappedOnHandshake = () => {
    stopHandshakeTimer();
    if (userOnHandshake) userOnHandshake();
  };
  // Replace the reference inside the handler:
  // (handlers above read callbacks.onHandshake; we patch via a getter proxy)
  Object.defineProperty(callbacks, 'onHandshake', {
    configurable: true,
    get: () => wrappedOnHandshake,
  });

  return {
    startHandshakeTimer,
    stopHandshakeTimer,
    stop: () => {
      window.removeEventListener('message', handler);
      stopHandshakeTimer();
    },
  };
}

/**
 * Forward a game-over envelope to the backend API.
 */
export async function dispatchGameOver(uid, gameName, envelope, submitter = submitGameScore) {
  const details = envelope.details || {};
  const payload = {
    score: envelope.score,
    accuracy: Number(details.accuracy) || 0,
    responseTimeMs: Number(details.responseTimeMs) || 0,
    roundsCompleted: Number(details.roundsCompleted) || 0,
    rawMetrics: details.rawMetrics || { clicks: [] },
  };
  return submitter(uid, gameName, payload);
}
