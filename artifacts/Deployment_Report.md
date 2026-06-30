# MindFlex — Deployment Report

## Project Overview

MindFlex is a same-origin MPA cognitive-fitness platform composed of:

- **Host Dashboard** (`brain-hub-homepage`) — vanilla JS/CSS host at `maxithome.com/`
- **Sub-game** (`game-memory-flashmatrix`) — canvas game at `maxithome.com/games/memory/flashmatrix/`
- **Backend services** (`backend/`) — FastAPI containers behind an Nginx gateway, fronted by a Cloudflare Tunnel.

The platform persists anonymous profiles and game telemetry in PostgreSQL
using schema-based isolation (`schema_common`, `schema_memory_matrix`)
and least-privilege database roles.

This report describes how to deploy the MVP to a production environment
matching the architecture described in `docs/Architecture.md §5`.

## Environment Requirements

### Frontend (Cloudflare Pages)

| Tool | Version |
|---|---|
| Node.js (CI builds) | 20+ |
| `wrangler` | 4+ (only required for manual deploys) |
| Browser (runtime) | Chrome / Safari / Edge / Firefox (latest 2 majors) |

### Backend (Ubuntu server + Docker)

| Tool | Version |
|---|---|
| Ubuntu | 22.04 LTS or 24.04 LTS |
| Docker | 24+ |
| Docker Compose | v2 (`docker compose`) |
| `cloudflared` | 2024.x+ |
| `uv` | 0.5+ (for local dev only) |
| Python | 3.12 (CI only; containers ship their own runtime) |

### Database

| Tool | Version |
|---|---|
| PostgreSQL | 16 (alpine container ships in `docker-compose.yml`) |

No external managed DB is required.

## Required Environment Variables

### profile-service container

| Variable | Description | Example |
|---|---|---|
| `MINDFLEX_DB_HOST` | Postgres hostname | `postgres` |
| `MINDFLEX_DB_PORT` | Postgres port | `5432` |
| `MINDFLEX_DB_NAME` | Database name | `mindflex` |
| `MINDFLEX_DB_USER` | DB role | `common_svc` |
| `MINDFLEX_DB_PASSWORD` | Role password | `<strong-random>` |
| `MINDFLEX_DB_MIN` | Pool min size | `1` |
| `MINDFLEX_DB_MAX` | Pool max size | `5` |

### game-telemetry-service container

Same as profile-service except `MINDFLEX_DB_USER=game_memory_matrix_svc`
and a different password.

### nginx container

No environment variables. The `proxy_set_header X-Client-Timezone-Offset`
directive forwards the client header from the upstream.

### cloudflared container

| Variable | Description |
|---|---|
| `TUNNEL_TOKEN` | Cloudflare Tunnel token from `cloudflared tunnel login` |

(When using the YAML-based approach with a credentials file, mount
`/etc/cloudflared/<id>.json` and `/etc/cloudflared/config.yml` instead.)

## Local Development Setup

### 1. Clone & install

```bash
git clone <repo-url> mind_flex
cd mind_flex
```

### 2. Start the backend stack

```bash
cd backend
docker compose up -d --build
# Wait ~10s for Postgres healthcheck.
curl http://localhost:8080/healthz
# {"status":"ok"}
```

### 3. Run backend tests (in-memory, no Postgres required)

```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -e .[dev]
pytest
```

### 4. Serve the dashboard locally

```bash
cd brain-hub-homepage
npm install
npm run dev   # python3 -m http.server 5173
# Open http://localhost:5173/
```

### 5. Serve the sub-game locally

```bash
cd game-memory-flashmatrix
npm install
npm run dev   # python3 -m http.server 5174
# Open http://localhost:5174/
```

### 6. Run frontend tests

```bash
cd brain-hub-homepage
npm test            # unit (vitest)
npm run test:e2e    # Playwright
```

## Build Instructions

### Frontend (no build step)

The MVP ships vanilla HTML/JS/CSS with no bundler. Cloudflare Pages serves
the directory directly. Configure the Pages project with:

- **Build command**: *(empty)*
- **Build output directory**: `./` (for dashboard) and `./` (for game)
- **Compatibility date**: `2025-09-01`

### Backend containers

Containers are built from the project root:

```bash
cd backend
docker compose build
# or:
docker build -f Dockerfile.profile -t mindflex/profile-service .
docker build -f Dockerfile.game    -t mindflex/game-telemetry-service .
```

