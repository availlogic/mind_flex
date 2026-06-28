/* Flash Matrix — pure game logic.
 *
 * Exposed so unit tests can run without a browser. The runtime HTML
 * loads `game.js`, which uses these helpers.
 */

export const DEFAULT_GRID_SIZE = 4; // 4x4 = 16 cells
export const FLASH_DURATION_MS = 700;
export const FLASH_GAP_MS = 250;
export const STARTING_SEQUENCE_LENGTH = 2;

/**
 * Generate a sequence of cell indices for round `r` (1-based).
 * Sequence length = STARTING_SEQUENCE_LENGTH + (r - 1) = r + 1
 */
export function generateSequence(r, gridSize = DEFAULT_GRID_SIZE, { noImmediateRepeat = true } = {}) {
  const total = gridSize * gridSize;
  const length = r + 1;
  const out = [];
  let last = -1;
  for (let i = 0; i < length; i++) {
    let next;
    let attempts = 0;
    do {
      next = Math.floor(Math.random() * total);
      attempts++;
    } while (noImmediateRepeat && next === last && attempts < 8);
    out.push(next);
    last = next;
  }
  return out;
}

/**
 * Compare an expected cell index to the cell the user clicked.
 */
export function evaluateClick({ expectedIndex, clickIndex, startedAtMs, nowMs }) {
  return {
    isCorrect: clickIndex === expectedIndex,
    latencyMs: Math.max(0, Math.round(nowMs - startedAtMs)),
  };
}

/**
 * Compute the final score (0..1000) for a session.
 * Inputs:
 *   - totalClicks, correctClicks  -> accuracy derived if not provided
 *   - accuracy                    -> 0..1 (caller may pass this directly)
 *   - averageLatencyMs            -> mean click latency
 *   - roundsCompleted             -> rounds the player survived
 */
export function computeFinalScore({
  totalClicks = 0,
  correctClicks = 0,
  accuracy = null,
  averageLatencyMs = 0,
  roundsCompleted = 0,
} = {}) {
  if (roundsCompleted <= 0 || totalClicks <= 0) return 0;
  const acc = accuracy != null
    ? accuracy
    : (correctClicks / totalClicks);
  // Base: 400 (rounds) + 400 (accuracy) - up to 200 penalty for slow clicks.
  const roundsContribution = Math.min(400, roundsCompleted * 35);
  const accuracyContribution = Math.max(0, Math.min(400, acc * 400));
  const speedPenalty = Math.min(200, Math.max(0, (averageLatencyMs - 200) / 8));
  let score = roundsContribution + accuracyContribution - speedPenalty;
  score = Math.round(Math.max(0, Math.min(1000, score)));
  return score;
}
