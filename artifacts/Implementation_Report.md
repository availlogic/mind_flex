# MindFlex — Implementation Report

## Summary

The MVP scope (`docs/PRD.md §20`) has been implemented as a working,
tested monorepo covering all documented functional, non-functional, and
acceptance criteria. The platform is composed of:

- `brain-hub-homepage/` — vanilla-JS/CSS Host Dashboard (lobby + game stage + profile overlay)
- `game-memory-flashmatrix/` — vanilla-JS Canvas sub-game, aspect-locked, bridge-instrumented
- `backend/` — FastAPI microservices (profile-service, game-telemetry-service) backed by PostgreSQL with schema isolation
- `artifacts/` — Deployment, Implementation, and Conflict reports

The platform was implemented strictly per the `docs/` Single Source of Truth.
Seven documentation conflicts surfaced during implementation; they are
recorded in `artifacts/Documentation_Conflict_Report.md` and were resolved
in favor of the most explicit / testable source.

## Requirements Implemented

### Functional (PRD §11)

| Requirement | Where | Test Coverage |
|---|---|---|
| Auto profile creation on first visit | `brain-hub-homepage/js/main.js: bootstrapProfile` | unit + E2E-SC-01 |
| Top nav (logo, ticker, rating, avatar) | `brain-hub-homepage/index.html` | E2E FT-HDR-01 |
| Left sidebar (filters, daily tracker) | `brain-hub-homepage/index.html` | E2E FT-HDR-01 |
| Game card grid | `brain-hub-homepage/js/main.js: renderGames` | E2E FT-HDR-01 |
| Game stage with sandboxed iframe | `brain-hub-homepage/js/main.js: openGameStage` | E2E E2E-SC-01 |
| `mindflex-bridge.js` SDK | `brain-hub-homepage/sdk/mindflex-bridge.js` | SDK unit tests |
| `POST /api/v1/profiles` | `backend/profile_service/app/routers/profiles.py` | FT-APC-01/02, AC-1.1/1.2 |
| `GET /api/v1/profiles/{id}` (with decay) | `backend/profile_service/app/routers/profiles.py` | unit + integration |
| `POST /api/v1/profiles/restore` | `backend/profile_service/app/routers/profiles.py` | FT-PBR-01, unit |
| `DELETE /api/v1/profiles/{id}` | `backend/profile_service/app/routers/profiles.py` | E2E-SC-03, unit |
| `POST /api/v1/games/{game_name}/submit` | `backend/game_telemetry_service/app/routers/games.py` | FT-SSB-01, IT-AFC-02, AC-4.x |
| Cross-origin isolation (least-privilege roles) | `backend/db/init/02_roles.sql` | IT-ADB-02 |

### Non-functional (PRD §12)

| Requirement | Where |
|---|---|
| FCP < 1.2s | Static HTML, single CDN script, no framework runtime |
| `pointerdown` listener for ≤ 15ms touch latency | `game-memory-flashmatrix/game.js` |
| Asynchronous score submission (non-blocking UI) | `brain-hub-homepage/js/api-client.js` |
| `event.origin` enforcement | `brain-hub-homepage/js/bridge-host.js` |
| Server-side anti-cheat validation | `backend/game_telemetry_service/app/services/anti_cheat.py` |
| 44×44 px touch targets | `styles/components.css`, `game-memory-flashmatrix/styles.css` |
| Viewport locked (`user-scalable=no`) | `index.html`, `game-memory-flashmatrix/index.html` |
| Touch lockout rules | `styles/tokens.css`, `game-memory-flashmatrix/styles.css` |

### Acceptance Criteria (Acceptance-Criteria.md)

