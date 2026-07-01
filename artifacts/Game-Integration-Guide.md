# MindFlex: Sub-Game Development & Integration Guide

This guide explains how to build, test, deploy, and register a new cognitive sub-game from an independent repository into the MindFlex platform. By following this dynamic flow, you can integrate or remove games instantly with **zero changes to the core MindFlex codebase**.

---

## 1. Architectural Concept

MindFlex uses a decoupled, configuration-driven same-origin architecture:
*   **Same-Origin Sandbox**: Games are hosted on their own Cloudflare Pages project (e.g. `game-focus-color-stroop.pages.dev`). The central Cloudflare Worker Router proxies paths like `/games/:category/:game_id/*` to their respective Pages domain. This forces the browser to treat games as same-origin with the host lobby, unlocking access to the root domain's `LocalStorage` (specifically the `anonymous_user_id`).
*   **Dynamic Registry**: The dashboard fetches its active game list dynamically at startup from `/api/v1/games/registry`, which reads directly from a Cloudflare KV namespace. Adding or removing a game is a simple KV key update.
*   **Universal Telemetry**: The telemetry service accepts any game submission at `/api/v1/games/{game_id}/submit` and persists the granular clickstream/metadata into a generic `raw_metrics` JSONB column in `schema_common.game_sessions`.

---

## 2. Setting Up from the Repository Template

To develop a new game, clone the template repository `mindflex-game-template`:

```bash
git clone https://github.com/mindflex-platform/mindflex-game-template.git my-cognitive-game
cd my-cognitive-game
npm install
```

### Template Directory Structure
*   `src/index.html`: Bootstraps the game canvas and pre-loads the dynamic host SDK.
*   `src/main.js`: Contains boilerplate code for registering SDK callbacks and game loops.
*   `src/styles.css`: Establishes essential CSS constraints (ratio locking, disabling zoom/scroll).
*   `test-harness.html`: A mock host container used for testing SDK communications locally.
*   `wrangler.toml`: Configures the Cloudflare Pages output.

---

## 3. Core Development Rules

To ensure compatibility with the host shell, your game must conform to these rules:

### A. Load the host SDK
Always reference the shared SDK from the absolute `/sdk/mindflex-bridge.js` path. The SDK auto-announces readiness when loaded:
```html
<script src="/sdk/mindflex-bridge.js"></script>
```

### B. Submit Score on Game Over
When the game ends, emit the final score and telemetry to the parent shell:
```javascript
if (window.MindFlexBridge && typeof window.MindFlexBridge.emitGameScore === 'function') {
  window.MindFlexBridge.emitGameScore(score, {
    accuracy: accuracy,           // Float between 0.0 and 1.0
    responseTimeMs: avgLatency,  // Average interaction response time in ms
    roundsCompleted: rounds,     // Number of completed rounds/levels
    category: 'focus',           // Category: memory, focus, logic, speed, spatial
    rawMetrics: {                // Detailed session metrics (JSONB)
      clicks: [
        { roundNumber: 1, clickSequence: 1, isCorrect: true, latencyMs: 140 }
      ]
    }
  });
}
```

### C. UX & UI Constraints
*   **No Zoom or Double-Tap delay**: Apply the viewport meta tag and CSS settings (`touch-action: none`, `user-select: none`).
*   **Aspect Ratio Lock (Letterboxing)**: For proportion-sensitive games, lock the stage container aspect-ratio:
    ```css
    .game-container {
      aspect-ratio: 1 / 1;
      max-width: 100%;
      max-height: 100%;
      margin: auto;
    }
    ```
*   **Touch Targets**: Interactive target elements (buttons, cells) must be at least **44x44px**.
*   **Pointerdown Listening**: Bind game interactions to `pointerdown` instead of `click` for a sub-15ms response.

---

## 4. Local Testing

Open `test-harness.html` in your browser via a local development server:

```bash
npm run dev
# Then navigate to http://localhost:5173/test-harness.html
```

The test harness loads your game in a sandboxed iframe, listens to `postMessage` outputs, and renders a debugger HUD displaying the payload sent by the game. Verify that the SDK handshake succeeds and the final score payload maps correctly.

---

## 5. Deployment to Cloudflare Pages

Build your project and deploy the build directory to Cloudflare Pages.
The Pages project name must strictly follow the pattern: **`game-[category]-[game_id]`** (e.g. `game-focus-color-stroop`).

```bash
npm run build
wrangler pages deploy dist --project-name=game-focus-color-stroop
```

---

## 6. Dynamic Registration (Hot Swapping)

To register and make the game visible in the MindFlex lobby instantly:

### Step 1: Update your local `games.json`
Add the new game object metadata to your `games.json` file:
```json
[
  {
    "id": "flashmatrix",
    "title": "Flash Matrix",
    "category": "memory",
    "categoryLabel": "Memory",
    "path": "/games/memory/flashmatrix/index.html",
    "difficulty": "Medium",
    "icon": "▣"
  },
  {
    "id": "color-stroop",
    "title": "Color Stroop",
    "category": "focus",
    "categoryLabel": "Focus",
    "path": "/games/focus/color-stroop/index.html",
    "difficulty": "Hard",
    "icon": "◐"
  }
]
```

### Step 2: Upload to Cloudflare KV via Wrangler CLI
Execute the wrangler CLI command to push the registry JSON configuration (ensure you add `--remote` to upload to the live Cloudflare environment instead of the local dev sandbox):

```bash
# From the project root directory
wrangler kv key put --config wrangler-router.toml --binding=MINDFLEX_REGISTRY --remote "games_list" "$(cat games.json)"
```


The game is now active! Reload the MindFlex dashboard, and the lobby will dynamically fetch this registry and render the new game card.

To **remove** a game, simply delete the entry from `games.json` and upload the configuration to KV again. No codebase rebuild or server restarts required.
