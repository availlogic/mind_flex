# Test Strategy: MindFlex

## 1. Overview
This document outlines the testing strategy for the MindFlex cognitive fitness platform. The goal is to provide deterministic quality validation across frontend client viewports, sandboxed iframe bridges, API contracts, and isolated PostgreSQL schemas.

---

## 2. Upstream Document Quality Audit (Issue Log)
During cross-domain specification reviews, the following gaps were identified in the upstream documentation:

| Issue ID | Upstream Document | Severity | Description | Recommended Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | `docs/API_Spec.md`, `docs/Database.md` | **HIGH** | The UI specification outlines a "Daily training progress tracker (e.g. Daily goal: 3, Today: 1/3)", but the user profile API payload and the database `user_profiles` table contain no fields to track games played today. | Add `daily_games_played` and `daily_goal` fields to the `GET /profiles` API response and the `schema_common.user_profiles` table. |
| **AUD-02** | `docs/PRD.md` | **MEDIUM** | Streak increment rules are undefined. It is unclear if streaks increment on a calendar day basis (server UTC vs user local timezone) or a rolling 24-hour window. | Define streak increments as calendar-day boundaries based on the client's timezone offset transmitted in the payload header. |
| **AUD-03** | `docs/API_Spec.md` | **MEDIUM** | Score submissions do not enforce a timestamp query limit. If the backend fails, local offline queued scores could be submitted with identical timestamps, causing primary key conflicts in the database. | Add a unique client-side request transaction UUID (`client_tx_id`) to `POST /games/{game}/submit` to prevent duplicate submissions. |
| **AUD-04** | `docs/Screen-Specs.md` | **LOW** | There is no specification for error states when `mindflex-bridge.js` fails to load inside the game iframe, leaving the UI hanging. | Implement a fallback timeout (e.g., 5 seconds) on the host dashboard. If no bridge handshake is received, show an iframe loading failure screen. |

---

## 3. Test Levels & Scope

### 3.1 Unit Testing
*   *Scope*: Verification of isolated utility functions:
    *   *Frontend*: Score formatting, UUID generation regex, recovery key generation.
    *   *Backend*: Score average math, Elo delta calculations, and payload structure schema validation.
*   *TDD Alignment*: Coding agents must write unit tests for backend API routes and helper files before writing implementation logic.

### 3.2 Integration Testing
*   *Scope*: Validation of boundary conditions:
    *   *Host ↔ Game Frame*: Handshake, score serialization, and message validation.
    *   *Host ↔ API Gateway*: API contract validation, CORS rules, and secure HTTPS tunneling.
    *   *API ↔ Database*: Schema queries, database transaction rollbacks during payload failures, and stored procedure score updates.

### 3.3 System Testing
*   *Scope*: Cross-device scaling, performance, and accessibility:
    *   Responsive viewport adjustments, double-tap zoom prevention, touch element focus states, and minimum touch targets (≥44px).

### 3.4 End-to-End (E2E) Testing
*   *Scope*: Validation of full user lifecycles:
    *   Creation of anonymous sessions, execution of a complete gameplay round, score submission, database persistence, and profile restore.

---

## 4. Coverage Model & Risk-Based Prioritization

Testing efforts are prioritized based on risk levels and impact on the user experience:

| Feature Area | Priority | Target Efficacy | Key Verification |
| :--- | :--- | :--- | :--- |
| **Telemetry Bridge** | **CRITICAL** | High | Validation of `postMessage` origin and sanitization of incoming data. |
| **Profile Restore** | **HIGH** | High | Verification of recovery token matching and schema profile loading. |
| **Score Calculations** | **HIGH** | High | Stored procedure calculations of cognitive ratings. Anti-cheat bounds. |
| **UI Touch Controls** | **MEDIUM** | Medium | Elimination of mobile click delays (`pointerdown`) and correct letterbox aspect ratios. |
| **Streak Tracker** | **LOW** | Medium | Streak calculations across timezone resets. |

---

## 5. Automation vs. Manual Execution

```
                       AUTOMATED TESTS (90%)
┌───────────────────────────────────────────────────────────────┐
│  - Unit tests: API validators, Elo average calculations.     │
│  - Integration tests: API schemas, Stored Procedure rules.    │
│  - E2E tests: Playwright-driven user flows, local storage.    │
└──────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
                      MANUAL TESTS (10%)
┌───────────────────────────────────────────────────────────────┐
│  - iOS Safari touch target validation (minimum 44x44px).      │
│  - Physical testing of double-tap zoom locks.                │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. Quality Gates

### 6.1 Entry Criteria for Testing Phase
*   Upstream specifications (`PRD.md`, `Architecture.md`, `API_Spec.md`, `Database.md`, and UI specs) are approved and stable.
*   The CI pipeline runs unit tests on push.
*   Local database migrations run without conflict.

### 6.2 Exit Criteria for Testing Phase
*   100% of critical and high-priority test cases pass.
*   Zero open high-severity issues.
*   Code coverage metrics exceed **85%** on backend service lines.
*   All endpoints in `API_Spec.md` are verified under load simulation (50 requests/sec target).
