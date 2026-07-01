# MindFlex — AI-Era Human Brain Gym

## Project Background
In the era of generative AI and intelligent agents, humans face the risk of cognitive regression (fluid intelligence decline) due to cognitive offloading. MindFlex is the "Human Brain Resistance Base," providing an engaging, high-retention portal of lightweight HTML5 micro-games to stimulate and protect core human cognitive dimensions: Memory, Focus, Logic, Speed, and Spatial.

For deep research findings, scientific validation, market analyses, and risk profiles, see [Research_Report.md](file:///Users/victorxu/projects/mind_flex/docs/Research_Report.md).
For the detailed product requirements and feature scope, see [PRD.md](file:///Users/victorxu/projects/mind_flex/docs/PRD.md).
For overall system architecture and module boundaries, see [Architecture.md](file:///Users/victorxu/projects/mind_flex/docs/Architecture.md).
For communication and backend API contracts, see [API_Spec.md](file:///Users/victorxu/projects/mind_flex/docs/API_Spec.md).
For database entity descriptions and DDL schemas, see [Database.md](file:///Users/victorxu/projects/mind_flex/docs/Database.md).
For user flows and journey mappings, see [User-Flows.md](file:///Users/victorxu/projects/mind_flex/docs/User-Flows.md).
For detailed screen state and component descriptions, see [Screen-Specs.md](file:///Users/victorxu/projects/mind_flex/docs/Screen-Specs.md).
For dark-mode cyberpunk design colors and typography rules, see [Visual-Guidelines.md](file:///Users/victorxu/projects/mind_flex/docs/Visual-Guidelines.md).
For page grid layouts and structural wireframes, see [UI-Layouts.md](file:///Users/victorxu/projects/mind_flex/docs/UI-Layouts.md).
For the QA test levels and the audit list of upstream issues, see [Test-Strategy.md](file:///Users/victorxu/projects/mind_flex/docs/Test-Strategy.md).
For functional test descriptions of user elements, see [Functional-Test-Cases.md](file:///Users/victorxu/projects/mind_flex/docs/Functional-Test-Cases.md).
For integration checks of API contracts and rollbacks, see [Integration-Test-Cases.md](file:///Users/victorxu/projects/mind_flex/docs/Integration-Test-Cases.md).
For multi-device session migrations E2E paths, see [E2E-Test-Scenarios.md](file:///Users/victorxu/projects/mind_flex/docs/E2E-Test-Scenarios.md).
For functional completeness definitions of done, see [Acceptance-Criteria.md](file:///Users/victorxu/projects/mind_flex/docs/Acceptance-Criteria.md).
For project vision details, see [Vision.md](file:///Users/victorxu/projects/mind_flex/docs/Vision.md).
For core rules and platform limits, see [Constraints.md](file:///Users/victorxu/projects/mind_flex/docs/Constraints.md).
For instructions on developing and dynamically integrating new sub-games, see [Game-Integration-Guide.md](file:///Users/victorxu/projects/mind_flex/docs/Game-Integration-Guide.md).






---

## Architecture Overview
MindFlex is structured as a decentralized, same-origin **Multi-Page Application (MPA)**.

```
                      ┌──────────────────────┐
                      │    Host Dashboard    │
                      │  (CF Pages Main App) │
                      └──────────┬───────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Memory Game    │  │    Focus Game    │  │    Logic Game    │
│  (Embedded iframe)│ │  (Embedded iframe)│ │  (Embedded iframe)│
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

1.  **Host Dashboard (`brain-hub-homepage`)**: A responsive gateway website showing the game library, profile achievements, and a five-dimensional cognitive radar chart (including a visual "AI Replacement Threat Line").
2.  **Decoupled Games (`game-[category]-[name]`)**: Individual canvas/HTML5 games deployed in independent repositories. Games run inside sandboxed iframes.
3.  **Communication Bridge (`mindflex-bridge.js`)**: A lightweight SDK executing secure `postMessage` exchanges between the host and the embedded games.
4.  **Local API Gateway & Backend**: Home-hosted Ubuntu server running Docker Compose (Nginx + PostgreSQL with separate schemas for data isolation, e.g., `schema_common`, `schema_memory_matrix`). Connected securely using a Cloudflare Tunnel.

---

## Design Principles
*   **Decoupled Game Autonomy**: Individual games manage all of their inner settings (volume, keys, local retry buttons) inside their sandbox. The main host only monitors score telemetry.
*   **Strict Touch Accessibility**: Every button and control has a minimum click dimension of **44x44 pixels**.
*   **Optimized Touch Interactions**: Listen to `pointerdown` rather than `click` to eliminate mobile-web touch delay.
*   **Disabled Default Gestures**: Lock selections and browser menus inside games via CSS selection overrides.
*   **Viewport Constraints**: Prevent unwanted resizing/zooming with locked metadata viewport constraints.
*   **Adaptive Canvas Layouts**:
    *   *Fluid Mode*: Adapts percentage dimensions dynamically via window resize listeners.
    *   *Letterbox Mode*: Locks a specific aspect ratio (e.g., `aspect-ratio: 1/1` for grid memory games) with borders to keep gameplay fair.

---

## Dependency Setup Instructions
The backend services are developed using Python and managed via `uv`.

### Prerequisites
Ensure `uv` is installed on your local environment:
```bash
# Install uv (macOS / Linux)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Installation
1. Initialize the virtual environment:
   ```bash
   uv venv
   ```
2. Activate the environment:
   ```bash
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   uv sync
   ```

---

## Build Instructions
Static frontends (both the host dashboard and sub-games) are built using standard web compilers and deployed to **Cloudflare Pages**.
1. To run the dashboard homepage locally:
   ```bash
   npm run dev
   ```
2. Build the output:
   ```bash
   npm run build
   ```

---

## Testing Instructions
We strictly follow **Test-Driven Development (TDD)** principles. No production code is implemented without a corresponding test case.

### Running Python Backend Tests
Run the pytest suite through the `uv` runner:
```bash
uv run pytest
```

### Running Frontend Tests
To verify iframe message parameters, interface scaling, and touch targets:
```bash
npm run test
```

---

## Deployment Instructions

### 1. Cloudflare Routing Setup (Worker Router)
*   Deploy `brain-hub-homepage` to Cloudflare Pages.
*   Deploy each game (e.g., `game-memory-flashmatrix`) to its own Cloudflare Pages project.
*   Deploy a **Cloudflare Worker** (e.g. `mindflex-router`) and bind it to `maxithome.com/*` (or test subdomain `mindflex-hub.maxithome.com/*`).
*   The Worker intercepts requests and reverse-proxies:
    *   `/api/*` -> API gateway (Cloudflare Tunnel at `mindflex-api.maxithome.com`).
    *   `/games/:category/:game_id/*` -> Dynamic Game Pages site (prefix stripped, serving dynamically from the root of `game-:category-:game_id.pages.dev`, e.g., `/games/memory/flashmatrix/*` -> `game-memory-flashmatrix.pages.dev`).
    *   Everything else -> Dashboard Pages site (`brain-hub-homepage.pages.dev`).
    *   *This preserves the same-origin constraint while dynamically routing new games and overcoming standard URL Transform Rules hostname limitations.*

### 2. Backend Server Deployment
The API servers run inside Docker on a backend Ubuntu host connected via a containerized Cloudflare Tunnel.

```bash
# Place your credentials and config.yml in the root `cloudflared/` directory.
# Track the directory structure safely using .gitkeep and .gitignore.

# Start Docker containers in the backend directory
cd backend
docker compose up -d --build
```

Nginx routes API requests to the respective microservice container based on the path (e.g., `/api/v1/games/flashmatrix/*`).

---

## Usage Examples

### Playing a Game (UI Flow)
1. Navigate to `maxithome.com` (automatically generates an anonymous user ID in `LocalStorage`).
2. Click on a game card (e.g., **Flash Matrix** under **Memory**).
3. Play the game inside the aspect-locked iframe stage.
4. On game completion, the game client calls:
   ```javascript
   emitGameScore(850, { accuracy: 0.95, responseTimeMs: 320 });
   ```
5. The dashboard detects the event, posts the metrics to the backend `/api/v1/games/flashmatrix/submit`, and refreshes the五维 cognitive radar chart.
