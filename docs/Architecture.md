# Technical Architecture: MindFlex

## 1. System Overview
MindFlex is structured as a decentralized, same-origin Multi-Page Application (MPA) partitioned into a persistent **Global Shell** and a series of sandboxed, independent **Game Stages**. The design guarantees modularity, security, and low-friction access.

```
+-----------------------------------------------------------------------------------+
|                                 maxithome.com                                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                            Global Host Shell                                |  |
|  |                (Top Bar, Sidebar, Live Ticker, Profile Menu)                |  |
|  +-----------------------------------------------------------------------------+  |
|  |                                                                             |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  |                     Sandboxed Game Stage (iframe)                      |  |  |
|  |  |                     [ games/memory/flashmatrix/ ]                      |  |  |
|  |  |                                                                       |  |  |
|  |  |  +---------------------------+       +-----------------------------+  |  |  |
|  |  |  |        Game Canvas        |       |        Game Settings        |  |  |  |
|  |  |  |   (pointerdown listeners) |       |   (Volume, Keys, Restart)   |  |  |  |
|  |  |  +---------------------------+       +-----------------------------+  |  |  |
|  |  |                                                                       |  |  |
|  |  |  + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |  |  |
|  |  |  |                     mindflex-bridge.js SDK                        |  |  |  |
|  |  |  |                 [ window.parent.postMessage ]                     |  |  |  |
|  |  |  + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Module Decomposition

The platform is decomposed into independent modules to ensure minimal coupling and standalone testability:

### 2.1 Frontend Modules
*   **Host Lobby Dashboard (`brain-hub-homepage`)**:
    *   *Responsibilities*: Manages user sessions, visualizes progress, renders the five-dimensional cognitive radar chart, runs the live achievement ticker, and embeds active games.
    *   *Technology*: Vanilla HTML/JS, CSS custom properties (variables), Chart.js.
*   **Sandbox Bridge SDK (`mindflex-bridge.js`)**:
    *   *Responsibilities*: Wraps communication between embedded iframes and the host shell, providing a safe API for score emission.
    *   *Technology*: Vanilla JavaScript.
*   **Decoupled Sub-Games (`game-[category]-[name]`)**:
    *   *Responsibilities*: Runs the active visual gameplay. Uses isolated HTML5/Canvas architectures. Configures aspect-ratio locking (e.g., `aspect-ratio: 1/1`) for letterbox containment.
    *   *Technology*: HTML5 Canvas, Vanilla JS/WebGL, CSS lock.

### 2.2 Infrastructure & Routing Modules
*   **Edge Router (Cloudflare Worker Router)**:
    *   *Responsibilities*: Intercepts requests for `maxithome.com/*` and proxies path `/games/memory/flashmatrix/*` to the distinct sub-game Pages project origin (stripping the prefix) and `/api/*` to the API gateway (Cloudflare Tunnel). This forces the browser to treat both the dashboard and games as same-origin, unlocking shared access to the root domain's `LocalStorage` partition.
*   **Tunneling Gateway (Cloudflare Tunnel & Nginx)**:
    *   *Responsibilities*: Cloudflare Tunnel forwards public API traffic (`/api/*`) to Nginx on the home server. Nginx acts as the local gateway, routing paths to the appropriate Docker containers.

### 2.3 Backend Services (Docker Containers)
*   **Common Profile Service (`profile-service`)**:
    *   *Responsibilities*: Manages profile registrations, calculates overall cognitive index score averages, processes recovery tokens, and updates streaks.
    *   *Technology*: Python (FastAPI), SQLAlchemy.
*   **Game Telemetry Service (`game-telemetry-service`)**:
    *   *Responsibilities*: Validates submitted score performance bounds and writes detailed telemetry paths (clicks, response times) to game-specific database tables.
    *   *Technology*: Python (FastAPI), SQLAlchemy.

---

## 3. Core Data Flows

### 3.1 Session Initialization Flow
1.  User opens browser and visits `maxithome.com`.
2.  `brain-hub-homepage` checks browser `LocalStorage` for `anonymous_user_id`.
3.  If absent, the client generates a UUID and makes a POST call to `/api/v1/profiles`.
4.  The API registers the user in `schema_common.user_profiles` and returns the default profile metadata.

### 3.2 Game Completion & Score Persistence Flow
```
Sub-Game (iframe)              Host Shell (maxithome.com)            API Gateway & DB
      │                                     │                               │
      │──► emitGameScore(score, details) ──►│                               │
      │    (via window.parent.postMessage)  │                               │
      │                                     │──► POST /api/v1/games/matrix  │
      │                                     │    (UUID, score, clicks...)   │
      │                                     │                               │
      │                                     │◄── Response (200 OK) ─────────│
      │                                     │    (updated ratings)          │
      │                                     │                               │
      │                                     │──► Updates Radar Chart        │
```
1.  The user completes a game of Flash Matrix.
2.  The game script calls the SDK: `emitGameScore(850, { accuracy: 0.95, responseTimeMs: 320, clicks: [...] })`.
3.  The SDK fires a message using `window.parent.postMessage`.
4.  The Host Shell listener validates `event.origin === window.location.origin`.
5.  The Host Shell extracts the score, makes a POST request to `/api/v1/games/flashmatrix/submit`.
6.  The backend service validates the payload, saves the click list to `schema_memory_matrix.game_clicks`, recalculates the Memory score in `schema_common.user_profiles`, and returns the updated values.
7.  The Host Shell UI updates the radar chart dynamically.

---

## 4. Security Architecture

1.  **Strict Same-Origin Sandboxing**:
    The iframe embedding the game uses a secure sandbox configuration:
    ```html
    <iframe src="/games/memory/flashmatrix/index.html"
            sandbox="allow-scripts allow-same-origin"
            class="game-stage-frame"></iframe>
    ```
    *   `allow-scripts`: Required to run the game loops.
    *   `allow-same-origin`: Required to access the same domain's `LocalStorage` database to retrieve the `anonymous_user_id`.
2.  **Explicit Target Origin Communication**:
    The SDK ensures no leakage of game metrics:
    ```javascript
    // mindflex-bridge.js
    const targetOrigin = window.location.origin; // Safely resolve runtime origin
    window.parent.postMessage({ type: 'MINDFLEX_GAME_OVER', payload }, targetOrigin);
    ```
3.  **Database Access Controls**:
    Individual game microservices connect to PostgreSQL using isolated credentials:
    *   The `game-telemetry-service` role has full privileges on `schema_memory_matrix`, but has read-only access to `schema_common.user_profiles`. Score updates are performed via a strict database function (stored procedure) that only allows incremental updates and prevents raw modification of other profiles.

---

## 5. Deployment Topology

```
                  Public Internet (Cloudflare CDN Edge)
+--------------------------------------------------------------------------+
|  maxithome.com (Worker Router Entry Point)                               |
|                       │ (Edge Proxy Routing)                             |
|                       ├───► /games/* ──► [game-memory-flashmatrix Pages]  |
|                       ├───► /api/*   ──► [mindflex-api Tunnel]           |
|                       └───► /        ──► [brain-hub-homepage Pages]      |
+----------------──────────────────┬───────────────────────────────────────+
                                   │
                                   │ (Tunnel: HTTPS / api/*)
                                   ▼
                      Home Ubuntu Server (LAN)
+──────────────────────────────────────────────────────────────────────────+
|  Cloudflare Tunnel Client Container (cloudflared)                        |
|                                  │
|                                  ▼
|  Nginx Gateway Container (Reverse Proxy)                                 |
|         │                                 │
|         ├── /api/v1/profiles              └── /api/v1/games/*
|         ▼                                 ▼
|  profile-service Container        game-telemetry-service Container
|         │                                 │
|         └───────────────┬─────────────────┘
|                         ▼
|  PostgreSQL Database Container (Port 5432 - Unexposed)                   |
|  [schema_common]          [schema_memory_matrix]                         |
+──────────────────────────────────────────────────────────────────────────+
```

---

## 6. Reliability, Scalability & Observability

1.  **Safari LocalStorage Eviction Mitigation**:
    To address iOS Safari's eviction of local storage after 7 days of site inactivity, the host dashboard profile menu displays a **12-word recovery mnemonic** (or unique backup string). The user can copy this token and import it on any device to restore their history.
2.  **API Gateway Load Balancing**:
    Docker Compose manages service scale. The Nginx reverse proxy routes requests round-robin across scaled Python containers when load spikes occur.
3.  **Observability & Diagnostics**:
    *   *Backend Logging*: Standard structured JSON logs outputted to stdout, collected by Docker log handlers.
    *   *Frontend Diagnostics*: Console error monitoring. The host tracks API failure rates, queueing score submissions in local storage if connectivity goes offline.
