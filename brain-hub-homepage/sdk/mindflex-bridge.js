/*!
 * mindflex-bridge.js
 * Standardized sandbox communication SDK for MindFlex sub-games.
 *
 * Spec sources:
 *   - docs/PRD.md §11.2 (Communication client)
 *   - docs/Architecture.md §4.2 (Explicit Target Origin Communication)
 *   - docs/Acceptance-Criteria.md §3 (Sandbox Bridge Integration)
 *   - docs/Test-Strategy.md AUD-04 (5-second handshake timeout fallback)
 *
 * Public API:
 *   window.MindFlexBridge.emitGameScore(score, details)
 *   window.MindFlexBridge.onReady(fn)
 *
 * The bridge resolves `window.location.origin` at CALL time, never at load
 * time, so games deployed under any Cloudflare Pages origin still post
 * to the right host.
 */
(function (global) {
  'use strict';

  var HANDSHAKE_TYPE = 'MINDFLEX_BRIDGE_READY';
  var GAME_OVER_TYPE = 'MINDFLEX_GAME_OVER';

  function getTargetOrigin() {
    // Spec: AC-3.2 — dynamically resolved to match the current lobby origin.
    if (global.location && typeof global.location.origin === 'string' &&
        global.location.origin !== 'null' && global.location.origin.length > 0) {
      return global.location.origin;
    }
    return '*';
  }

  function isParentAvailable() {
    return !!global.parent && global.parent !== global;
  }

  function safePost(payload) {
    if (!isParentAvailable()) {
      console.warn('[MindFlexBridge] No parent window available; message dropped.');
      return false;
    }
    var targetOrigin = getTargetOrigin();
    try {
      global.parent.postMessage(payload, targetOrigin);
      return true;
    } catch (err) {
      console.warn('[MindFlexBridge] postMessage failed:', err);
      return false;
    }
  }

  function clampInt(v, min, max) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function clampFloat(v, min, max) {
    var n = parseFloat(v);
    if (isNaN(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /**
   * Emit a standardized game-over payload.
   *
   * Spec: docs/PRD.md §11.2 envelope:
   *   {
   *     type: 'MINDFLEX_GAME_OVER',
   *     payload: {
   *       score: <int>,
   *       timestamp: <ms>,
   *       details: {
   *         accuracy: <0..1>,
   *         responseTimeMs: <int>,
   *         roundsCompleted: <int>,
   *         rawMetrics: {}
   *       }
   *     }
   *   }
   *
   * @param {number} score      The final game score (>= 0).
   * @param {object} details    Detail block (accuracy, responseTimeMs, etc).
   * @returns {boolean}         Whether the message was sent successfully.
   */
  function emitGameScore(score, details) {
    var d = details || {};
    var payload = {
      score: clampInt(score, 0, 1000),
      timestamp: Date.now(),
      details: {
        accuracy: clampFloat(d.accuracy, 0, 1),
        responseTimeMs: clampInt(d.responseTimeMs, 0, 24 * 60 * 60 * 1000),
        roundsCompleted: clampInt(d.roundsCompleted, 0, 1e9),
        rawMetrics: (d.rawMetrics && typeof d.rawMetrics === 'object') ? d.rawMetrics : {}
      }
    };
    return safePost({ type: GAME_OVER_TYPE, payload: payload });
  }

  /**
   * Announce readiness to the parent host. The host starts a 5-second
   * handshake timeout (Test-Strategy.md AUD-04) when the iframe loads;
   * receiving this message resets that timer and removes the failure overlay.
   *
   * @returns {boolean}  Whether the handshake was sent.
   */
  function announceReady() {
    return safePost({
      type: HANDSHAKE_TYPE,
      payload: { version: '0.1.0', ua: (global.navigator && global.navigator.userAgent) || '' }
    });
  }

  /**
   * Register a callback to be invoked when the SDK is ready.
   * Currently a no-op (used by templates that want to defer init until the
   * SDK script has executed). Provided for forward compatibility.
   */
  function onReady(fn) {
    if (typeof fn === 'function') {
      try { fn(); } catch (e) { console.warn('[MindFlexBridge] onReady callback threw:', e); }
    }
  }

  // Expose API
  global.MindFlexBridge = {
    emitGameScore: emitGameScore,
    announceReady: announceReady,
    onReady: onReady,
    HANDSHAKE_TYPE: HANDSHAKE_TYPE,
    GAME_OVER_TYPE: GAME_OVER_TYPE
  };

  // Auto-announce when the SDK finishes loading inside the iframe.
  // Host listener has its own 5-second fallback (AUD-04) so it's safe to
  // attempt this even if the parent is not actually a MindFlex host.
  try { announceReady(); } catch (e) { /* swallow */ }
})(typeof window !== 'undefined' ? window : this);
