import { defineConfig } from '@playwright/test';
import { mkdirSync, cpSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname);
const STAGE_DIR = '/tmp/mindflex-e2e-stage';
const SDK_SRC = resolve(ROOT, 'sdk/mindflex-bridge.js');
const DASH_SRC = resolve(ROOT, 'index.html');
const STYLES_SRC = resolve(ROOT, 'styles');
const JS_SRC = resolve(ROOT, 'js');
const GAME_SRC = resolve(ROOT, '../game-memory-flashmatrix');

function stage() {
  if (!existsSync(STAGE_DIR)) mkdirSync(STAGE_DIR, { recursive: true });
  // Copy dashboard files
  cpSync(DASH_SRC, resolve(STAGE_DIR, 'index.html'));
  cpSync(STYLES_SRC, resolve(STAGE_DIR, 'styles'), { recursive: true });
  cpSync(JS_SRC, resolve(STAGE_DIR, 'js'), { recursive: true });
  cpSync(SDK_SRC, resolve(STAGE_DIR, 'sdk/mindflex-bridge.js'));
  // Mount the game under /games/memory/flashmatrix to match Cloudflare URL rewrite rules.
  const gameMount = resolve(STAGE_DIR, 'games/memory/flashmatrix');
  if (!existsSync(resolve(gameMount, '..'))) mkdirSync(gameMount, { recursive: true });
  for (const f of ['index.html', 'styles.css', 'game.js', 'game-core.js']) {
    cpSync(resolve(GAME_SRC, f), resolve(gameMount, f));
  }
}

stage();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  webServer: {
    command: `python3 -m http.server 8081 --directory ${STAGE_DIR}`,
    port: 8081,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
