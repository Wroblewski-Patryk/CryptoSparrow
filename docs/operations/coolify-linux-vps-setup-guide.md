# Coolify Linux VPS Setup Guide (Service Mapping + Domains)

Date: 2026-04-03  
Owner: Ops + Release Engineering  
Scope: `DPL-03`

## Purpose
Provide one repeatable setup path for hosting CryptoSparrow on a Linux VPS with Coolify, including:
- service split (`postgres`, `redis`, `api`, `web`, `workers`),
- domain routing,
- deployment checks.

This guide is for STAGE and PROD environments.

## Target Topology

For each environment (`stage` and `prod`) deploy:
1. Postgres service
2. Redis service
3. API service (`apps/api`)
4. Web service (`apps/web`)
5. Workers service (`apps/api` workers)

Do not run workers inside API process in VPS deployment.

## Domain Routing Contract

Production:
- Web: `cryptosparrow.luckysparrow.ch`
- API: `api.cryptosparrow.luckysparrow.ch`

Stage (recommended pattern):
- Web: `stage-cryptosparrow.luckysparrow.ch`
- API: `stage-api.cryptosparrow.luckysparrow.ch`

## Prerequisites

On VPS host:
- Docker Engine installed
- Coolify installed and reachable
- DNS records prepared for web/api domains
- Firewall open for HTTPS (`443`) and Coolify access path

Repository requirements:
- monorepo available to Coolify
- lockfile present (`pnpm-lock.yaml`)

## Step 1: Create Coolify Project and Environment

1. In Coolify, create project: `cryptosparrow`.
2. Create environment:
   - `stage` (first),
   - `prod` (after stage validation).
3. Keep stage and prod resources separate.

## Step 2: Provision Data Services

### Postgres
- Add managed Postgres service.
- Persistent volume required.
- Set database name/user/password.
- Capture internal connection string for app services.

### Redis
- Add managed Redis service.
- Persistent volume recommended.
- Capture internal connection string.

## Step 3: Add API Service (`apps/api`)

Build/deploy configuration:
- Source: repository root
- Working directory: `apps/api`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Start command: `pnpm start`
- Exposed port: `3001`

Health checks:
- `/health`
- `/ready`

Required environment variables:
- `NODE_ENV=production`
- `DATABASE_URL=<coolify-postgres-url>`
- `REDIS_URL=<coolify-redis-url>`
- `SERVER_URL=https://api.<env-domain>`
- `CLIENT_URL=https://<web-env-domain>`
- `CORS_ORIGINS=https://<web-env-domain>`
- `JWT_SECRET=<secret>`
- `API_KEY_ENCRYPTION_KEYS=<versioned-keys>`
- `API_KEY_ENCRYPTION_ACTIVE_VERSION=<active-version>`

Reference: `docs/operations/dev-stage-prod-environment-matrix.md`

## Step 4: Add Web Service (`apps/web`)

Build/deploy configuration:
- Source: repository root
- Working directory: `apps/web`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Start command: `pnpm start`
- Exposed port: `3002` (or default Next start port mapped by Coolify)

Required environment variables:
- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE_URL=https://api.<env-domain>`
- `JWT_SECRET=<secret>`

## Step 5: Add Workers Service

Create a dedicated worker service from `apps/api`.
Process ownership contract: `api` does not own worker lifecycle in production.

Recommended strategy: one process per worker type (separate services), or one service running a process manager.
For simplest deterministic setup, create separate services:
- `workers-market-data`: `node dist/workers/marketData.worker.js`
- `workers-market-stream`: `node dist/workers/marketStream.worker.js`
- `workers-backtest`: `node dist/workers/backtest.worker.js`
- `workers-execution`: `node dist/workers/execution.worker.js`

Shared worker env:
- `NODE_ENV=production`
- `DATABASE_URL=<coolify-postgres-url>`
- `REDIS_URL=<coolify-redis-url>`
- runtime/queue keys required by current worker contract (`WORKER_*`, selected `RUNTIME_*`)

## Step 6: Attach Domains and TLS

1. Attach web domain to web service.
2. Attach api domain to api service.
3. Enable managed TLS in Coolify.
4. Verify certificates issued and routing healthy.

## Step 7: Migrations Before Go-Live

Before first stage/prod release:
1. Run DB migration job against target DB.
2. Confirm Prisma schema is up to date.
3. Confirm API starts without migration drift errors.

If migration fails, do not continue deployment.

## Step 8: Stage Validation Gate

After STAGE deploy:
1. `GET /health` -> `200`
2. `GET /ready` -> `200`
3. Open stage web URL and login flow.
4. Validate dashboard base data load.
5. Validate workers heartbeat and runtime update path.

Only promote same commit SHA to PROD after full pass.

## Step 9: Production Rollout

1. Promote immutable SHA from STAGE to PROD.
2. Run same health checks.
3. Run smoke checks from runbook:
   - `docs/operations/v1-ops-runbook.md`
4. Record deployment evidence.

## Rollback Baseline

If post-deploy health fails:
1. Roll back API/Web to previous stable release.
2. Keep DB safety in mind (prefer backward-compatible migrations).
3. Re-validate `/health` and `/ready`.
4. Log incident and rollback reason.

## Common Failure Points

1. Wrong `NEXT_PUBLIC_API_BASE_URL` -> web cannot reach API.
2. Stage using prod DB/Redis by mistake.
3. Missing worker service -> runtime data stale.
4. Missing `JWT_SECRET` in web middleware scope.
5. API CORS not matching web domain.

## References
- `docs/operations/dev-stage-prod-environment-matrix.md`
- `docs/engineering/local-development.md`
- `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`
- `docs/operations/v1-ops-runbook.md`
