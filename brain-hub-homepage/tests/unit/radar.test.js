import { describe, it, expect } from 'vitest';
import { buildRadarConfig, buildAiThreatOverlay } from '../../js/radar.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

describe('buildAiThreatOverlay', () => {
  it('exposes the documented AI replacement threat values', () => {
    const ai = buildAiThreatOverlay();
    expect(ai).toEqual({
      Memory: 800,
      Focus: 750,
      Logic: 850,
      Speed: 800,
      Spatial: 700,
    });
  });
});

describe('buildRadarConfig', () => {
  it('renders the five required dimensions in order', () => {
    const cfg = buildRadarConfig({});
    expect(cfg.data.labels).toEqual(['Memory', 'Focus', 'Logic', 'Speed', 'Spatial']);
  });

  it('produces a "you" dataset and an "AI threat" dataset', () => {
    const cfg = buildRadarConfig({ memory: 720, focus: 600, logic: 0, speed: 0, spatial: 0 });
    expect(cfg.data.datasets).toHaveLength(2);
    const you = cfg.data.datasets.find(d => d.label === 'You');
    const threat = cfg.data.datasets.find(d => d.label === 'AI Replacement Threat');
    expect(you).toBeDefined();
    expect(threat).toBeDefined();
    expect(you.data).toEqual([720, 600, 0, 0, 0]);
    expect(threat.data).toEqual([800, 750, 850, 800, 700]);
  });

  it('clamps the radar axis to [0, 1000]', () => {
    const cfg = buildRadarConfig({});
    expect(cfg.options.scales.r.min).toBe(0);
    expect(cfg.options.scales.r.max).toBe(1000);
  });
});
