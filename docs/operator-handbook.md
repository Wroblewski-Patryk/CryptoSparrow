# Production Operations Handbook (V1)

This handbook is the day-to-day operator companion for CryptoSparrow V1.
It complements:
- `docs/v1-ops-runbook.md` (deployment, rollback, incident flow)
- `docs/v1-alert-rules.md` (alert catalog and severity)
- `docs/v1-incident-drills.md` (simulated incident outcomes)

## 1. Shift Start Checklist
1. Confirm API health:
   - `GET /health` returns `ok`.
   - `GET /ready` returns `ready`.
2. Confirm worker health (split mode):
   - `GET /workers/health` returns `ok`.
   - `GET /workers/ready` returns `ready`.
3. Confirm observability:
   - `GET /metrics` returns counters and queue lag values.
   - `GET /alerts` has no `critical` entries.
4. Confirm risk controls:
   - Global kill switch state reviewed.
   - Last live-consent audit entries present for newly enabled bots.

## 2. Runtime Monitoring Routine
- Poll alerts every 1-2 minutes in active trading windows.
- Watch these metrics continuously:
  - order failures/retries (`exchange.orders.*`)
  - worker queue lag (`worker.queueLag.*`)
  - API latency and non-2xx response trend
- If queue lag increases for 5+ minutes:
  - reduce non-critical jobs,
  - verify Redis health and worker heartbeat,
  - scale workers before market open spikes.

## 3. Safe Deployment Procedure
1. Freeze non-essential config changes.
2. Deploy API first, then workers.
3. Run smoke checks:
   - auth login/register
   - strategy list/create
   - paper mode order path
4. Verify no new critical alerts for 10 minutes.
5. Announce release complete with commit/tag reference.

## 4. Incident Handling (Operator View)
1. Classify severity using `docs/v1-alert-rules.md`.
2. For P1/P0:
   - activate incident channel,
   - assign commander and recorder,
   - capture exact UTC timestamps.
3. Mitigate first:
   - apply kill switch if trading safety is uncertain,
   - stop affected worker pools when queue pressure is unstable.
4. Recover service:
   - rollback if needed,
   - verify `/ready` and `/alerts`,
   - confirm no orphan live actions.
5. Publish post-incident note:
   - root trigger,
   - user impact,
   - preventive follow-up.

## 5. Secrets and Access Hygiene
- Rotate API-key encryption keys by policy cadence.
- Rotate JWT previous-secret windows with explicit expiry.
- Revoke stale operator credentials immediately.
- Keep production access least-privilege and time-bounded.

## 6. End-of-Day Checklist
1. Confirm no unresolved critical alerts.
2. Verify latest backup and restore test recency.
3. Review unusual audit-log patterns (`/dashboard/logs`).
4. Record handover notes:
   - incidents,
   - mitigations,
   - known risks for next shift.
