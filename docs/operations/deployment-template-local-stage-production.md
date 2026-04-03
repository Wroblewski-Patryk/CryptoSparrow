# Deployment Template (Local -> Stage -> Production)

Purpose: reusable deployment template for new apps/projects hosted on VPS + Coolify.

## Phase 0: Prerequisites
1. Repository has Dockerfiles for all runtime services.
2. Environment variables are defined in a single source of truth.
3. DB migration strategy exists (`migrate deploy`, rollback policy).
4. Domain map is finalized:
   - web domain,
   - api domain,
   - stage equivalents.
5. Monitoring endpoints exist (`/health`, `/ready`).

## Phase 1: Local Gate
1. Install deps and run typecheck.
2. Run core tests relevant to auth, persistence, and critical flows.
3. Build API and web artifacts.
4. Run local smoke:
   - login,
   - protected route,
   - create/list persistence checks.
5. Create immutable commit SHA.

## Phase 2: Stage Deploy
1. Deploy exact SHA to stage services:
   - api,
   - web,
   - all workers,
   - postgres/redis bindings validated.
2. Run migration gate against stage DB.
3. Validate stage health:
   - `GET /health`,
   - `GET /ready`,
   - worker health.
4. Run stage smoke:
   - login -> dashboard redirect,
   - create/list strategy,
   - create/list market universe,
   - critical business flow smoke.
5. Record evidence (timestamp, SHA, operator, pass/fail).

## Phase 3: Production Promotion
1. Promote the same SHA from stage to production.
2. Verify production env values match approved matrix.
3. Re-run migrations if required by release process.
4. Run production smoke (same checklist as stage).
5. Mark release healthy only after smoke pass.

## Mandatory Service Contract (Coolify)
1. API service:
   - stable domain,
   - DB + Redis connectivity,
   - auth/env secrets present.
2. Web service:
   - points to correct public API base URL.
3. Worker services:
   - separate processes for each queue/runtime worker.
4. Data services:
   - persistent storage,
   - backup policy configured.

## Fast Triage Matrix
1. Symptom: `no available server` on web.
   Action: verify target service is running and domain is attached to correct Coolify app.
2. Symptom: Prisma table missing.
   Action: run/apply migrations on target DB; verify DB URL points to correct environment.
3. Symptom: login succeeds but redirect/session inconsistent.
   Action: verify cookie domain config and duplicate-cookie handling; run auth smoke with mixed cookies.
4. Symptom: create shows success but list is empty.
   Action: verify request auth identity consistency (`/auth/me` and create/list under same session).
5. Symptom: runtime stale/no updates.
   Action: verify all workers are healthy and consuming expected queues.

## Post-Deploy Evidence Template
Record:
1. SHA:
2. Environment (`stage`/`prod`):
3. Deployed services:
4. Migration status:
5. Health checks result:
6. Smoke checks result:
7. Incident/rollback needed (`yes/no`):
8. Notes:

