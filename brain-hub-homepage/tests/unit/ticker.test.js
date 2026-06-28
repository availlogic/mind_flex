import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Ticker } from '../../js/ticker.js';

const dom = new JSDOM('<!doctype html><html><body><span class="ticker"></span></body></html>');
global.document = dom.window.document;

describe('Ticker', () => {
  it('renders fallback messages on start', () => {
    const track = document.querySelector('.ticker');
    const t = new Ticker(track);
    t.start();
    expect(track.textContent).toContain('AI');
    t.stop();
  });

  it('rotates custom messages', () => {
    const track = document.querySelector('.ticker');
    const t = new Ticker(track);
    t.setMessages(['One', 'Two']);
    t.start();
    expect(track.textContent).toMatch(/One.*Two/);
    t.stop();
  });

  it('does not crash when starting twice', () => {
    const t = new Ticker(document.querySelector('.ticker'));
    t.start();
    t.start();
    t.stop();
  });
});
