import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_PATH = resolve(__dirname, '../../sdk/mindflex-bridge.js');
const SDK_SOURCE = readFileSync(SDK_PATH, 'utf8');

function loadSdk({ origin = 'https://maxithome.com', withParent = true } = {}) {
  // JSDOM-only window setup. Run the SDK with controlled location.origin.
  const sandbox = {
    location: { origin },
    navigator: { userAgent: 'jsdom' },
    parent: withParent ? createMockParent() : null,
    console,
  };
  // Avoid re-running previous announcements: scrub any prior global.
  delete globalThis.MindFlexBridge;
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', SDK_SOURCE);
  fn(sandbox);
  return { bridge: sandbox.MindFlexBridge, sandbox };
}

function createMockParent() {
  const messages = [];
  const parent = {
    postMessage(msg, target) {
      messages.push({ msg, target });
    },
  };
  parent.__messages = messages;
  return parent;
}

describe('mindflex-bridge.js', () => {
  it('exposes the SDK on window.MindFlexBridge', () => {
    const { bridge } = loadSdk();
    expect(bridge).toBeDefined();
    expect(typeof bridge.emitGameScore).toBe('function');
    expect(typeof bridge.announceReady).toBe('function');
    expect(bridge.GAME_OVER_TYPE).toBe('MINDFLEX_GAME_OVER');
    expect(bridge.HANDSHAKE_TYPE).toBe('MINDFLEX_BRIDGE_READY');
  });

  it('posts MINDFLEX_GAME_OVER with the documented envelope shape', () => {
    const { bridge, sandbox } = loadSdk();
    sandbox.parent.__messages.length = 0; // clear handshake

    bridge.emitGameScore(850, {
      accuracy: 0.95,
      responseTimeMs: 320,
      roundsCompleted: 8,
      rawMetrics: { clicks: [1, 2] }
    });

    expect(sandbox.parent.__messages.length).toBe(1);
    const { msg, target } = sandbox.parent.__messages[0];
    expect(target).toBe('https://maxithome.com');
    expect(msg.type).toBe('MINDFLEX_GAME_OVER');
    expect(msg.payload.score).toBe(850);
    expect(msg.payload.timestamp).toBeGreaterThan(0);
    expect(msg.payload.details.accuracy).toBe(0.95);
    expect(msg.payload.details.responseTimeMs).toBe(320);
    expect(msg.payload.details.roundsCompleted).toBe(8);
    expect(msg.payload.details.rawMetrics).toEqual({ clicks: [1, 2] });
  });

  it('always resolves target origin to window.location.origin', () => {
    const { bridge, sandbox } = loadSdk({ origin: 'https://staging.maxithome.com' });
    sandbox.parent.__messages.length = 0;

    bridge.emitGameScore(100, { accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1 });

    expect(sandbox.parent.__messages[0].target).toBe('https://staging.maxithome.com');
  });

  it('clamps score to [0, 1000] range', () => {
    const { bridge, sandbox } = loadSdk();
    sandbox.parent.__messages.length = 0;

    bridge.emitGameScore(99999, { accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1 });
    expect(sandbox.parent.__messages[0].msg.payload.score).toBe(1000);

    bridge.emitGameScore(-50, { accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1 });
    expect(sandbox.parent.__messages[1].msg.payload.score).toBe(0);
  });

  it('clamps accuracy to [0, 1] range', () => {
    const { bridge, sandbox } = loadSdk();
    sandbox.parent.__messages.length = 0;

    bridge.emitGameScore(100, { accuracy: 5.0, responseTimeMs: 200, roundsCompleted: 1 });
    expect(sandbox.parent.__messages[0].msg.payload.details.accuracy).toBe(1);

    bridge.emitGameScore(100, { accuracy: -1, responseTimeMs: 200, roundsCompleted: 1 });
    expect(sandbox.parent.__messages[1].msg.payload.details.accuracy).toBe(0);
  });

  it('auto-announces readiness on load (AUD-04)', () => {
    const { sandbox } = loadSdk();
    const handshakes = sandbox.parent.__messages.filter(m => m.msg.type === 'MINDFLEX_BRIDGE_READY');
    expect(handshakes.length).toBe(1);
    expect(handshakes[0].target).toBe('https://maxithome.com');
  });

  it('does not throw when no parent is available', () => {
    const { bridge } = loadSdk({ withParent: false });
    expect(() => bridge.emitGameScore(100, { accuracy: 0.5, responseTimeMs: 200, roundsCompleted: 1 })).not.toThrow();
    expect(() => bridge.announceReady()).not.toThrow();
  });

  it('treats missing details as defaults rather than throwing', () => {
    const { bridge, sandbox } = loadSdk();
    sandbox.parent.__messages.length = 0;
    expect(() => bridge.emitGameScore(100)).not.toThrow();
    const m = sandbox.parent.__messages[0].msg;
    expect(m.payload.details.accuracy).toBe(0);
    expect(m.payload.details.responseTimeMs).toBe(0);
    expect(m.payload.details.roundsCompleted).toBe(0);
    expect(m.payload.details.rawMetrics).toEqual({});
  });

  it('does not pass raw user-supplied values into postMessage without sanitization', () => {
    const { bridge, sandbox } = loadSdk();
    sandbox.parent.__messages.length = 0;
    // Score above 1000 should be clamped, not passed through.
    bridge.emitGameScore(Number.MAX_SAFE_INTEGER, {
      accuracy: 'not-a-number',
      responseTimeMs: 'oops',
      roundsCompleted: 'huh',
      rawMetrics: 'not-an-object',
    });
    const m = sandbox.parent.__messages[0].msg;
    expect(typeof m.payload.score).toBe('number');
    expect(m.payload.score).toBeLessThanOrEqual(1000);
    expect(typeof m.payload.details.accuracy).toBe('number');
    expect(typeof m.payload.details.responseTimeMs).toBe('number');
    expect(typeof m.payload.details.roundsCompleted).toBe('number');
    expect(m.payload.details.rawMetrics).toEqual({});
  });
});
