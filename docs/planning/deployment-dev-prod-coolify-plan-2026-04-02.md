# Deployment Plan (DEV/STAGE/PROD + Local + Coolify VPS)

Date: 2026-04-02  
Owner: Execution Team (Ops + Backend + Frontend)

## Goal
Make startup and deployment predictable and low-friction in three modes:
- `DEV` for local iteration.
- `STAGE` (test environment on VPS) for automatic verification of incoming commits.
- `PROD` for user-facing stable runtime on VPS.

## Canonical Output Documents
- `docs/operations/dev-stage-prod-environment-matrix.md` (environment + secrets contract)
- `docs/operations/coolify-linux-vps-setup-guide.md` (VPS setup + service mapping + domains)

## Requested Target
- Web domain: `cryptosparrow.luckysparrow.ch`
- API domain: `api.cryptosparrow.luckysparrow.ch`
- Follow-up track: global brand rename planning `CryptoSparrow -> Soar`.

## Scope
- Define canonical runtime topology for local and VPS.
- Define environment variable contract and environment split.
- Define deployment, promotion, update, and rollback flow for Coolify on Linux VPS.
- Define implementation queue in tiny-commit style for executor handoff.

## Out Of Scope (This Plan)
- Full rename execution (`CryptoSparrow -> Soar`) in code/docs/assets.
- New exchange-provider features.
- Billing/admin roadmap changes.

## Canonical Runtime Topology

### Local DEV
1. Infra: Postgres + Redis from `docker compose`.
2. API: `pnpm run backend/dev` (watch mode, dev helper flow).
3. Web: `pnpm run frontend/dev`.
4. Workers: auto-started by dev backend helper, or manually via `pnpm run workers/dev`.

### Local PROD-Like
1. Infra: Postgres + Redis from `docker compose`.
2. API: `pnpm --filter api build` then `pnpm --filter api start`.
3. Web: `pnpm --filter web build` then `pnpm --filter web start`.
4. Workers: separate process in production mode (not coupled to API `start`).

### VPS PROD (Coolify)
Recommended split:
1. `postgres` service (managed container/volume).
2. `redis` service (managed container/volume).
3. `api` service (build + start command).
4. `web` service (build + start command).
5. `workers` service (execution + market-stream worker process).

Rationale:
- Clear scaling and restart boundaries.
- Safer incident handling (restart workers without API downtime).
- Better health signal ownership per service.

### VPS STAGE (Coolify)
Recommended mirror of PROD:
1. `stage-postgres` service (separate DB from prod).
2. `stage-redis` service (separate cache/broker from prod).
3. `stage-api` service.
4. `stage-web` service.
5. `stage-workers` service.

Rationale:
- Safe validation before impacting real users.
- High environment parity with production behavior.
- Automatic promotion gates can rely on realistic runtime checks.

## Environment Matrix

### DEV (local)
- Developer workstation.
- Fast iteration and watch mode.

### STAGE (test on VPS)
- Automatic deployment target after commit push.
- Full test + smoke + health gate.
- Promotion candidate for PROD only if green.

### PROD (user-facing on VPS)
- Receives commit only after successful STAGE gate.
- Uses stricter rollback and incident rules.

## Environment Split Contract

### DEV
- Local `.env` files and developer defaults allowed.
- Exchange keys optional for local LIVE tests only.

### STAGE
- No secrets in repository files.
- All secrets provided by Coolify environment variables.
- Values isolated from PROD resources (DB/Redis/keys/URLs).

### PROD
- No secrets in repository files.
- All secrets provided by Coolify environment variables.
- Explicit production values for URLs, CORS, JWT, DB, Redis, and crypto keys.

### Required Production Env Matrix
- API core:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `SERVER_URL`
  - `CLIENT_URL`
  - `CORS_ORIGINS`
  - `API_KEY_ENCRYPTION_KEYS`
  - `API_KEY_ENCRYPTION_ACTIVE_VERSION`
- Web core:
  - `NODE_ENV=production`
  - `NEXT_PUBLIC_API_BASE_URL=https://api.cryptosparrow.luckysparrow.ch`
  - `JWT_SECRET` (required by middleware contract)
- Workers:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `REDIS_URL`
  - Worker-specific queue/runtime vars as needed.

## Coolify Execution Blueprint
1. Provision VPS with Docker and Coolify.
2. Create project/app in Coolify from repository.
3. Configure `postgres` and `redis` managed services with persistent volumes.
4. Configure `api`, `web`, and `workers` services from monorepo.
5. Attach domains:
   - `cryptosparrow.luckysparrow.ch -> web`
   - `api.cryptosparrow.luckysparrow.ch -> api`
6. Configure env vars per service.
7. Add health checks:
   - API: `/health`, `/ready`.
   - Web: HTTP 200 on root path.
   - Workers: API `/workers/health` and `/workers/ready` as operational validation.
8. Run migration step before final API start.
9. Execute go-live smoke pack.
10. Record deployment evidence in operations docs.

