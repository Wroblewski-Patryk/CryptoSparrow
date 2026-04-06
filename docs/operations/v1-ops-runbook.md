# V1 Ops Runbook

## Scope
Operational baseline for production deployment, rollback, and incident response for V1.

## Process Ownership Contract
- `api` process owns HTTP endpoints only.
- `web` process owns UI rendering only.
- `workers` processes own async execution pipelines only (`market-data`, `market-stream`, `backtest`, `execution`).

Non-negotiable rules:
1. Workers are not implicitly started by API in production mode.
2. Restarting workers must not require API restart.
3. Runtime incident handling can target worker scope without taking down web/api paths.

Production-safe worker start command (repo root):
```bash
pnpm run workers/prod
```

## Deployment Checklist
1. Verify latest `main` commit and changelog entry.
2. Confirm environment variables:
   - `JWT_SECRET`
   - `JWT_SECRET_PREVIOUS` (optional during rotation)
   - `JWT_SECRET_PREVIOUS_UNTIL` (optional, ISO datetime)
   - database and redis connection settings
   - canonical secret owners/cadence: `docs/security/v1-secrets-inventory.md`
3. Run CI-equivalent checks:
   - `pnpm --filter api build`
   - `pnpm --filter web build`
4. Build production Docker artifacts:
   - `docker build -f apps/api/Dockerfile -t cryptosparrow-api:<sha> .`
   - `docker build -f apps/web/Dockerfile -t cryptosparrow-web:<sha> .`
5. Apply DB migrations.
6. Deploy API, web, and worker artifacts.
   - Coolify path: `docs/operations/coolify-linux-vps-setup-guide.md`
   - VPS compose fallback: `docs/operations/vps-docker-compose-fallback-guide.md`
7. Run smoke command pack:
   - `pnpm run ops:deploy:smoke`
6. Validate post-deploy probes:
   - `GET /health` returns `200`
   - `GET /ready` returns `200`
7. Smoke test auth login and dashboard load.

## Ops Endpoint Proxy Trust Contract
Operational endpoints (`/metrics`, `/alerts`, `/workers/*`) are protected by auth + role + network guard.

Rules for proxy/IP trust:
1. Edge proxy must overwrite forwarding headers (`X-Forwarded-For`, `X-Real-IP`) and must not pass client-supplied values unchanged.
2. API must see the proxy hop as the direct socket peer (Docker/private network in Coolify/Traefik).
3. `x-forwarded-for` is trusted only when socket peer is trusted:
   - private ranges by default, or
   - explicit allowlist via `OPS_TRUSTED_PROXY_IPS` (comma-separated).
4. Allowed operator client sources for ops endpoints are controlled by:
   - `OPS_ALLOWED_IPS` (exact allowlist),
   - `OPS_ALLOW_PRIVATE_NETWORK` (`true|false`).

Recommended Coolify/Traefik practice:
- keep API service non-public except through Traefik route,
- configure Traefik to overwrite forwarding headers,
- set `OPS_ALLOW_PRIVATE_NETWORK=false` in production and use explicit `OPS_ALLOWED_IPS` + `OPS_TRUSTED_PROXY_IPS`.

## Rollback Checklist
1. Identify last known good release tag.
2. Re-deploy previous API, web, and worker artifacts (same stable SHA across services).
3. Ensure runtime ownership split remains intact after rollback:
   - API alive
   - web alive
   - all four workers alive
4. Re-run probes:
   - `GET /health`
   - `GET /ready`
   - `pnpm run ops:deploy:smoke`
5. Validate critical flows:
   - auth login/logout
   - dashboard list pages
   - exchange order path in paper mode
6. Record rollback reason and owner in incident log.
7. Validate incident against RTO/RPO targets:
   - `docs/operations/v1-rto-rpo-targets.md`

## Incident Playbook
### Severity Levels
- `SEV-1`: trading safety or user-impacting outage.
- `SEV-2`: partial degradation with workaround.
- `SEV-3`: minor degradation without major user impact.

### Response Flow
1. Open incident channel and assign commander.
2. Freeze risky changes and active deployments.
3. Capture current signals:
   - API health/readiness
   - latest structured API and exchange logs
4. Decide contain action:
   - temporary rollback
   - disable affected endpoint
   - activate kill-switch for live trading path
5. Communicate status every 15 minutes for SEV-1/SEV-2.
6. Recover service and validate smoke checks.
7. Write post-incident summary with root cause and follow-up tasks.

## Alerting Reference
- Use baseline alert definitions from `docs/operations/v1-alert-rules.md`.
- Record and review drill outcomes in `docs/operations/v1-incident-drills.md`.
- Use runtime symptom-first triage in `docs/operations/runtime-incident-triage-matrix.md`.
- For assistant-specific incidents/fallback/recovery flow, use `docs/operations/v1-assistant-incident-runbook.md`.
- For deploy-specific rollback and gates, use:
  - `docs/operations/deployment-rollback-playbook.md`
  - `docs/operations/deployment-readiness-gates.md`
- RTO/RPO baseline and degradation windows:
  - `docs/operations/v1-rto-rpo-targets.md`

## Ownership
- Incident commander: backend on-call owner.
- Deployment owner: release engineer.
- Communication owner: product/operator lead.

