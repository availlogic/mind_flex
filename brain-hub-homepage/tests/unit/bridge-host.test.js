import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://maxithome.com/' });
global.window = dom.window;
global.document = dom.window.document;

import {
  installBridgeListener,
  dispatchGameOver,
  GAME_OVER_TYPE,
  HANDSHAKE_TYPE,
  HANDSHAKE_TIMEOUT_MS,
} from '../../js/bridge-host.js';

function fireMessage(origin, type, payload) {
  const event = new dom.window.MessageEvent('message', {
    origin,
    data: { type, payload },
  });
  dom.window.dispatchEvent(event);
}

describe('installBridgeListener', () => {
  it('invokes onGameOver for MINDFLEX_GAME_OVER from the matching origin', () => {
    const onGameOver = vi.fn();
    const ctl = installBridgeListener({ onGameOver });
    fireMessage('https://maxithome.com', GAME_OVER_TYPE, { score: 850, details: {} });
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(onGameOver.mock.calls[0][0].score).toBe(850);
    ctl.stop();
  });

  it('blocks MINDFLEX_GAME_OVER from foreign origins (FT-SSB-02)', () => {
    const onGameOver = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctl = installBridgeListener({ onGameOver });
    fireMessage('https://malicious-site.com', GAME_OVER_TYPE, { score: 9999 });
    expect(onGameOver).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    ctl.stop();
  });

  it('invokes onHandshake when a matching MINDFLEX_BRIDGE_READY arrives', () => {
    const onHandshake = vi.fn();
    const ctl = installBridgeListener({ onHandshake });
    fireMessage('https://maxithome.com', HANDSHAKE_TYPE, { version: '0.1.0' });
    expect(onHandshake).toHaveBeenCalled();
    ctl.stop();
  });

  it('invokes onHandshakeTimeout after the configured timeout (AUD-04)', async () => {
    vi.useFakeTimers();
    const onHandshakeTimeout = vi.fn();
    const ctl = installBridgeListener({ onHandshakeTimeout });
    ctl.startHandshakeTimer();
    vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS + 100);
    expect(onHandshakeTimeout).toHaveBeenCalledWith('handshake_timeout');
    vi.useRealTimers();
    ctl.stop();
  });

  it('does not invoke onHandshakeTimeout if handshake arrives in time', () => {
    vi.useFakeTimers();
    const onHandshake = vi.fn();
    const onHandshakeTimeout = vi.fn();
    const ctl = installBridgeListener({ onHandshake, onHandshakeTimeout });
    ctl.startHandshakeTimer();
    vi.advanceTimersByTime(1000);
    fireMessage('https://maxithome.com', HANDSHAKE_TYPE, {});
    expect(onHandshake).toHaveBeenCalled();
    vi.advanceTimersByTime(HANDSHAKE_TIMEOUT_MS);
    expect(onHandshakeTimeout).not.toHaveBeenCalled();
    vi.useRealTimers();
    ctl.stop();
  });

  it('ignores payloads with non-object data', () => {
    const onGameOver = vi.fn();
    const ctl = installBridgeListener({ onGameOver });
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
      origin: 'https://maxithome.com',
      data: 'just-a-string',
    }));
    expect(onGameOver).not.toHaveBeenCalled();
    ctl.stop();
  });

  it('removes its handler on stop()', () => {
    const onGameOver = vi.fn();
    const ctl = installBridgeListener({ onGameOver });
    ctl.stop();
    fireMessage('https://maxithome.com', GAME_OVER_TYPE, { score: 100 });
    expect(onGameOver).not.toHaveBeenCalled();
  });
});

describe('dispatchGameOver', () => {
  it('forwards the envelope to the provided submitter', async () => {
    const submitter = vi.fn().mockResolvedValue({ updatedScores: { memory: 100 } });
    await dispatchGameOver('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'flashmatrix', {
      score: 720,
      details: { accuracy: 0.9, responseTimeMs: 280, roundsCompleted: 5, rawMetrics: { clicks: [] } },
    }, submitter);
    expect(submitter).toHaveBeenCalledTimes(1);
    const [_uid, name, body] = submitter.mock.calls[0];
    expect(name).toBe('flashmatrix');
    expect(body.score).toBe(720);
    expect(body.accuracy).toBe(0.9);
    expect(body.responseTimeMs).toBe(280);
    expect(body.roundsCompleted).toBe(5);
  });
});
