/* Flash Matrix — runtime game loop
 *
 * Loads the host's mindflex-bridge.js SDK (already on the page) and posts a
 * MINDFLEX_GAME_OVER envelope when the session ends.
 *
 * Spec:
 *   docs/PRD.md §11.2 (Standardized Sub-Game Stage)
 *   docs/Acceptance-Criteria.md §2 (Aspect-Locked Game Viewport)
 *   docs/Functional-Test-Cases.md FT-SSB-01
 */

import {
  generateSequence,
  evaluateClick,
  computeFinalScore,
  DEFAULT_GRID_SIZE,
  FLASH_DURATION_MS,
  FLASH_GAP_MS,
} from './game-core.js';

const COLORS = {
  bg:       'hsl(222, 24%, 7%)',
  cell:     'hsl(223, 20%, 12%)',
  border:   'hsl(223, 14%, 20%)',
  flash:    'hsl(180, 100%, 50%)',
  correct:  'hsl(145, 100%, 50%)',
  wrong:    'hsl(355, 100%, 60%)',
  text:     'hsl(210, 40%, 98%)',
};

const STATE = {
  IDLE: 'idle',
  FLASHING: 'flashing',
  INPUT: 'input',
  GAME_OVER: 'game_over',
};

const game = {
  state: STATE.IDLE,
  round: 0,
  sequence: [],
  expectedIdx: 0,
  clicks: [],
  roundStartMs: 0,
  cellSize: 0,
  canvas: null,
  ctx: null,
  audio: { muted: false },
  bestScore: Number(localStorage.getItem('flashmatrix_best') || 0),
};

function $(id) { return document.getElementById(id); }

function setStatus(msg) { $('fm-status').textContent = msg; }
function setRound(n) { $('fm-round').textContent = `Round ${n}`; }
function setBest(s) {
  game.bestScore = Math.max(game.bestScore, s);
  localStorage.setItem('flashmatrix_best', String(game.bestScore));
  $('fm-best').textContent = `Best: ${s}`;
}

function resizeCanvas() {
  const c = game.canvas;
  const rect = c.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(rect.height * dpr);
  game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.cellSize = Math.floor(Math.min(rect.width, rect.height) / DEFAULT_GRID_SIZE);
  drawGrid();
}

function cellRect(index) {
  const total = game.cellSize * DEFAULT_GRID_SIZE;
  const r = Math.floor(index / DEFAULT_GRID_SIZE);
  const col = index % DEFAULT_GRID_SIZE;
  const offsetX = (game.canvas.clientWidth - total) / 2;
  const offsetY = (game.canvas.clientHeight - total) / 2;
  return {
    x: offsetX + col * game.cellSize,
    y: offsetY + r * game.cellSize,
    w: game.cellSize,
    h: game.cellSize,
  };
}

function drawGrid(flashIndex = -1, flashColor = COLORS.flash) {
  const ctx = game.ctx;
  const W = game.canvas.clientWidth;
  const H = game.canvas.clientHeight;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE; i++) {
    const { x, y, w, h } = cellRect(i);
    ctx.fillStyle = i === flashIndex ? flashColor : COLORS.cell;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }
}

function flashSequence(seq) {
  return new Promise(resolve => {
    let i = 0;
    function step() {
      if (i >= seq.length) {
        drawGrid();
        return resolve();
      }
      drawGrid(seq[i], COLORS.flash);
      setTimeout(() => {
        drawGrid();
        i++;
        setTimeout(step, FLASH_GAP_MS);
      }, FLASH_DURATION_MS);
    }
    step();
  });
}

function startNextRound() {
  game.round += 1;
  setRound(game.round);
  game.sequence = generateSequence(game.round, DEFAULT_GRID_SIZE);
  game.expectedIdx = 0;
  game.state = STATE.FLASHING;
  setStatus(`Watch the sequence (${game.sequence.length})...`);
  flashSequence(game.sequence).then(() => {
    game.state = STATE.INPUT;
    game.roundStartMs = performance.now();
    setStatus('Your turn. Tap the cells in order.');
  });
}

