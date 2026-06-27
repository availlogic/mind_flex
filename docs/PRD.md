# Product Requirements Document (PRD): MindFlex

## 1. Executive Summary
MindFlex is a gamified cognitive fitness platform designed to combat the fluid intelligence regression and digital amnesia associated with generative AI and digital helper tools ("cognitive offloading"). By providing a grid of high-quality, instantly playable HTML5 micro-games, MindFlex encourages users to actively exercise their cognitive faculties. The platform features persistent, friction-free tracking of a user's mental metrics across five core cognitive dimensions, compared against an "AI replacement threat baseline."

## 2. Background
In the current era of ubiquitous AI assistants, LLMs, auto-routers, and code generators, the human brain is offloading critical multi-step logic, spatial navigation, writing, and recollection tasks. Without mental resistance training, individuals risk cognitive decline, attention span fragmentation, and memory atrophy. MindFlex serves as the human cognitive resistance base, providing short, addictive, and scientifically grounded exercises that keep human brains active.

## 3. Problem Statement
Generative AI tools act as "cognitive crutches." They bypass the "germane load" (the productive struggle required to build long-term memory and reasoning skills). Consequently, modern knowledge workers suffer from:
1.  **Dopamine-loop distraction** (shortened attention span).
2.  **Short-term memory fragmentation** (reliance on search/AI retrieval).
3.  **Logical decay** (accepting AI answers instead of executing decomposition).
4.  **Reaction fog** (loss of high-speed active decision-making).
5.  **Spatial awareness decline** (dependency on turn-by-turn navigation systems).

## 4. Product Vision Alignment
MindFlex aligns with the core vision of "keeping human brains human." It provides a platform that is:
*   **Highly engaging**: Grid-based layout, instant play, and visual polish.
*   **Scientifically grounded**: Multi-dimensional radar charts mapping cognitive domains.
*   **Technically decoupled**: Standardized templates allowing independent developers to build games that slide into the dashboard container with zero-coupling.

## 5. Goals
*   **Frictionless Access**: Users can play immediately without filling out email forms or undergoing onboarding.
*   **Unified Tracking**: Consolidate gaming performance into a five-dimensional cognitive radar chart.
*   **Motivating Gamification**: Introduce the "AI Replacement Threat Line" to challenge users to outperform AI capabilities.
*   **Scalable Game Library**: Provide an MPA structure and secure SDK allowing third-party games to easily plug into the portal.
*   **Responsive Adaptation**: Ensure excellent playability across both desktop screens and mobile devices.

