# CryptoSparrow

Monorepo with:
- `apps/api` (Express API)
- `apps/web` (Next.js app)

## Quick Start (Local)

### 1) Requirements
- Node.js 20+
- pnpm 10+
- Docker Desktop (Postgres + Redis)

### 2) Install dependencies
Run in project root:

```bash
pnpm install
```

### 2.1) Environment config
- Server: `apps/api/.env` (`SERVER_URL`, `SERVER_PORT`, `CLIENT_URL`, `CLIENT_PORT`).
- Client: `apps/web/.env.local` with `NEXT_PUBLIC_API_BASE_URL` (for example `http://localhost:3001`).
- Optional: set `CORS_ORIGINS` (comma-separated) in server env to allow multiple frontend origins.
- Rate limiter Redis: set `REDIS_URL` in server env (default fallback: `redis://localhost:6379`).
- API-key crypto (server): use `API_KEY_ENCRYPTION_KEYS` (for example `v1:old-key,v2:new-key`) and `API_KEY_ENCRYPTION_ACTIVE_VERSION` (for example `v2`). Legacy `API_KEY_ENCRYPTION` remains as backward-compatible fallback.

### 3) Start infrastructure (terminal A)
Run in project root:

```bash
docker compose up -d
docker compose ps
```

Expected:
- Postgres on `localhost:5432`
- Redis on `localhost:6379`

### 4) Start backend (terminal B)
Run in project root:

```bash
pnpm run backend/dev
```

Backend URL:
- `http://localhost:3001`

What this command does:
- checks Postgres/Redis availability
- if needed, tries `docker compose up -d postgres redis`
- runs `prisma generate` and `prisma migrate deploy`
- starts API watch mode
- starts workers (`execution` + `market-stream`) by default

Optional:
- to run API without worker auto-start, set:
```bash
BACKEND_DEV_START_WORKERS=false pnpm run backend/dev
```

### 5) Start frontend (terminal C)
Run in project root:

```bash
pnpm run frontend/dev
```

Frontend URL:
- `http://localhost:3002`

### 6) Start runtime workers manually (optional)
Run in project root:

```bash
pnpm run workers/dev
```

This starts:
- execution worker
- market-stream worker

Use this only when you intentionally disable worker auto-start in `backend/dev`
or when you want a separate worker terminal.

## Minimal number of terminals (VS Code)
- Standard full runtime: 2 terminals
  - `pnpm run backend/dev`
  - `pnpm run frontend/dev`
- API-only + separate workers (advanced/manual): 3 terminals
  - `BACKEND_DEV_START_WORKERS=false pnpm run backend/dev`
  - `pnpm run frontend/dev`
  - `pnpm run workers/dev`

## Markets module structure
- `/dashboard/markets/list`: table of market groups with filter, sortable columns, edit/delete actions
- `/dashboard/markets/create`: market group creator for bot/backtest/other modules
- `/dashboard/markets/:id/edit`: same creator in edit mode for an existing group
- Delete action uses reusable confirmation modal component.
- Markets table uses reusable data table component (can be reused in bots/strategies modules).

## Troubleshooting (Windows + Prisma)
- If you see `EPERM ... query_engine-windows.dll.node`, close all running Node processes (server/workers/frontend) and run:
```bash
pnpm run backend/dev
```
- If you need seed after that:
```bash
pnpm --dir apps/api exec prisma db seed
```

## Browser vs Terminal
- In terminal you run services (`docker`, `server`, `client`).
- In browser you open `http://localhost:3002` to use the app.
- API is available at `http://localhost:3001`.

## Production-like local start
Server:

```bash
pnpm --filter api build
pnpm --filter api start
```

Client:

```bash
pnpm --filter web build
pnpm --filter web start
```

## Deploy on VPS (Coolify)

Canonical guide:
- `docs/operations/coolify-linux-vps-setup-guide.md`
- fallback without Coolify: `docs/operations/vps-docker-compose-fallback-guide.md`

Dockerfile artifacts used by Coolify:
- API: `apps/api/Dockerfile`
- Web: `apps/web/Dockerfile`
- Workers: reuse `apps/api/Dockerfile` with command override (`node dist/workers/<worker>.worker.js`)

Quick local verification before first VPS deploy:

```bash
docker build -f apps/api/Dockerfile -t cryptosparrow-api:local .
docker build -f apps/web/Dockerfile -t cryptosparrow-web:local .
```

VPS fallback env template:
- `.env.vps.example` (copy to `.env.vps` for `docker-compose.vps.yml`)

If Coolify shows `failed to read dockerfile`, verify Dockerfile path in service config.

## Load Testing (Server)
With backend running on `http://localhost:3001`:

```bash
pnpm --filter api test:load:baseline
pnpm --filter api test:load:stress
```

Useful overrides:
- `LOAD_TEST_TARGET_URL` (default `http://localhost:3001`)
- `LOAD_TEST_DURATION_MS`
- `LOAD_TEST_CONCURRENCY`
- `LOAD_TEST_PATHS` (comma-separated paths, default `/health,/ready,/metrics,/workers/health`)

## Recent changes in this setup
- Added root workspace scripts in `package.json`: `lint`, `typecheck`, `test`, `build`.
- Added CI workflow: `.github/workflows/ci.yml`.
- Fixed server build runtime path by compiling server to CommonJS (`apps/api/tsconfig.json`).
- Added local runbook: `docs/engineering/local-development.md`.
- Added MVP ops runbook (deployment + recovery): `docs/operations/mvp-ops-runbook.md`.
- Added V1 operator handbook: `docs/operations/operator-handbook.md`.
- Added V1 user guide (onboarding/safety/FAQ): `docs/operations/user-guide.md`.
- Added localization QA checklist: `docs/ux/localization-qa.md`.
- Added optional dashboard isometric visual mode toggle.
- Added logs decision-trace explorer (metadata drill-down in dashboard logs).
- Added risk-first LIVE confirmation prompts in bots management flow.
- Added dashboard design-system documentation for shared UI standards.
- Added dashboard accessibility audit checklist and active-nav accessibility semantics.
- Added V1 release candidate checklist: `docs/operations/v1-release-candidate-checklist.md`.
- Added V1 stabilization freeze and bug bash plan: `docs/operations/v1-stabilization-freeze.md`.
- Added V1 post-release monitoring and hotfix protocol: `docs/operations/v1-post-release-monitoring.md`.
- Added V1 7-day launch review template and V1.1 backlog cut framework: `docs/operations/v1-launch-review-template.md`.
- Added V1 changelog and migration notes: `docs/operations/v1-changelog.md`, `docs/operations/v1-migration-notes.md`.
- Added V1 go-live smoke pack commands and scope: `docs/operations/v1-go-live-smoke-pack.md`.
- Added spot-support groundwork on bots via `marketType` (`FUTURES`/`SPOT`) schema/API field.
- Added `marketType` selection in dashboard bots create/edit flow.
- Added Binance API-key onboarding and troubleshooting runbook: `docs/operations/binance-api-key-onboarding-runbook.md`.

