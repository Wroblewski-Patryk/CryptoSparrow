# VPS / Coolify Deployment Hardening Plan (2026-04-03)

Status: in progress  
Owner: Ops + Backend + Frontend  
Scope: production deployment path for CryptoSparrow on VPS with Coolify, plus non-Coolify fallback.

## 1) Diagnosis (current state)

Verified on repo state:
- Root Docker build fails because repository does not contain a project `Dockerfile`.
- Command used for verification:
  - `docker build -t cryptosparrow-probe .`
  - Result: `failed to read dockerfile: open Dockerfile: no such file or directory`.
- `docker-compose.yml` exists, but only for local infra (`postgres`, `redis`), not app services.
- Existing Coolify docs described service mapping, but deployment contract was still command/buildpack-oriented and not locked to reproducible Dockerfile artifacts for monorepo services.

Impact:
- Coolify Docker mode cannot build app services.
- Production deployment contract was not deterministic/reproducible across environments.

---

## 2) Target production contract

Deploy as separate services:
1. `api` (`apps/api`)
2. `web` (`apps/web`)
3. `workers-market-data`
4. `workers-market-stream`
5. `workers-backtest`
6. `workers-execution`
7. managed `postgres`
8. managed `redis`

Deployment source contract:
- Prefer Dockerfile-based builds in Coolify for all app services.
- One immutable image/build per commit SHA.
- Stage -> Prod promotion on same SHA only.

---

## 3) Implementation plan (tiny commits)

## Phase A - Docker artifacts for monorepo services
- [x] `DPL-21 chore(docker): add root .dockerignore for monorepo-safe context (exclude node_modules, logs, temp, local env files)`
- [x] `DPL-22 feat(docker-api): add apps/api/Dockerfile (multi-stage build, prisma generate, production runtime, non-root user)`
- [x] `DPL-23 feat(docker-web): add apps/web/Dockerfile (multi-stage next build + production start, non-root user)`
- [x] `DPL-24 feat(docker-workers): add worker runtime image contract (shared Dockerfile or dedicated Dockerfile.workers with ENTRYPOINT/CMD per worker)`
- [x] `DPL-25 test(docker): local image build checks for api/web/workers with explicit build args and smoke run`

Exit criteria:
- `docker build` succeeds for each service image.
- Containers can start with production env set and connect to DB/Redis.

## Phase B - Coolify production runbook (canonical)
- [x] `DPL-26 docs(coolify-runbook): publish canonical Coolify setup with exact fields (build context, Dockerfile path, ports, domains, env contract)`
- [x] `DPL-27 docs(coolify-workers): document worker services mapping (4 workers), restart policy, and ownership separation from API`
- [x] `DPL-28 docs(readme): add "Deploy on VPS (Coolify)" section linking to canonical runbook + quick checklist`

Exit criteria:
- Operator can deploy stage/prod from docs only, without guessing build config.

## Phase C - Non-Coolify VPS fallback
- [ ] `DPL-29 feat(vps-compose): add docker-compose.vps.yml (api/web/workers + optional postgres/redis profiles)`
- [ ] `DPL-30 docs(vps-compose): add fallback runbook for plain Docker Compose on VPS`

Exit criteria:
- Single-host VPS deployment possible without Coolify.

## Phase D - Validation and safety
- [ ] `DPL-31 chore(deploy-smoke): add post-deploy smoke script/command pack (health, ready, web reachability, worker heartbeat)`
- [ ] `DPL-32 docs(ops-gates): extend ops runbook with Dockerfile-based deploy gates and rollback specifics`

Exit criteria:
- Deployment and rollback paths are testable and documented end-to-end.

---

## 4) Required documentation outputs

Must exist after rollout:
- `README.md` section: "Deploy on VPS (Coolify)" with short quickstart.
- `docs/operations/coolify-linux-vps-setup-guide.md` updated to Dockerfile-first setup.
- New fallback doc for non-Coolify deploy.
- Updated environment matrix links and references.

---

## 5) Known risks and mitigations

Risk: Prisma client/runtime mismatch in container.
- Mitigation: run `prisma generate` during image build for API and ensure runtime includes generated client.

Risk: monorepo install/build context too large and slow.
- Mitigation: strict `.dockerignore` and multi-stage builds.

Risk: worker crash loops hidden in deployment UI.
- Mitigation: explicit worker-per-service mapping + health/heartbeat verification in smoke checklist.

Risk: stage/prod env drift.
- Mitigation: keep `docs/operations/dev-stage-prod-environment-matrix.md` as canonical env contract and reference in runbook.

---

## 6) Immediate next action

Continue with Phase C fallback path (`docker-compose.vps.yml` + plain VPS runbook), then extend ops smoke/rollback gates for Dockerfile-based deployment flow.

---

## Progress log

- 2026-04-03: Completed `DPL-21` by adding root `.dockerignore` for monorepo-safe Docker build context (excluded local env files, node_modules, logs, transient outputs).
- 2026-04-03: Completed `DPL-22` by adding `apps/api/Dockerfile` (multi-stage install/build/runtime, Prisma generate, API runtime entrypoint).
- 2026-04-03: Completed `DPL-23` by adding `apps/web/Dockerfile` (multi-stage Next.js build and production runtime start on port 3002).
- 2026-04-03: Completed `DPL-24` via shared API image contract for workers (Coolify command override to `node dist/workers/<worker>.worker.js`).
- 2026-04-03: Completed `DPL-25` by verifying local builds:
  - `docker build -f apps/api/Dockerfile -t cryptosparrow-api:local .` (PASS)
  - `docker build -f apps/web/Dockerfile -t cryptosparrow-web:local .` (PASS)
- 2026-04-03: Completed `DPL-26` and `DPL-27` by updating `docs/operations/coolify-linux-vps-setup-guide.md` to Dockerfile-first service definitions (api/web + 4 worker services) with explicit build context and command overrides.
- 2026-04-03: Completed `DPL-28` by adding README deployment quickstart section with Dockerfile paths and preflight build commands.