## Automatic Update and Promotion Flow
Target flow requested by product owner:
1. Developer makes changes locally (`DEV`).
2. Developer pushes commit to integration branch.
3. Pipeline auto-deploys commit to `STAGE` on VPS.
4. VPS/STAGE runs:
   - build checks,
   - automated tests,
   - health/readiness checks,
   - smoke checks for web/api/workers.
5. If all gates pass, pipeline promotes same commit SHA to `PROD`.
6. PROD rollout executes zero/low-downtime update sequence.
7. If any gate fails, promotion is blocked and PROD remains unchanged.

## Git Branch and Promotion Contract
Suggested baseline:
- `develop` -> auto deploy to `STAGE`.
- `main` -> protected production branch.
- promotion job creates fast-forward or controlled merge to `main` only after green STAGE gate.

Alternative (single branch):
- `main` commit first deploys to `STAGE`,
- after green gate, same SHA is auto-promoted to `PROD`.

## Deployment Gate Pack (STAGE -> PROD)
Minimum required gate set:
1. Dependency install and build pass (`api`, `web`).
2. Migration dry/real step pass for stage DB.
3. Automated test suite pass (at least impacted critical suites).
4. API health and readiness pass.
5. Web availability and API connectivity smoke pass.
6. Workers health signal pass.

## Rollback Strategy for Auto-Promotion
1. Keep previous deploy artifact/tag for both STAGE and PROD.
2. On failed PROD post-deploy health, auto-rollback to previous stable tag.
3. Keep migration policy backward-safe or explicitly reversible before enabling full auto-promotion.
4. Record failed promotion event in ops log with failing gate and commit SHA.

## Tiny-Commit Execution Queue (Executor Handoff)
- `DPL-01 docs(contract): publish canonical DEV/STAGE/PROD environment matrix and secrets policy`
- `DPL-02 docs(runbook): write step-by-step local DEV and local PROD-like startup procedures`
- `DPL-03 docs(coolify): publish Linux VPS Coolify setup guide with service mapping and domain routing`
- `DPL-04 chore(env): add non-secret `.env.example` templates for api/web with clear required keys`
- `DPL-05 chore(scripts): add production-safe worker start script and document process ownership`
- `DPL-06 chore(scripts): add one-command local prod-like orchestration (build/start order + preflight checks)`
- `DPL-07 ops(migrations): define migration strategy for deployment pipeline (who/when/how)`
- `DPL-08 ops(health): standardize readiness checks and deployment gate criteria`
- `DPL-09 ops(smoke): create post-deploy smoke checklist for web/api/workers on target domains`
- `DPL-10 ops(rollback): define rollback playbook for app version, env rollback, and worker incidents`
- `DPL-11 docs(rename-audit): inventory all `CryptoSparrow` tokens and classify safe rename waves`
- `DPL-12 docs(rename-plan): define global rename rollout `CryptoSparrow -> Soar` with risk gates`
- `DPL-13 docs(cicd-contract): define commit promotion contract `DEV -> STAGE -> PROD` with immutable SHA handoff`
- `DPL-14 ci(stage): implement automatic deploy-to-stage workflow on integration branch push`
- `DPL-15 ci(stage-gates): run stage gate pack (build/test/migrate/health/smoke) and publish structured report`
- `DPL-16 ci(promote): implement auto-promotion to prod when stage gate is fully green`
- `DPL-17 ci(prod-rollback): implement automatic rollback on failed post-deploy prod health gates`
- `DPL-18 ops(coolify): wire Coolify API/webhook deployment triggers for stage and prod`
- `DPL-19 security(ci): harden CI secrets and branch protections for safe auto-promotion`
- `DPL-20 docs(runbook): publish incident playbook for blocked promotion, failed stage, and failed prod rollout`

## Acceptance Criteria
- Developer can start `DEV` locally from one clear instruction path.
- Developer can run local `PROD`-like mode from one clear instruction path.
- Commit can be validated automatically on VPS `STAGE`.
- Green `STAGE` commit can be promoted automatically to `PROD` as same SHA.
- Executor can deploy to Coolify VPS using one runbook without hidden steps.
- Domain and env setup are explicit for web/api split.
- Workers are explicitly handled as production runtime process, not implicit side-effect.
- Rename track is planned as separate controlled rollout with inventory first.

## Risks And Mitigations
- Risk: hidden dependency on dev helper scripts.
  - Mitigation: explicit prod commands and worker ownership documentation.
- Risk: inconsistent env variables across services.
  - Mitigation: single env matrix and `.env.example` contract.
- Risk: runtime works locally but not in VPS due to process split.
  - Mitigation: dedicated `workers` service and readiness checks.
- Risk: broken commit promoted to users.
  - Mitigation: mandatory STAGE gates and immutable-SHA promotion.
- Risk: failed migration during auto-rollout.
  - Mitigation: migration guard strategy + rollback automation + backward-compatible migration policy.
- Risk: global rename breaks routing/assets/contracts.
  - Mitigation: audit-first rename waves with rollback points.