## Validation Steps

### Local validation (all green)

```bash
# Backend (in-memory)
cd backend && pytest
# expected: 53 passed

# Frontend unit (vitest)
cd brain-hub-homepage && npm test
# expected: 56 passed

# Sub-game unit (vitest)
cd game-memory-flashmatrix && npm test
# expected: 10 passed

# Frontend E2E (Playwright, against http-server)
cd brain-hub-homepage && npx playwright test
# expected: 6 passed
```

### Production validation (Postgres-backed)

```bash
cd backend
docker compose up -d
docker exec -it mindflex-postgres psql -U mindflex_admin -d mindflex -f /docker-entrypoint-initdb.d/01_schemas.sql
# Verify roles & permissions:
docker exec -it mindflex-postgres psql -U mindflex_admin -d mindflex -c "
  SELECT rolname FROM pg_roles
  WHERE rolname IN ('common_svc', 'game_memory_matrix_svc');
"
```

### Smoke test against running stack

```bash
# Create a profile
curl -X POST http://localhost:8080/api/v1/profiles \
  -H 'Content-Type: application/json' \
  -d '{"anonymous_user_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"}'

# Submit a game score
curl -X POST http://localhost:8080/api/v1/games/flashmatrix/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "anonymous_user_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "client_tx_id":"11111111-2222-3333-4444-555555555555",
    "score":850,
    "accuracy":0.94,
    "responseTimeMs":312,
    "roundsCompleted":8,
    "rawMetrics":{"clicks":[]}
  }'

# Read back the profile (verify memory = 535 after Elo delta from 500)
curl http://localhost:8080/api/v1/profiles/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
```

## Docker Instructions

The provided `backend/docker-compose.yml` brings up Postgres + Nginx +
both FastAPI services.

```bash
cd backend
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose down            # stop
docker compose down -v         # stop + drop the volume (DESTROYS DATA)
```

To add the Cloudflare Tunnel to the same Compose file:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:2024.10.0
    container_name: mindflex-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    volumes:
      - ../cloudflared:/etc/cloudflared:ro
    depends_on:
      - nginx
    networks:
      - mindflex_net
```

## Production Deployment Steps

### 1. Provision Cloudflare Pages & Worker Router

```bash
# Install wrangler locally
npm install -g wrangler
wrangler login

# Deploy Pages projects
cd brain-hub-homepage
wrangler pages deploy . --project-name=brain-hub-homepage
cd ../game-memory-flashmatrix
wrangler pages deploy . --project-name=game-memory-flashmatrix