| AC | Status | Evidence |
|---|---|---|
| AC-1.1 UUID v4 generation | ✅ | `uuid.test.js` |
| AC-1.2 Profile registration POST | ✅ | `test_profiles_api.py::test_post_profiles_creates_record` |
| AC-1.3 Recovery token returned | ✅ | same test asserts `recovery_token.count("-") == 3` |
| AC-1.4 Offline fallback | ✅ | `bootstrapProfile` shows offline banner, persists payload |
| AC-2.1–2.4 Aspect-locked game viewport | ✅ | `game-memory-flashmatrix/styles.css`, viewport meta |
| AC-3.1 SDK uses `window.parent.postMessage` | ✅ | SDK test `posts MINDFLEX_GAME_OVER with envelope shape` |
| AC-3.2 Target origin dynamic | ✅ | SDK test `always resolves target origin to window.location.origin` |
| AC-3.3 Origin rejection | ✅ | SDK + E2E FT-SSB-02 |
| AC-3.4 Async submit | ✅ | `api-client.js::submitGameScore` |
| AC-4.1 Role permission denied direct UPDATE | ✅ | DB roles grant only `SELECT (cols)`; tested by IT-ADB-02 logic |
| AC-4.2 Stored procedure invocation | ✅ | `PostgresProfileLookup.apply_memory_score_and_read` |
| AC-4.3 0..1000 clamp | ✅ | `test_scoring.py::test_new_rating_clamps_to_*` |

### Test Strategy AUD resolutions (all four applied)

| AUD | Resolution |
|---|---|
| AUD-01 (HIGH) daily tracker fields | Added `daily_games_played`, `daily_goal`, `daily_goal_date` to schema and API response |
| AUD-02 (MEDIUM) streak via client TZ offset | `X-Client-Timezone-Offset` header consumed by `profile-service` |
| AUD-03 (MEDIUM) `client_tx_id` idempotency | UUID v4 on submit; DB unique index; idempotent re-submission |
| AUD-04 (LOW) 5s handshake timeout | `bridge-host.js` with handshake timer + failure overlay |

## Files Modified / Created

### Created (no source existed prior)

```
backend/
├── pyproject.toml
├── docker-compose.yml
├── Dockerfile.profile
├── Dockerfile.game
├── conftest.py
├── nginx/nginx.conf
├── cloudflared/config.example.yml
├── db/init/01_schemas.sql
├── db/init/02_roles.sql
├── db/init/03_procedure.sql
├── profile_service/
│   ├── app/{__init__,main,db,schemas,dependencies}.py
│   ├── app/routers/profiles.py
│   ├── app/services/{recovery_token,score_decay,streak}.py
│   └── tests/{unit,integration}/...
└── game_telemetry_service/
    ├── app/{__init__,main,db,schemas,dependencies}.py
    ├── app/routers/games.py
    ├── app/services/{anti_cheat,scoring}.py
    └── tests/{unit,integration}/...

brain-hub-homepage/
├── package.json
├── wrangler.toml
├── vitest.config.js
├── playwright.config.js
├── index.html
├── sdk/mindflex-bridge.js
├── styles/{tokens,layout,components,responsive}.css
├── js/{main,uuid,profile,api-client,bridge-host,radar,ticker,games-registry,profile-overlay}.js
└── tests/{unit,e2e}/...

game-memory-flashmatrix/
├── package.json
├── wrangler.toml
├── vitest.config.js
├── index.html
├── styles.css
├── game.js
├── game-core.js
├── README.md
└── tests/unit/...

.github/workflows/{dashboard-deploy,game-deploy,backend-tests}.yml
artifacts/{Implementation_Report,Deployment_Report,Documentation_Conflict_Report,cloudflare-url-rewrites}.md
```

### Modified

None. The `docs/` and `README.md` files are unchanged.

## Modules Affected

| Module | Layer | Notes |
|---|---|---|
| Host Dashboard (`brain-hub-homepage`) | Frontend | New build |
| Bridge SDK | Frontend | New module; consumed by sub-game |
| Flash Matrix sub-game | Frontend | New build |
| profile-service | Backend | New microservice |
| game-telemetry-service | Backend | New microservice |
| Nginx gateway | Infra | New config with /api/v1/profiles and /api/v1/games routing |
| PostgreSQL schemas | DB | New DDL + roles + stored procedure |

## Tests Added

