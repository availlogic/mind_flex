# MindFlex - AI时代的人类脑力健身房: Constraints

## Technology Constraints
- **Frontend Architecture**:
  - The main dashboard/shell (`brain-hub-homepage`) must be built as a clean web interface (HTML/JS/CSS).
  - Individual games operate in their own sandbox environments (Canvas or H5 viewports) and are decoupled from the host dashboard.
- **Inter-system Communication**:
  - A lightweight client SDK (`mindflex-bridge.js`) must be used for game-to-shell communication.
  - The SDK must leverage `window.postMessage` to pass execution scores, accuracy, and response times to the host shell.
- **Database Schema**:
  - PostgreSQL instance must use schema-based isolation to separate concerns.
  - `schema_common` stores public user records, overall scores, and achievements.
  - Game-specific schemas (e.g., `schema_memory_matrix`) store granular, game-specific metrics (e.g., clicks, matrices, latency).

---

## Platform & Device Constraints
- **Responsive Layout**:
  - **Desktop Mode**: Grid system displaying multi-column (4-6 columns) game cards with a persistent left sidebar.
  - **Mobile Mode**: Left sidebar hides into a burger menu drawer. Game card grid reduces to 1-2 columns for touch friendliness.
- **Mobile Web Standout Settings**:
  - Viewport must be locked using:
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    ```
  - Mobile touch delay must be eliminated in games by listening to `pointerdown` instead of `click`.
  - Minimum touch target area for game and settings controls is **44x44 pixels**.
  - Default browser touch selections and menus must be disabled:
    ```css
    * {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    ```

---

## Infrastructure & Deployment Constraints
- **Hosting Topology**:
  - **Dashboard Shell**: Deployed on Cloudflare Pages (bound to `maxithome.com`).
  - **Sub-Games**: Each game is developed in an independent Git repository, compiled via GitHub Actions, and deployed on its own Cloudflare Pages.
- **Routing & Networking**:
  - URL rewriting rules must be configured in Cloudflare to route requests like `maxithome.com/games/[category]/[game-name]/*` implicitly to the corresponding Cloudflare Pages project.
  - This ensures same-origin compliance, allowing shared `LocalStorage` access.
- **Backend & Tunneling**:
  - API servers (`/api/*`) are hosted on a domestic Ubuntu Server running Docker Compose.
  - Public exposure must be handled via **Cloudflare Tunnel**; no ports or public IPs should be open to the internet.
  - **Nginx container** must act as the local API Gateway routing traffic to backend microservices.

---

## Security Constraints
- **Network Penetration Protection**:
  - Cloudflare Tunnel must secure all inbound API traffic.
- **Database Access Control**:
  - Database users must have access strictly limited to their respective schemas.
  - Individual game backend credentials can read/write their game's schema, but must have read-only or highly restricted write privileges on `schema_common` to prevent cross-game data tampering or corruption.

---

## Performance Constraints
- **Sub-Game Adaptability**:
  - **Fluid Mode**: Game canvas adjusts dynamically to percentage or `vw/vh` dimensions, handling `window.resize` internally.
  - **Letterbox Mode**: Games requiring exact proportions (like matrix visual games) must utilize a CSS ratio lock (e.g., `aspect-ratio: 1/1`) and center with black borders to preserve gameplay fairness.

---

## Compliance Requirements
- **Privacy Focus**:
  - All metrics tracking and user state must operate without collecting Personally Identifiable Information (PII).
  - No email verification or real-name registration is required in the initial release.

---

## Known Assumptions
- Users have modern, standard-compliant browsers supporting H5 Canvas, CSS custom properties, `postMessage`, and local storage.
- Cloudflare Tunnel provides stable connectivity between Cloudflare Pages routing and domestic Ubuntu servers.

---

## Explicit Non-Goals
- **Federated Authentication**: Traditional email/password signup or third-party OAuth is out-of-scope; state is persisted entirely via anonymous `LocalStorage` tokens.
- **Multiplayer Synchronous Interaction**: Real-time multiplayer matching or lobby mechanisms will not be developed.
- **Store Distribution**: Publishing native applications to Apple App Store or Google Play Store is not supported; the app operates entirely as a Progressive Web App (PWA) / web platform.