# Create a Cloudflare Worker named `mindflex-router`
# and write the routing proxy script (see artifacts/cloudflare-url-rewrites.md)
```

### 2. Connect custom domains and Worker routes

In the Cloudflare dashboard:
1. Bind custom subdomain `mindflex-hub.maxithome.com` to the `mindflex-router` Worker (via Worker -> Domains -> Add Custom Domain).
2. Or configure a Worker Route: `mindflex-hub.maxithome.com/*` mapped to `mindflex-router` Worker.
3. This ensures all requests to the dashboard and games go through the Worker first, which strips the prefix and forwards requests to Pages and backend APIs while maintaining a strict same-origin.

### 3. Provision the Server

```bash
# On the backend host/server:
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Logout/login for group changes.

git clone <repo-url> mind_flex && cd mind_flex
```

### 4. Track Empty `cloudflared` Folder safely
To prevent credentials leak while keeping the folder structure in Git:
1. Create an empty `cloudflared/.gitkeep` file.
2. Add the following to the root `.gitignore`:
   ```gitignore
   cloudflared/*
   !cloudflared/.gitkeep
   ```

### 5. Configure the Cloudflare Tunnel

```bash
# On a workstation with cloudflared installed:
cloudflared tunnel login
cloudflared tunnel create mindflex-prod-tunnel
cloudflared tunnel route dns mindflex-prod-tunnel mindflex-api.maxithome.com

# Copy credentials to the project directory on the server (do NOT commit):
mkdir -p <project_root>/cloudflared
cp ~/.cloudflared/<TUNNEL_ID>.json <project_root>/cloudflared/
cp backend/cloudflared/config.example.yml <project_root>/cloudflared/config.yml
```

Edit `<project_root>/cloudflared/config.yml` on the server:
- Replace `<TUNNEL_ID>` with your actual tunnel UUID.
- Ensure the `credentials-file` resolves to `/etc/cloudflared/<TUNNEL_ID>.json` inside the container.
- Route `hostname: mindflex-api.maxithome.com` to `service: http://nginx:8080`.

### 6. Bring everything up

In the backend folder:
```bash
cd backend
# Port 8080 conflict resolution: If port 8080 is already allocated on the host, 
# modify nginx ports mapping in docker-compose.yml to "8085:8080" (tunnel routes internally and remains unaffected).
docker compose up -d --build
```

### 7. Verify

```bash
# Verify backend gateway health:
curl -i https://mindflex-api.maxithome.com/healthz

# Verify user profile registration:
curl -i -X POST https://mindflex-api.maxithome.com/api/v1/profiles \
  -H 'Content-Type: application/json' \
  -d '{"anonymous_user_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"}'

# Verify same-origin static routes & local storage access:
# Visit https://mindflex-hub.maxithome.com/ and start a game.
```

## Rollback Procedures

| Layer | Procedure |
|---|---|
| Frontend (Cloudflare Pages) | Revert the GitHub push or use Cloudflare's "Rollback to previous deploy" in the Pages dashboard. |
| Backend containers | `docker compose pull && docker compose up -d` after reverting the Git tag. |
| Database migration | `db/init/*.sql` files are idempotent (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`). To roll back, manually `DROP FUNCTION` and `DROP TABLE` in reverse order. |
| Stored procedure | `CREATE OR REPLACE FUNCTION` is forward-only; rollback requires restoring the previous function body manually. |

## Backup Strategy

| Asset | Frequency | Method |
|---|---|---|
| Postgres data | Daily | `docker exec mindflex-postgres pg_dump -U mindflex_admin mindflex > /backups/mindflex-$(date +%F).sql` |
| Postgres WAL | Continuous | `archive_mode = on` (configure in a custom postgresql.conf) |
| Cloudflare Pages | Built-in | Cloudflare retains every deploy; restore = redeploy |
| Tunnel credentials | Manual | `~/.cloudflared/<id>.json` should be backed up offline |

## Monitoring Recommendations

| Surface | Tool | Metric |
|---|---|---|
| API latency | Cloudflare Analytics + Nginx logs | P50/P95 latency per route |
| Error rate | FastAPI exception handlers → structured JSON to stdout | 4xx/5xx counts |
| Postgres health | `pg_isready` via docker healthcheck + Postgres exporter (Prometheus) | Connections, slow queries |
| Tunnel uptime | Cloudflare tunnel dashboard | Reconnect count |
| Frontend JS errors | Add a thin reporter (e.g. Sentry) to dashboard `window.onerror` | Error count, stack traces |
| Game play metrics | Custom event logger writing to Postgres | Sessions per day, average score per game |

## Logging Recommendations

- **Backend**: FastAPI logs to stdout in JSON format. `docker compose logs` collects them. Ship via Vector / Fluent Bit to Loki / Cloud Logging.
- **Frontend**: Console errors captured by browser; can be forwarded via `navigator.sendBeacon` to a logging endpoint.
- **Nginx**: `access_log` and `error_log` to stdout for container log collection.
- **Cloudflared**: stdout JSON; collection identical.

## Operational Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Tunnel credentials leak | High | Store in `~/.cloudflared/<id>.json` outside version control; rotate quarterly. |
| Postgres role privilege escalation | High | The `game_memory_matrix_svc` role has restricted `SELECT (cols)` on `schema_common.user_profiles`. The `SECURITY DEFINER` stored procedure is the only path to write the memory score. |
| DDoS on `/api/v1/*` | Medium | Cloudflare WAF + rate limiting rules in front of the tunnel. |
| DNS hijack of `maxithome.com` | Medium | DNSSEC + registrar lock + Cloudflare Registrar. |
| Storage eviction on iOS Safari | Medium | Recovery token shown prominently in profile overlay. Users can paste on a new device. |
| Score forgery | Low | Server-side anti-cheat (`anti_cheat.py`) and stored-procedure isolation. |
| Single-region outage | Medium | Acceptable for MVP; document as known limitation. |
| Score decay not visible to user | Low | Document the 72h rule in the profile overlay tooltip. |

---

For full implementation traceability and known limitations, see
`artifacts/Implementation_Report.md`. For conflicts identified during
implementation, see `artifacts/Documentation_Conflict_Report.md`.
