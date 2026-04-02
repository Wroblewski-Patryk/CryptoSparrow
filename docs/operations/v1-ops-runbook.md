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
3. Run CI-equivalent checks:
   - `pnpm --filter api build`
   - `pnpm --filter web build`
4. Apply DB migrations.
5. Deploy API and client artifacts.
6. Validate post-deploy probes:
   - `GET /health` returns `200`
   - `GET /ready` returns `200`
7. Smoke test auth login and dashboard load.

## Rollback Checklist
1. Identify last known good release tag.
2. Re-deploy previous API and client artifacts.
3. Re-run probes:
   - `GET /health`
   - `GET /ready`
4. Validate critical flows:
   - auth login/logout
   - dashboard list pages
   - exchange order path in paper mode
5. Record rollback reason and owner in incident log.

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
- For assistant-specific incidents/fallback/recovery flow, use `docs/operations/v1-assistant-incident-runbook.md`.

## Ownership
- Incident commander: backend on-call owner.
- Deployment owner: release engineer.
- Communication owner: product/operator lead.