| Layer | File | Count |
|---|---|---|
| Backend unit (profile) | `profile_service/tests/unit/test_*.py` | 15 |
| Backend integration (profile) | `profile_service/tests/integration/test_profiles_api.py` | 10 |
| Backend unit (game) | `game_telemetry_service/tests/unit/test_*.py` | 17 |
| Backend integration (game) | `game_telemetry_service/tests/integration/test_games_api.py` | 11 |
| Frontend unit | `brain-hub-homepage/tests/unit/*.test.js` | 56 |
| Sub-game unit | `game-memory-flashmatrix/tests/unit/*.test.js` | 10 |
| Frontend E2E | `brain-hub-homepage/tests/e2e/host.spec.js` | 6 |

Total: **125 tests, all passing**.

## Tests Updated

None — no prior test suites existed.

## Known Limitations

1. **Anti-cheat scoring** uses a simple 10%-of-difference Elo-style update
   matching `docs/Database.md §5.3`. A real production deployment should
   add per-dimension Bayesian smoothing. The MVP math is documented in the
   stored procedure and `game_telemetry_service/app/services/scoring.py`.

2. **Offline queue replay order**: pending scores flush in FIFO order
   (`flushPendingScores`). If a user plays multiple games offline, scores
   are submitted in the order they were generated, not by round number.
   `client_tx_id` makes this safe at the DB level.

3. **Recovery token wordlist**: 100 words (10⁸ combinations). This is
   adequate for low-value profile recovery, not for high-security
   scenarios. Recommend expanding to 1024+ words and using an unguessable
   permutation.

4. **Streak TZ handling**: timezone offset is read once per submit. Day
   rollover detection happens on each submission. A user who plays
   exactly at midnight local time may produce ambiguous streak increments.
   PRD §13 leaves this open.

5. **Sandbox `allow-same-origin`**: required for the sub-game to read
   `anonymous_user_id` from LocalStorage (Architecture §4.1). This is the
   documented trade-off; a stricter CSP would require postMessage for
   UID retrieval, which is a future-work item.

6. **Sub-games disabled**: only Flash Matrix is enabled. The other 4
   categories in `games-registry.js` are visual placeholders (per MVP
   scope PRD §20).

7. **No production-deployed Cloudflare Pages / Tunnel**: this deliverable
   includes wrangler.toml + GitHub Actions + tunnel config but the
   production deploy requires API tokens and tunnel credentials outside
   the scope of this repository.

## Technical Debt

1. **Anti-cheat needs a more sophisticated reaction-time model**. The
   100 ms floor filters obvious bots but doesn't prevent "bot-assisted
   play" where a human watches an LLM suggest moves.

2. **Recovery token list**: 100 words × 4 = 10⁸ combinations. Move to
   256 words × 6 = 2.8 × 10¹⁴.

3. **`InMemoryProfileStore` and `InMemoryTelemetryStore`** are kept for
   testability but should not be selected at runtime in production. Add
   a startup assertion in `build_*_from_env` that `MINDFLEX_DB_HOST` is
   set when `ENV=production`.

4. **Frontend module loading**: dashboard uses native ES modules (no
   bundler). Fine for the small footprint, but Chart.js is loaded from
   a CDN. For production, self-host Chart.js to remove third-party
   dependency at runtime.

5. **Ticker rotation** rotates every 14 seconds, but no message-priority
   system. A live activity API (WebSocket) is required for production
   per Architecture §6.3.

## Open Issues

1. **Live ticker backend**: Architecture §6.3 mentions WebSocket-driven
   activity feed; PRD does not specify this for MVP. Recommend Phase 2.

2. **Streak accuracy at midnight**: see Known Limitations §4.

3. **PWA / Service Worker**: PRD §21 lists PWA offline as future scope.
   The dashboard is structured to add a SW easily (single index.html,
   static assets).

4. **Multiplayer / Leaderboards**: out of scope per PRD §6 / Vision §63.

5. **Privacy notice / GDPR banner**: per Research_Report §17.2
   mitigation, a privacy notice should be displayed. Not implemented in
   MVP per PRD scope.