## 6. Non-goals
*   **Medical Treatment / Diagnostics**: MindFlex is a cognitive fitness app, not a clinical tool for diagnosing or treating medical disorders (e.g., ADHD, Alzheimer's).
*   **Native Mobile Apps**: App store deployments are out of scope. The platform is strictly a Progressive Web App (PWA) / web platform.
*   **Synchronous Multiplayer**: Matchmaking, real-time multiplayer lobbies, and active multiplayer sessions are out of scope.
*   **E-Commerce & Monetization (Phase 1)**: In-app ads, subscriptions, and payment gates will not be implemented in the initial release.

## 7. Target Users
1.  **Modern Knowledge Workers**: Software engineers, writers, analysts, and designers who rely on AI assistants daily and want to keep their minds sharp.
2.  **Casual Gamers**: People seeking productive mental stimulation during short breaks (commutes, queuing) instead of passive social media scrolling.
3.  **Quantified Self / Cognitive Fitness Enthusiasts**: Individuals who track their sleep, health, and focus metrics, seeking granular telemetry of their brain capacity.

## 8. Personas

### Persona A: Alex — The AI-Dependent Developer
*   **Role**: Senior Software Engineer.
*   **Usage Pattern**: Uses GitHub Copilot and ChatGPT for 80% of code generation and synthesis.
*   **Frustration**: Feels "brain fog" and decreased memory capacity. Realizes he is struggling to remember simple syntax or perform complex multi-step mental dry-runs of code.
*   **Goal**: Wants a quick, daily 5-minute mental workout before work to stimulate logic and working memory, tracking performance against a baseline.

### Persona B: Beatrice — The Productive Commuter
*   **Role**: Marketing Consultant.
*   **Usage Pattern**: Spends 30 minutes on the subway twice a day.
*   **Frustration**: Dislikes wasting time scrolling social media feeds but lacks the energy to read heavy articles.
*   **Goal**: Wants instant-loading, visually satisfying casual games to play on her mobile browser that feel like they are improving her attention span rather than draining it.

---

## 9. User Journeys

### Journey 1: First-Time Play & Tracking
```
[User visits maxithome.com] ──► [Anonymous ID created & stored] ──► [Lobby grid renders]
                                                                           │
┌──────────────────────────────────────────────────────────────────────────┘
│
▼
[User clicks "Flash Matrix"] ──► [Iframe loads aspect-locked game] ──► [Plays game]
                                                                           │
┌──────────────────────────────────────────────────────────────────────────┘
│
▼
[Game Over] ──► [Bridge posts score to Host] ──► [Host sends telemetry to API]
                                                            │
┌───────────────────────────────────────────────────────────┘
│
▼
[Radar Chart updates instantly] ──► [User sees profile update with badges]
```

### Journey 2: Return Session after 3 Days
1. User opens browser, navigates to `maxithome.com`.
2. Homepage checks `LocalStorage` for `anonymous_user_id`.
3. Valid ID found; homepage fetches historical brain score and cognitive dimensions from backend.
4. UI displays current daily streak, total scores, and the radar chart.
5. User selects a new game card to continue training.

---

## 10. User Stories

| ID | User Role | Action | Desire / Goal | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **US-01** | First-time visitor | Access the site and play any game instantly | Play without registration friction | No signup wall. An anonymous ID is generated automatically in background. |
| **US-02** | Knowledge worker | View a 5-dimensional radar chart of cognitive skills | Track progress and identify weak cognitive areas | Chart.js radar displays Memory, Focus, Logic, Speed, and Spatial. |
| **US-03** | Knowledge worker | See a shaded "AI Replacement Threat Line" on the radar chart | Motivate self to keep human brain skills higher than AI tools | A threat boundary is drawn on the radar; user receives alert if score drops below it. |
| **US-04** | Mobile commuter | Play games on a phone without lag or misclicks | Smooth gameplay during commutes | `pointerdown` listener removes latency; targets are ≥44px; layouts adapt to viewports. |
| **US-05** | Returning user | Keep progress across days | Retain scores without creating accounts | Progress is saved automatically using same-origin `LocalStorage` linked to backend profiles. |
| **US-06** | Privacy advocate | Clear all tracked history from the platform | Ensure personal telemetry is deleted | "Delete Account/Data" button clears local storage and wipes database telemetry. |

---

## 11. Functional Requirements

### 11.1 Global Host Dashboard (`brain-hub-homepage`)
1.  **Anonymous Profiling**:
    *   On load, if no `anonymous_user_id` exists in `LocalStorage`, generate a UUID.
    *   Register the profile with the backend API `/api/v1/profiles`.
2.  **Top Navigation Bar**:
    *   *Logo*: Tapping redirects to lobby root.
    *   *Live Ticker*: Renders dynamic events (e.g., "Anonymous User #9213 crossed the Focus safety line!").
    *   *Total Score Display*: Displays the overall computed score.
    *   *Profile Dropdown*: Accessible by clicking the user avatar. Displays:
        *   Detailed cognitive radar chart (Chart.js or D3.js).
        *   Unlocked badges and current streak count.
        *   "Export Recovery Token" button (12-word mnemonic or UUID token to copy).
        *   "Import Recovery Token" field.
        *   "Delete All Data" option.
3.  **Left Sidebar (Desktop Only)**:
    *   Filter games by tags: Memory, Focus, Logic, Speed, Spatial.
    *   Daily training progress tracker (e.g., "Daily goal: 3 games played. Today: 1/3").
4.  **Main Content Grid**:
    *   Displays all active games as cards (Title, Icon, Tag, Difficulty Level, and Best Personal Score).
    *   Tapping a game card launches the Game Container.
5.  **Game Container Page**:
    *   Embeds the target game's build output using a central `iframe`.
    *   Displays a "Back to Lobby" button outside the iframe (in the Top Bar).

### 11.2 Standardized Sub-Game Stage
1.  **Iframe Isolation**:
    *   Must run within a sandboxed `iframe` without access to host script scopes.
2.  **Localized Settings**:
    *   All setups (audio toggle, control mapping, retry button) must reside inside the game's canvas/iframe stage.
3.  **Communication client (`mindflex-bridge.js`)**:
    *   Injected inside every sub-game.
    *   Sends game outcomes to the parent page:
      ```javascript
      window.parent.postMessage({
          type: 'MINDFLEX_GAME_OVER',
          payload: {
              score: 720,
              timestamp: 1782638400000,
              details: {
                  accuracy: 0.92,
                  responseTimeMs: 380,
                  roundsCompleted: 8,
                  rawMetrics: {}
              }
          }
      }, 'https://maxithome.com'); // Must specify target host domain
      ```
4.  **Responsive Layout Locking**:
    *   Must adapt to screen size.
    *   Memory grid games must use CSS-locked `aspect-ratio` (e.g., `1:1`) to display a centered square stage with black borders (letterbox) to ensure fairness across desktop and mobile.

### 11.3 API & Backend Systems
1.  **Profile Handlers**:
    *   `POST /api/v1/profiles`: Creates a new profile record for a generated UUID.
    *   `GET /api/v1/profiles/{id}`: Fetches profile metadata, global score summaries, and badges.
2.  **Game Submit Handlers**:
    *   `POST /api/v1/games/{game_name}/submit`:
        *   Accepts payload with score, accuracy, response details, and the user's UUID.
        *   Calculates the new cognitive rating scores in `schema_common.user_profiles`.
        *   Persists the granular level telemetry to the game-specific schema (e.g., `schema_memory_matrix`).
3.  **Cross-Origin Isolation**:
    *   The database must enforce schema role limits: the database credential used by a sub-game backend service can only write to its game schema and update scores in `schema_common.user_profiles` under restricted rules.

---

## 12. Non-functional Requirements

### 12.1 Performance
*   **First Contentful Paint (FCP)**: The Host Dashboard must load within **1.2 seconds** on average 4G connections.
*   **Interaction Latency**: In-game touch actions must respond within **15ms** (`pointerdown` implementation).
*   **Asynchronous Processing**: Game score submissions must be non-blocking. The UI must transition instantly, executing backend database sync asynchronously.

### 12.2 Security
*   **Iframe Origin Enforcement**: The Host Dashboard must check `event.origin` string explicitly during `postMessage` listeners:
    ```javascript
    if (event.origin !== window.location.origin) return;
    ```
*   **Data Validation**: All score data submitted to backend APIs must undergo server-side validation to prevent forged high scores.
*   **Cloudflare Tunnel**: Direct backend server ports (e.g., `5432` for Postgres or standard port `80`/`443`) must not be exposed to the public internet.

### 12.3 Reliability & Accessibility
*   **Touch Targets**: Minimum interactive element size inside games is **44x44 CSS pixels**.
*   **No Zoom**: Disable user viewport scaling within mobile configurations.
*   **Browser compatibility**: Support Chrome (iOS/Android/Desktop), Safari (macOS/iOS), Edge, and Firefox.

---

## 13. Business Rules
1.  **Radar Calculation**:
    *   Cognitive category ratings range from `0` to `1000`.
    *   Scores decay by `2%` after `72 hours` of inactivity to encourage persistent training.
2.  **AI Threat Baseline**:
    *   The "AI Replacement Threat Line" is fixed for the MVP: Focus (750), Memory (800), Logic (850), Speed (800), Spatial (700).
    *   If a user's score in any dimension falls below the threat line, that category is highlighted in red on their profile radar.
3.  **Data Deletion**:
    *   Deleting local data must perform a hard delete of the matching UUID from `schema_common` and all corresponding sub-game telemetry tables.

---

## 14. Assumptions
*   **Domain Unification**: Cloudflare Pages routing will map all components under a single origin (`maxithome.com`), satisfying the Same-Origin Policy.
*   **Client Capabilities**: User browsers support modern canvas elements, ES6 Javascript features, and iframe sandbox messaging.

---

## 15. Constraints
*   **Database Constraints**: Use a single PostgreSQL cluster with schema-based isolation (concern-level credentials).
*   **Hosting Constraints**: Frontends deployed to Cloudflare Pages; APIs hosted on a domestic Ubuntu server running Docker Compose behind Cloudflare Tunnel.
*   **Framework Constraints**: Avoid bloated SPA frameworks if simple MPA/HTML architectures satisfy the MVP performance constraints.

---

## 16. Dependencies
*   **Libraries**: Chart.js or D3.js for the dynamic radar visual.
*   **Deployment tools**: wrangler/GitHub Actions for automated deployment.
*   **Database connector**: uv-managed python libraries (e.g., asyncpg, SQLAlchemy).

---

## 17. Risks

| Risk Description | Severity | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Mobile Storage Eviction** | High | High | Provide a clear recovery token display in the user profile menu to allow manual backups. |
| **High API Latency** | Medium | Medium | Handle score submissions asynchronously in the client. Render success animations immediately while processing database inserts in the background. |
| **Cheat / Score Forgery** | Low | Medium | Standard server-side range validation. Discard scores that exceed realistic human limits (e.g., reaction times under 100ms). |
| **Iframe Touch Issues on iOS** | Medium | High | Apply CSS `touch-action: manipulation` and configure mobile locks on target viewports. |

---

## 18. Acceptance Criteria

### AC-1: Dashboard Identity Initialization
*   **Given** a user loads the root URL `maxithome.com` for the first time:
    *   **Then** a new UUID is generated and saved in `LocalStorage` as `anonymous_user_id`.
    *   **And** the ID is successfully registered via `POST /api/v1/profiles`.
    *   **And** the user sees a default, empty radar chart.

### AC-2: Decoupled Score Submission
*   **Given** the user is playing `game-memory-flashmatrix` in the iframe container:
    *   **When** the game concludes:
        *   **Then** the iframe sends a `MINDFLEX_GAME_OVER` event with the score payload.
        *   **And** the host validates the message origin as `maxithome.com`.
        *   **And** the score is transmitted asynchronously to `POST /api/v1/games/flashmatrix/submit`.
        *   **And** the host UI updates the user's total score and radar graph without page reloads.

### AC-3: Mobile Touch and Scaling
*   **Given** the user loads the application on Safari iOS:
    *   **Then** double-tapping does not zoom the viewport.
    *   **And** long-pressing does not trigger text selection menus inside the game frame.
    *   **And** the game canvas respects the aspect-ratio constraint, showing equal borders when landscape orientation is changed.

---

## 19. Success Metrics
*   **Instant Play Rate**: Over 90% of landing page visitors launch a game within 30 seconds of entry.
*   **Daily Active Retention**: 30% of players return to train within 7 days.
*   **Developer Onboarding**: A third-party developer can successfully construct and integrate a new game using the CLI/template within 4 hours.

---

## 20. Scope (Phase 1 MVP)
*   **Dashboard Lobby**: Responsive grid layout, category filters, and a Chart.js radar graph with the "AI Threat Line".
*   **Standard SDK**: Secure `mindflex-bridge.js` client file.
*   **1 Benchmark Game**: Aspect-locked Flash Matrix memory game (H5 canvas-based).
*   **Backend Server**: Nginx router, Docker Compose configuration, and Postgres schema partitioning.

---

## 21. Future Scope
*   **Cognitive History Logs**: Linear line charts showing cognitive trends over weeks/months.
*   **Developer CLI**: `mindflex-cli` to test and compile games.
*   **PWA Offline Capabilities**: Service worker implementation for offline gameplay.
*   **Social scoreboards**: Daily global leaderboard comparing anonymous profiles.

---

## 22. Open Questions
1.  **AI Threat Scaling**: Should the AI Threat Line be dynamic, shifting higher as consumer AI models (like GPT-5/Gemini Pro updates) improve their benchmark scores?
2.  **Telemetry Volume**: Should we capture raw click paths in the sub-game databases, or only capture final score aggregates? (Aggregates are recommended for MVP to limit storage constraints on home servers).

---

## 23. Change Log

| Timestamp | Type | Summary | Sections |
| :--- | :--- | :--- | :--- |
| 2026-06-27T04:35:00Z | Add | Created initial Product Requirements Document (PRD) from project vision, constraints, and research report. | All Sections |
