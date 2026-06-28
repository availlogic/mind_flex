/* MindFlex — Chart.js radar with AI Replacement Threat Line
 * Spec:
 *   docs/PRD.md §13.2 (AI Replacement Threat Line values)
 *   docs/Screen-Specs.md §3.3 (Renders ratings: Memory, Focus, Logic, Speed, Spatial)
 *   docs/UI-Layouts.md §4 (Profile Dropdown Overlay)
 *   docs/Visual-Guidelines.md §2.2 (Semantic colors)
 */

const DIMENSIONS = ['Memory', 'Focus', 'Logic', 'Speed', 'Spatial'];

const AI_THREAT = {
  Memory: 800,
  Focus: 750,
  Logic: 850,
  Speed: 800,
  Spatial: 700,
};

const COLOR_BY_DIMENSION = {
  Memory: getComputedStyle(document.documentElement).getPropertyValue('--mf-accent-memory').trim(),
  Focus: getComputedStyle(document.documentElement).getPropertyValue('--mf-accent-focus').trim(),
  Logic: getComputedStyle(document.documentElement).getPropertyValue('--mf-accent-logic').trim(),
  Speed: getComputedStyle(document.documentElement).getPropertyValue('--mf-accent-speed').trim(),
  Spatial: getComputedStyle(document.documentElement).getPropertyValue('--mf-accent-spatial').trim(),
};

export function buildRadarConfig(scores, { dark = true } = {}) {
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const angleLine = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  const ticks = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  return {
    type: 'radar',
    data: {
      labels: DIMENSIONS,
      datasets: [
        {
          label: 'AI Replacement Threat',
          data: DIMENSIONS.map(d => AI_THREAT[d]),
          backgroundColor: 'rgba(255, 36, 71, 0.15)',
          borderColor: 'rgba(255, 36, 71, 0.95)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: true,
          order: 2,
        },
        {
          label: 'You',
          data: DIMENSIONS.map(d => Number(scores[d.toLowerCase()] || 0)),
          backgroundColor: 'rgba(0, 229, 255, 0.18)',
          borderColor: COLOR_BY_DIMENSION.Memory,
          borderWidth: 2,
          pointBackgroundColor: DIMENSIONS.map(d => COLOR_BY_DIMENSION[d]),
          pointBorderColor: '#000',
          pointRadius: 4,
          fill: true,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 350 },
      plugins: {
        legend: { display: false },
      },
      scales: {
        r: {
          min: 0,
          max: 1000,
          ticks: {
            stepSize: 250,
            color: ticks,
            backdropColor: 'transparent',
            font: { family: 'JetBrains Mono, monospace', size: 10 },
          },
          grid: { color: grid },
          angleLines: { color: angleLine },
          pointLabels: {
            color: ticks,
            font: { family: 'Inter, sans-serif', size: 13, weight: '600' },
          },
        },
      },
    },
  };
}

export function renderRadar(canvas, scores, ChartLib) {
  const config = buildRadarConfig(scores || {});
  return new ChartLib(canvas.getContext('2d'), config);
}

export function buildAiThreatOverlay() {
  return AI_THREAT;
}
