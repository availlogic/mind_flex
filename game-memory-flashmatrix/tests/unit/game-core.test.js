import { describe, it, expect } from 'vitest';
import {
  generateSequence,
  evaluateClick,
  computeFinalScore,
  DEFAULT_GRID_SIZE,
} from '../../game-core.js';

describe('generateSequence', () => {
  it('returns length r+1 starting at length 2', () => {
    for (let r = 1; r < 8; r++) {
      const seq = generateSequence(r, DEFAULT_GRID_SIZE);
      expect(seq).toHaveLength(r + 1);
    }
  });

  it('every element is a valid cell index', () => {
    const seq = generateSequence(5, DEFAULT_GRID_SIZE);
    for (const idx of seq) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE);
    }
  });

  it('does not produce obvious immediate repeats that would defeat the memory test', () => {
    const seq = generateSequence(5, DEFAULT_GRID_SIZE, { noImmediateRepeat: true });
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).not.toBe(seq[i - 1]);
    }
  });
});

describe('evaluateClick', () => {
  it('reports correct when expected matches click', () => {
    const r = evaluateClick({ expectedIndex: 3, clickIndex: 3, startedAtMs: 0, nowMs: 200 });
    expect(r.isCorrect).toBe(true);
    expect(r.latencyMs).toBe(200);
  });

  it('reports incorrect when expected != click', () => {
    const r = evaluateClick({ expectedIndex: 3, clickIndex: 5, startedAtMs: 0, nowMs: 200 });
    expect(r.isCorrect).toBe(false);
    expect(r.latencyMs).toBe(200);
  });
});

describe('computeFinalScore', () => {
  it('returns 0 for an empty result', () => {
    expect(computeFinalScore({ totalClicks: 0, correctClicks: 0, accuracy: 0, averageLatencyMs: 0, roundsCompleted: 0 })).toBe(0);
  });

  it('rewards accuracy and penalizes latency', () => {
    const fast = computeFinalScore({ totalClicks: 10, correctClicks: 10, accuracy: 1.0, averageLatencyMs: 200, roundsCompleted: 10 });
    const slow = computeFinalScore({ totalClicks: 10, correctClicks: 10, accuracy: 1.0, averageLatencyMs: 2000, roundsCompleted: 10 });
    expect(fast).toBeGreaterThan(slow);
  });

  it('rewards more completed rounds', () => {
    const more = computeFinalScore({ totalClicks: 12, correctClicks: 12, accuracy: 1.0, averageLatencyMs: 200, roundsCompleted: 12 });
    const less = computeFinalScore({ totalClicks: 10, correctClicks: 10, accuracy: 1.0, averageLatencyMs: 200, roundsCompleted: 10 });
    expect(more).toBeGreaterThan(less);
  });

  it('caps the final score at 1000', () => {
    const huge = computeFinalScore({ totalClicks: 1000, correctClicks: 1000, accuracy: 1.0, averageLatencyMs: 100, roundsCompleted: 50 });
    expect(huge).toBeLessThanOrEqual(1000);
  });

  it('returns a number within [0, 1000] for realistic inputs', () => {
    const v = computeFinalScore({ totalClicks: 10, correctClicks: 9, accuracy: 0.9, averageLatencyMs: 350, roundsCompleted: 10 });
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1000);
  });
});
