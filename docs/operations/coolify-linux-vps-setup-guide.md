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

Docker build configuration (Coolify):
- Source: repository root (monorepo)
- Build pack: `Dockerfile`
- Docker build context: repository root (`.`)
- Dockerfile location: `apps/api/Dockerfile`
- Exposed port: `3001`

Runtime command:
- keep image default command (`node dist/index.js`)

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

Docker build configuration (Coolify):
- Source: repository root (monorepo)
- Build pack: `Dockerfile`
- Docker build context: repository root (`.`)
- Dockerfile location: `apps/web/Dockerfile`
- Exposed port: `3002`

Runtime command:
- keep image default command (`pnpm --filter web start`)

Required environment variables:
- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE_URL=https://api.<env-domain>`
- `JWT_SECRET=<secret>`

## Step 5: Add Workers Service

Create dedicated worker services from the same API image.
Process ownership contract: `api` does not own worker lifecycle in production.

For deterministic production behavior create separate services:
- `workers-market-data`
- `workers-market-stream`
- `workers-backtest`
- `workers-execution`

Each worker service config:
- Build pack: `Dockerfile`
- Docker build context: repository root (`.`)
- Dockerfile location:
  - `workers-market-data` -> `apps/api/Dockerfile.worker.market-data`
  - `workers-market-stream` -> `apps/api/Dockerfile.worker.market-stream`
  - `workers-backtest` -> `apps/api/Dockerfile.worker.backtest`
  - `workers-execution` -> `apps/api/Dockerfile.worker.execution`
- Exposed port: none

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
6. Wrong Dockerfile path in Coolify (must point to `apps/api/Dockerfile` or `apps/web/Dockerfile`).
7. Using Docker mode without repository Dockerfile artifacts.

## References
- `docs/operations/dev-stage-prod-environment-matrix.md`
- `docs/operations/coolify-trigger-wiring.md`
- `docs/engineering/local-development.md`
- `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`
- `docs/operations/v1-ops-runbook.md`
