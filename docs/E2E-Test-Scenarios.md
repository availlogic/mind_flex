# E2E Test Scenarios: MindFlex

## 1. Overview
E2E scenarios are automated using Playwright to verify full user lifecycles across browser rendering engines and the live backend API gateway.

---

## 2. E2E Scenario Specifications

### E2E-SC-01: Standard First-Time Session, Play, and Record Update
*   **Traceability**: Maps to [User-Flows.md](file:///Users/victorxu/projects/mind_flex/docs/User-Flows.md) (Journey 1)
*   **User Action Path**:
    1.  Launch Playwright browser, navigate to `maxithome.com`.
    2.  Verify `LocalStorage` contains a newly generated UUID string under key `anonymous_user_id`.
    3.  Assert dashboard global score indicates `0`.
    4.  Assert radar chart renders empty outline polygon.
    5.  Select **Flash Matrix** game card. Assert the viewport loads the sandboxed game iframe.
    6.  Simulate a game session by executing grid coordinate click patterns inside the game frame canvas.
    7.  On level completion, intercept the postMessage dispatch and verify the `/api/v1/games/flashmatrix/submit` POST request payload.
    8.  Assert API response is `200 OK` with updated scores.
    9.  Assert the user returns to the Lobby dashboard automatically.
    10. Assert the Global Score displays the updated rating value.
    11. Assert the radar chart updates to display the populated Memory axis.
*   **Verification Gates**:
    *   *UI transition*: Iframe container closes correctly; focus returns to the dashboard grid.
    *   *Backend state*: The database query returns a newly inserted row in `schema_memory_matrix.game_sessions` matching the user's UUID.
    *   *Data persistence*: Check `schema_common.user_profiles` to verify the memory rating value is updated and matches the UI display.

---

### E2E-SC-02: Device Account Migration Flow
*   **Traceability**: Maps to [User-Flows.md](file:///Users/victorxu/projects/mind_flex/docs/User-Flows.md) (Journey 2)
*   **User Action Path**:
    1.  Launch Playwright Context A (Device 1). Navigates to `maxithome.com`.
    2.  Assert profile scores update to custom values (e.g. Memory score 720).
    3.  Click user avatar to open the profile dropdown.
    4.  Extract the recovery mnemonic string from the UI block (e.g. `crimson-tiger-autumn-breeze`).
    5.  Launch Playwright Context B (Device 2). Navigates to `maxithome.com` (asserting a separate, empty profile starts).
    6.  Click avatar, paste Device 1's recovery mnemonic `crimson-tiger-autumn-breeze` into the restore input, and click **Restore**.
    7.  Assert confirmation alerts appear. Page refreshes.
    8.  Assert the restored profile's scores on Device 2 match the Device 1 stats (Memory score 720).
*   **Verification Gates**:
    *   *LocalStorage*: Device 2's `LocalStorage.getItem('anonymous_user_id')` matches Device 1's UUID.
    *   *Backend Validation*: No new database profiles are created during this restoration sequence.

---

### E2E-SC-03: Hard Wipe Data Erasure Journey
*   **Traceability**: Maps to [PRD.md](file:///Users/victorxu/projects/mind_flex/docs/PRD.md) (User Story US-06)
*   **User Action Path**:
    1.  Navigate to `maxithome.com`. Verify user profile scores are active.
    2.  Click Avatar to expand the dropdown overlay.
    3.  Click **Delete All Data** button.
    4.  On the confirmation modal, click **Confirm Delete**.
    5.  Wait for page refresh.
*   **Verification Gates**:
    *   *UI transition*: User is returned to lobby showing default 0 scores.
    *   *LocalStorage*: The `anonymous_user_id` has been updated to a completely new UUID.
    *   *Database validation*: Verify that the database query for the deleted UUID returns 0 rows in `schema_common.user_profiles` and that all entries in `schema_memory_matrix.game_sessions` matching the deleted ID have been hard-deleted.
