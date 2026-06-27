# Acceptance Criteria: MindFlex

## 1. Feature: Frictionless Identity Initialization

### 1.1 Overview
Instantly registers users on their first visit without signup walls.

### 1.2 Acceptance Conditions
*   **AC-1.1**: If no `anonymous_user_id` exists in local browser storage, the dashboard landing script must generate a valid version 4 UUID.
*   **AC-1.2**: The generated UUID must be registered via `POST /api/v1/profiles` immediately.
*   **AC-1.3**: The client must receive a unique recovery token (4-word mnemonic) in the registration response.
*   **AC-1.4**: If the API call fails due to network outage, the local UI must load normally in offline mode, cache the profile details locally, and retry the registration call on the next page reload.

### 1.3 Definition of Done (DoD)
*   Unit tests verify UUID format check and `LocalStorage` persistence.
*   Integration tests verify correct `201 Created` API execution and database profile record insertion.
*   UI loads in less than 1.5 seconds during profile generation.

---

## 2. Feature: Aspect-Locked Game Viewport

### 2.1 Overview
Ensures games scale cleanly and maintain aspect-ratio configurations on all screen sizes to keep gameplay fair.

### 2.2 Acceptance Conditions
*   **AC-2.1**: Memory flash games must use CSS-locked settings (`aspect-ratio: 1 / 1`) to ensure a square canvas.
*   **AC-2.2**: The game stage must center horizontally and vertically within the browser viewport, displaying black borders (letterbox margins) on wide screens.
*   **AC-2.3**: Double-tapping the canvas grid on touch screen devices must not cause the mobile browser to zoom the viewport.
*   **AC-2.4**: All interactive control buttons (volume, retry, pause) inside the game canvas must have a minimum touch target area of **44x44 CSS pixels**.

### 2.3 Definition of Done (DoD)
*   Visual UI tests verify layout proportions at `1920x1080` (desktop), `768x1024` (tablet), and `375x667` (mobile).
*   Event tests verify double-tap does not trigger scale transformations.
*   CSS verify touch rules (`user-select: none`, `touch-action: manipulation`).

---

## 3. Feature: Sandbox Bridge Integration

### 3.1 Overview
Translates in-game scores to global ratings using postMessage.

### 3.2 Acceptance Conditions
*   **AC-3.1**: The SDK (`mindflex-bridge.js`) must submit scores using `window.parent.postMessage`.
*   **AC-3.2**: The postMessage target origin must be dynamically resolved to match the current lobby window origin (`window.location.origin`) to prevent metric leakage.
*   **AC-3.3**: The Host dashboard listener must explicitly reject any incoming postMessage payload if the sender origin does not match `window.location.origin`.
*   **AC-3.4**: When the dashboard captures a valid score, it must asynchronously dispatch a JSON request to `POST /api/v1/games/{game_name}/submit`.

### 3.3 Definition of Done (DoD)
*   Integration tests verify cross-origin messages are blocked and logged.
*   Playwright script verifies scores update the radar chart without page reloads.

---

## 4. Feature: Least-Privilege Score Updates

### 4.1 Overview
Restricts game services from editing user profiles, allowing score increments only through secure stored procedures.

### 4.2 Acceptance Conditions
*   **AC-4.1**: Database credentials used by `game-telemetry-service` must fail if direct SQL `UPDATE` operations are executed on `schema_common.user_profiles`.
*   **AC-4.2**: Game score calculations and updates must be executed using the stored procedure `schema_common.update_memory_score(user_id, game_score)`.
*   **AC-4.3**: Global ratings recalculated by the stored procedure must be capped between `0` and `1000`.

### 4.3 Definition of Done (DoD)
*   PostgreSQL schema unit tests verify permission rejections on direct `UPDATE` executions from game database roles.
*   Recalculation test cases verify bounds checking (scores below 0 or above 1000 are capped correctly).
