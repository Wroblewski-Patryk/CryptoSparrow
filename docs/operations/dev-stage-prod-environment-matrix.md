# DEV/STAGE/PROD Environment Matrix and Secrets Policy

Date: 2026-04-03  
Owner: Ops + Backend + Frontend  
Scope: canonical contract for local DEV, VPS STAGE, VPS PROD.

## Purpose
- Define one immutable environment contract for all runtime services (`api`, `web`, `workers`).
- Prevent secret drift between environments.
- Ensure promotion flow (`DEV -> STAGE -> PROD`) uses predictable configuration.

This document is canonical for environment/secrets policy. If another doc differs, this doc wins.

## Environment Matrix

| Environment | Runtime intent | Infra source | Data isolation | Deploy source | Secret source |
|---|---|---|---|---|---|
| DEV | Local development and debugging | Local Docker (`postgres`, `redis`) | Local only | Local `pnpm` | Local `.env` files (never committed) |
| STAGE | Pre-prod validation on VPS | Coolify managed services (`stage-postgres`, `stage-redis`) | Isolated from PROD | CI deploy to stage | Coolify env vars only |
| PROD | User-facing runtime | Coolify managed services (`postgres`, `redis`) | Production only | Promotion from green STAGE SHA | Coolify env vars only |

## Service Variable Contract

### API (`apps/api`)

Required in STAGE/PROD:
- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `SERVER_URL`
- `CLIENT_URL`
- `CORS_ORIGINS`
- `JWT_SECRET`
- `API_KEY_ENCRYPTION_KEYS`
- `API_KEY_ENCRYPTION_ACTIVE_VERSION`

Optional but supported:
- `JWT_SECRET_PREVIOUS`
- `JWT_SECRET_PREVIOUS_UNTIL`
- `COOKIE_DOMAIN`
- `COOKIE_SAME_SITE`
- `API_AUTO_MIGRATE` (default `true`; controls `prisma migrate deploy` on API startup)
- Runtime tuning flags (`RUNTIME_*`, `WORKER_*`, `MARKET_STREAM_*`, `OPS_*`)

### Web (`apps/web`)

Required in STAGE/PROD:
- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE_URL`

### Workers (`apps/api` worker process)

Required in STAGE/PROD:
- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- Queue/runtime keys used by workers (`WORKER_*`, selected `RUNTIME_*`)

## Secrets Classification

### Class A (critical secrets)
- `DATABASE_URL`
- `REDIS_URL` (if credentialed)
- `JWT_SECRET`
- `JWT_SECRET_PREVIOUS`
- `API_KEY_ENCRYPTION_KEYS`

Rules:
- Never stored in repository.
- Never printed in logs, errors, CI output, screenshots, or docs.
- Managed only in Coolify secrets for STAGE/PROD.
- Rotation must preserve continuity (for JWT and encryption keys).

### Class B (sensitive operational configuration)
- `CORS_ORIGINS`
- `SERVER_URL`, `CLIENT_URL`
- `OPS_ALLOWED_IPS`
- Exchange test toggles and runtime tuning flags.

Rules:
- Keep environment-specific values separated per env.
- Changes require change note in operations/planning logs.

### Class C (public/non-secret runtime config)
- `NODE_ENV`
- `NEXT_PUBLIC_API_BASE_URL`
- Non-sensitive feature toggles.

Rules:
- Safe to document.
- Still environment-scoped and must not point STAGE to PROD endpoints.

## Non-Negotiable Policy Rules

1. No secrets in git history.
- `.env`, `.env.*`, local dumps, and copied production env snapshots must stay untracked.

2. No cross-environment secret reuse without explicit approval.
- STAGE and PROD secrets are separate values by default.

3. Promotion uses immutable artifact SHA.
- The same commit SHA validated on STAGE is promoted to PROD.
- Only environment variables differ between STAGE and PROD.

4. Secret rotation is mandatory and auditable.
- `JWT_SECRET_PREVIOUS` + `JWT_SECRET_PREVIOUS_UNTIL` used for safe JWT rotation windows.
- `API_KEY_ENCRYPTION_KEYS` is versioned; `API_KEY_ENCRYPTION_ACTIVE_VERSION` must point to active key.

5. Log redaction is mandatory.
- Any diagnostic output that may include env values must be sanitized.

## Validation Checklist (per environment)

Before declaring env ready:
- API `/health` and `/ready` return `200`.
- Web can reach API via configured `NEXT_PUBLIC_API_BASE_URL`.
- Workers report healthy heartbeat.
- DB and Redis point to expected environment resources.
- Class A secrets present and non-empty.
- No STAGE endpoint references in PROD and no PROD credentials in STAGE.

## Related Documents
- `docs/planning/deployment-dev-prod-coolify-plan-2026-04-02.md`
- `docs/operations/v1-ops-runbook.md`
- `docs/operations/v1-rc-external-gates-runbook.md`
