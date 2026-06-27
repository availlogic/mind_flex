# Functional Test Cases: MindFlex

## 1. Feature: Anonymous Profile Creation

### FT-APC-01: Auto-generation of Anonymous Profile on First Visit
*   **Preconditions**: Browser `LocalStorage` is cleared.
*   **Steps**:
    1. Navigate to the root URL `maxithome.com`.
    2. Inspect browser `LocalStorage` parameters.
    3. Query the host network call stack.
*   **Expected Result**:
    *   A new UUID is generated and saved as `anonymous_user_id` in `LocalStorage`.
    *   A `POST /profiles` call is made with the generated UUID.
    *   The lobby renders with all scores set to 0.
*   **Priority**: **HIGH**

---

### FT-APC-02: User ID Validation Rules
*   **Preconditions**: API service is running.
*   **Steps**:
    1. Send a POST request to `/api/v1/profiles` with an invalid user ID format: `{"anonymous_user_id": "invalid-id-123"}`.
*   **Expected Result**:
    *   API returns `400 Bad Request`.
    *   Response body contains error code `INVALID_PARAMETER` detail.
*   **Priority**: **MEDIUM**

---

## 2. Feature: Host Dashboard UI & Responsiveness

### FT-HDR-01: Responsive Left Sidebar and Grids
*   **Preconditions**: Screen size is configurable.
*   **Steps**:
    1. Load `maxithome.com` with screen width set to `1200px`. Verify sidebar visibility and card column count.
    2. Reduce screen width to `900px`. Verify sidebar state and card column count.
    3. Reduce screen width to `480px` (mobile viewport). Inspect sidebar visibility and top bar hambuger drawer layout.
*   **Expected Result**:
    *   *1200px*: Left sidebar is permanently visible. Card grid has 4–6 columns.
    *   *900px*: Sidebar collapses to icons. Grid has 3 columns.
    *   *480px*: Sidebar is hidden. Hamburger drawer button is visible. Grid has 1–2 columns.
*   **Priority**: **HIGH**

---

### FT-HDR-02: Double-Tap Zoom Prevention on Mobile Viewports
*   **Preconditions**: Testing on simulated iOS Safari mobile viewport.
*   **Steps**:
    1. Navigate to `maxithome.com`.
    2. Double-tap rapidly on the lobby game grid or card elements.
*   **Expected Result**:
    *   The browser viewport scale remains locked at `1.0`. No zoom actions occur.
*   **Priority**: **MEDIUM**

---

## 3. Feature: Standard Sandbox Bridge SDK

### FT-SSB-01: Decoupled Score Submission via postMessage
*   **Preconditions**: Flash Matrix game is loaded inside the host dashboard page's iframe.
*   **Steps**:
    1. Play the game to completion.
    2. Trigger the game outcome script to post message:
       ```javascript
       window.parent.postMessage({
           type: 'MINDFLEX_GAME_OVER',
           payload: { score: 850, accuracy: 0.95 }
       }, window.location.origin);
       ```
    3. Monitor Host console and network panel.
*   **Expected Result**:
    *   Host dashboard intercepts message, validates origin, and initiates a POST request to `/api/v1/games/flashmatrix/submit`.
    *   The user's global score and radar chart update dynamically on completion.
*   **Priority**: **CRITICAL**

---

### FT-SSB-02: Block Cross-Origin postMessage Submissions (Security)
*   **Preconditions**: Game is loaded inside the iframe.
*   **Steps**:
    1. Trigger a mock postMessage from an external origin (e.g., `https://malicious-site.com`):
       ```javascript
       window.postMessage({
           type: 'MINDFLEX_GAME_OVER',
           payload: { score: 9999 }
       }, '*');
       ```
    2. Check Host dashboard console warning outputs.
*   **Expected Result**:
    *   The Host dashboard logs a warning: `Blocked untrusted message origin`.
    *   No network submissions are sent to the backend. The scoreboard and radar chart remain unchanged.
*   **Priority**: **CRITICAL**

---

## 4. Feature: Profile Backup & Restore

### FT-PBR-01: Profile Restoration via Mnemonic Token
*   **Preconditions**: A profile has been created with historical score logs. The recovery token `crimson-tiger-autumn-breeze` is registered.
*   **Steps**:
    1. Clear `LocalStorage` on a new browser window.
    2. Navigate to `maxithome.com` (a new UUID is generated).
    3. Click user avatar, input `crimson-tiger-autumn-breeze` into the Import field, and click **Restore**.
*   **Expected Result**:
    *   Host dashboard calls `/api/v1/profiles/restore`.
    *   API returns `200 OK` with the restored UUID and scores.
    *   Client `LocalStorage` value of `anonymous_user_id` updates to match the restored UUID.
    *   The lobby page refreshes and loads the restored scores.
*   **Priority**: **HIGH**

---

### FT-PBR-02: Input Validation on Restore Field
*   **Preconditions**: Import Modal is visible.
*   **Steps**:
    1. Type an invalid key format (e.g., `tiger`) and click **Restore**.
*   **Expected Result**:
    *   The Restore button is disabled, or clicking it immediately displays a local validation error: `"Invalid token format. Must be 4 dash-separated words."`
    *   No API call is dispatched.
*   **Priority**: **MEDIUM**
