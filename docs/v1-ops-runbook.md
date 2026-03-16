# V1 Ops Runbook

## Scope
Operational baseline for production deployment, rollback, and incident response for V1.

## Deployment Checklist
1. Verify latest `main` commit and changelog entry.
2. Confirm environment variables:
   - `JWT_SECRET`
   - `JWT_SECRET_PREVIOUS` (optional during rotation)
   - `JWT_SECRET_PREVIOUS_UNTIL` (optional, ISO datetime)
   - database and redis connection settings
3. Run CI-equivalent checks:
   - `pnpm --filter server build`
   - `pnpm --filter client build`
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
- Use baseline alert definitions from `docs/v1-alert-rules.md`.

## Ownership
- Incident commander: backend on-call owner.
- Deployment owner: release engineer.
- Communication owner: product/operator lead.