function endSession(reason) {
  game.state = STATE.GAME_OVER;
  const totalClicks = game.clicks.length;
  const correctClicks = game.clicks.filter(c => c.isCorrect).length;
  const accuracy = totalClicks > 0 ? correctClicks / totalClicks : 0;
  const avgLatency = totalClicks > 0
    ? Math.round(game.clicks.reduce((s, c) => s + c.latencyMs, 0) / totalClicks)
    : 0;
  const roundsCompleted = game.round;
  const score = computeFinalScore({
    totalClicks,
    correctClicks,
    accuracy,
    averageLatencyMs: avgLatency,
    roundsCompleted,
  });
  setStatus(reason || `Game over — score ${score}!`);
  setBest(score);
  $('fm-start').textContent = 'Start';
  $('fm-start').disabled = false;
  $('fm-retry').disabled = false;

  const payload = {
    score,
    accuracy,
    responseTimeMs: avgLatency,
    roundsCompleted,
    rawMetrics: {
      clicks: game.clicks.map((c, i) => ({
        roundNumber: c.round,
        clickSequence: i + 1,
        isCorrect: c.isCorrect,
        latencyMs: c.latencyMs,
      })),
    },
  };
  if (window.MindFlexBridge && typeof window.MindFlexBridge.emitGameScore === 'function') {
    window.MindFlexBridge.emitGameScore(score, payload);
  } else {
    console.warn('[FlashMatrix] MindFlexBridge not available; cannot report score.');
  }
}

function handlePointer(e) {
  if (game.state !== STATE.INPUT) return;
  const c = game.canvas;
  const rect = c.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const total = game.cellSize * DEFAULT_GRID_SIZE;
  const offsetX = (rect.width - total) / 2;
  const offsetY = (rect.height - total) / 2;
  if (x < offsetX || x >= offsetX + total || y < offsetY || y >= offsetY + total) return;
  const col = Math.floor((x - offsetX) / game.cellSize);
  const row = Math.floor((y - offsetY) / game.cellSize);
  const clicked = row * DEFAULT_GRID_SIZE + col;
  const expected = game.sequence[game.expectedIdx];
  const result = evaluateClick({
    expectedIndex: expected,
    clickIndex: clicked,
    startedAtMs: game.roundStartMs,
    nowMs: performance.now(),
  });
  result.round = game.round;
  game.clicks.push(result);
  drawGrid(clicked, result.isCorrect ? COLORS.correct : COLORS.wrong);
  setTimeout(drawGrid, 220);

  if (!result.isCorrect) {
    return endSession('Wrong cell — game over!');
  }
  game.expectedIdx += 1;
  if (game.expectedIdx >= game.sequence.length) {
    setStatus('Correct! Next round...');
    setTimeout(startNextRound, 600);
  }
}

function startGame() {
  game.state = STATE.IDLE;
  game.round = 0;
  game.sequence = [];
  game.expectedIdx = 0;
  game.clicks = [];
  $('fm-start').textContent = 'Playing...';
  $('fm-start').disabled = true;
  $('fm-retry').disabled = true;
  setRound(0);
  setStatus('Get ready...');
  setTimeout(startNextRound, 600);
}

function bindControls() {
  $('fm-start').addEventListener('click', startGame);
  $('fm-retry').addEventListener('click', startGame);
  const muteBtn = $('fm-mute');
  muteBtn.addEventListener('click', () => {
    game.audio.muted = !game.audio.muted;
    muteBtn.textContent = `Sound: ${game.audio.muted ? 'Off' : 'On'}`;
    muteBtn.setAttribute('aria-pressed', String(game.audio.muted));
  });
  game.canvas.addEventListener('pointerdown', handlePointer);
  window.addEventListener('resize', resizeCanvas);
}

function boot() {
  game.canvas = $('fm-canvas');
  game.ctx = game.canvas.getContext('2d');
  setBest(0);  // displays stored best
  resizeCanvas();
  bindControls();
  // The host bridge sends a HANDSHAKE_READY on load (mindflex-bridge.js).
  // If the SDK isn't present (degraded env), we still want to function locally.
  setStatus('Press Start to begin.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
