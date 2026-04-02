# Local DEV and Local PROD-like Startup Runbook

Canonical scope for local runtime startup procedures:
- `DEV` (watch mode, fast iteration)
- `local PROD-like` (build + start, near-deploy behavior)

## Prerequisites
- Node.js 20+
- pnpm 10+
- Docker Desktop (Postgres + Redis)

## Environment Baseline
Prepare local env files before first run:
- `apps/api/.env`
- `apps/web/.env.local`

Minimum local endpoints:
- API target: `http://localhost:3001`
- Web target: `http://localhost:3002`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## A) Local DEV Startup (watch mode)

### 1) Install dependencies (repo root)
```bash
pnpm install
```

### 2) Start infrastructure (repo root)
```bash
docker compose up -d postgres redis
docker compose ps
```

Expected:
- `postgres` is `Up` on `5432`
- `redis` is `Up` on `6379`

### 3) Start API (terminal #1, repo root)
```bash
pnpm --filter api dev
```

### 4) Start Web (terminal #2, repo root)
```bash
pnpm --filter web dev
```

### 5) Start workers (terminal #3, repo root; recommended for runtime features)
```bash
pnpm run workers/dev
```

### 6) DEV verification
- open `http://localhost:3002`
- confirm API reachable at `http://localhost:3001/health`
- in bots/dashboard flows, confirm runtime data is updating (workers active)

## B) Local PROD-like Startup (build + start)

Use this mode to validate behavior close to STAGE/PROD process ownership.

### 1) Start infrastructure (repo root)
```bash
docker compose up -d postgres redis
docker compose ps
```

### 2) Build API + Web (repo root)
```bash
pnpm --filter api build
pnpm --filter web build
```

### 3) Start API in production mode (terminal #1, repo root)
```bash
pnpm --filter api start
```

### 4) Start Web in production mode (terminal #2, repo root)
```bash
pnpm --filter web start
```

### 5) Start workers from built artifacts (separate terminals, repo root)
```bash
pnpm --filter api exec node dist/workers/marketData.worker.js
pnpm --filter api exec node dist/workers/marketStream.worker.js
pnpm --filter api exec node dist/workers/backtest.worker.js
pnpm --filter api exec node dist/workers/execution.worker.js
```

### 6) PROD-like verification
- `GET http://localhost:3001/health` -> `200`
- `GET http://localhost:3001/ready` -> `200`
- open `http://localhost:3002`
- login + open `/dashboard`
- if bots are enabled, confirm runtime updates with no watch tooling

## Stop / Cleanup

Stop app processes in their terminals (`Ctrl+C`), then:
```bash
docker compose down
```

## Quality Gate (Typecheck)
- `pnpm --filter api run typecheck`
- `pnpm --filter web run typecheck`
- `pnpm run typecheck` (aggregate root)

## Related Docs
- `docs/operations/dev-stage-prod-environment-matrix.md`
- `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`

