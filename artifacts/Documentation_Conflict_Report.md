# MindFlex — Documentation Conflict Report

This report documents conflicts and ambiguities discovered in the `docs/`
directory during implementation. Per SSOT rule §4 of the deliver-product
contract, conflicts are NEVER resolved by editing documentation; instead
this report is forwarded for human review.

---

## C1 — `accuracy` units (proportion vs. percentage)

| Document | Conflict Value |
|---|---|
| `docs/API_Spec.md` §2.3 | Request body uses `0.94` (proportion) |
| `docs/Database.md` §3.1 | `accuracy NUMERIC(5,2) ... CHECK (accuracy BETWEEN 0.00 AND 100.00)` (percentage) |

**Code decision applied**: API keeps proportion (0..1). The game-telemetry-service backend converts to percentage before persisting (`accuracy * 100.0`). Anti-cheat validation in `validate_score_payload` accepts either form by checking `accuracy > 1.0` as out-of-bounds, which catches both unit-mismatch submissions and 150% cheats.

**Affected areas**:
- `backend/game_telemetry_service/app/db.py` (`PostgresTelemetryStore.submit_session`)
- `backend/game_telemetry_service/app/services/anti_cheat.py`
- Frontend host (`brain-hub-homepage/js/api-client.js`) submits proportion.

**Recommended human review**: harmonize one side. Either:
- Switch DB to `CHECK (accuracy BETWEEN 0.00 AND 1.00)` and store fraction, **or**
- Switch API contract to require percentage.

---

## C2 — Missing `client_tx_id` in submit API spec

| Document | Status |
|---|---|
| `docs/API_Spec.md` §2.3 | Submit payload omits `client_tx_id` |
| `docs/Test-Strategy.md` AUD-03 (HIGH) | Mandates `client_tx_id` UUID on submit to prevent duplicate submissions |

**Code decision applied**: The submit endpoint accepts `client_tx_id` (UUID v4) and uses it as a unique key on `schema_memory_matrix.game_sessions.client_tx_id`. Idempotent re-submission returns the existing session record without re-persisting.

**Affected areas**:
- `backend/db/init/01_schemas.sql` (column added)
- `backend/game_telemetry_service/app/schemas.py` (field added)
- `brain-hub-homepage/js/api-client.js` (auto-generated client-side)

**Recommended human review**: add `client_tx_id` to `docs/API_Spec.md` §2.3 as an explicit request field and to the JSON sample.

---

## C3 — Missing daily tracker fields in API/DB

| Document | Status |
|---|---|
| `docs/PRD.md` §11.1.3 | UI requires "Daily training progress tracker (e.g. 3 games played. Today: 1/3)" |
| `docs/Database.md` §2.1 | No `daily_games_played` or `daily_goal` columns |
| `docs/API_Spec.md` §2.2 | No daily tracker fields in profile response |

**Code decision applied**: added `daily_games_played`, `daily_goal`, `daily_goal_date` to `schema_common.user_profiles`. Profile response now includes these fields. The `update_streak` stored path (or fallback in-memory equivalent) increments daily counters when the client supplies a new `X-Client-Timezone-Offset` header.

**Affected areas**:
- `backend/db/init/01_schemas.sql`
- `backend/profile_service/app/routers/profiles.py` (`_serialize_profile`)

**Recommended human review**: add daily tracker fields to `docs/Database.md` and the `GET /profiles/{id}` example in `docs/API_Spec.md`.

---

## C4 — Streak increment rule undefined

| Document | Status |
|---|---|
| `docs/PRD.md` §11 | No rule for when `current_streak` increments or resets |
| `docs/Test-Strategy.md` AUD-02 (MEDIUM) | "Define streak increments as calendar-day boundaries based on the client's timezone offset transmitted in the payload header." |

**Code decision applied**: streak is computed using the client's local calendar day (via `X-Client-Timezone-Offset` header). First-ever play sets streak to 1. Same-day replay keeps streak. Consecutive day increments. Gap of ≥ 2 days resets to 1.

**Affected areas**:
- `backend/profile_service/app/services/streak.py`
- `backend/profile_service/app/db.py` (`apply_play_to_daily_tracker`)

**Recommended human review**: formalize this rule in `docs/PRD.md` and document the header in `docs/API_Spec.md`.

---

## C5 — Score decay present in PRD but absent from API spec

| Document | Status |
|---|---|
| `docs/PRD.md` §13.1 | "Scores decay by 2% after 72 hours of inactivity" |
| `docs/API_Spec.md` | No decay documented |

**Code decision applied**: profile-service applies decay at read time in `GET /profiles/{id}` (`apply_decay`). Decay compounds per 72h window and clamps to ≥ 0. The persisted `last_active_at` is not mutated by decay.

**Affected areas**:
- `backend/profile_service/app/services/score_decay.py`
- `backend/profile_service/app/routers/profiles.py`

**Recommended human review**: add a note to `docs/API_Spec.md` §2.2 explaining that `scores` returned from `GET /profiles/{id}` are post-decay.

---

## C6 — Architecture §5 references future stored procedures

| Document | Status |
|---|---|
| `docs/Architecture.md` §4.3 | "Score updates are performed via a strict database function (stored procedure) that only allows incremental updates" — implies one procedure per dimension |
| `docs/Database.md` §5.3 | Only `update_memory_score` is defined (for the Flash Matrix MVP) |

**Code decision applied**: only `update_memory_score` is implemented, matching the MVP scope (`game-memory-flashmatrix` is the only supported game per PRD §20).

**Affected areas**: future games (Focus, Logic, Speed, Spatial) will each need their own `update_<dim>_score` procedure. Recommend documenting this pattern in `docs/Database.md` §5.

**Recommended human review**: add stubs for `update_focus_score`, `update_logic_score`, `update_speed_score`, `update_spatial_score` to `docs/Database.md` with "TODO Phase 2" markers, or remove the implication from `docs/Architecture.md` §4.3.

---

## C7 — AUD-04 handshake timeout UI fallback not documented

| Document | Status |
|---|---|
| `docs/Test-Strategy.md` AUD-04 (LOW) | "Implement a fallback timeout (e.g., 5 seconds) on the host dashboard. If no bridge handshake is received, show an iframe loading failure screen." |
| `docs/Screen-Specs.md` §2.3 | No mention of failure-screen behavior |

**Code decision applied**: bridge-host.js installs a 5-second handshake timer when a game iframe is mounted. The `#mf-stage-failure` overlay is shown if no `MINDFLEX_BRIDGE_READY` arrives in time. The timer is reset on handshake received.

**Affected areas**:
- `brain-hub-homepage/js/bridge-host.js`
- `brain-hub-homepage/index.html` (`#mf-stage-failure`)
- `brain-hub-homepage/sdk/mindflex-bridge.js` (auto-announces `MINDFLEX_BRIDGE_READY` on load)

**Recommended human review**: add the failure-screen UI state to `docs/Screen-Specs.md` §2.

---

## Summary

7 conflicts identified. All are non-blocking and were resolved per SSOT (the more explicit / more testable source wins). The Implementation_Report and Deployment_Report describe the as-built behavior.

**Action requested**: please review the seven items above and either update `docs/` to reflect the chosen resolution, or confirm the implementation is acceptable.
