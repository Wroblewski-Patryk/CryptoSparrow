# V1 RC External Gates Runbook

Purpose: close the remaining release-candidate gates that require target-environment evidence and formal approvals.

## Gate 1: Backup Snapshot and Restore Validation
1. Take fresh database snapshot in target release environment.
   - Local dry-run helper (Docker postgres):
     - `pnpm run ops:db:backup-restore:check-local`
2. Record snapshot id, timestamp (UTC), and operator.
3. Restore snapshot into isolated restore target (never production primary).
4. Run minimum restore checks:
   - DB connection works.
   - key tables readable (`User`, `Bot`, `Order`, `Position`, `Log`).
   - row counts are non-zero where expected.
5. Mark gate complete in RC checklist only after restore checks pass.

Evidence to record:
- Snapshot id:
- Snapshot UTC timestamp:
- Restore target:
- Restore verification command/output reference:
- Operator:

## Gate 2: Queue-Lag Baseline Review
1. Observe production-like telemetry window (minimum 30 minutes under normal load).
   - Recommended collector command:
     - `pnpm run ops:slo:collect -- --base-url https://<target-api> --duration-minutes 30 --interval-seconds 30 --auth-token <ADMIN_JWT>`
2. Capture queue lag from `/metrics` and worker gauges:
   - market-data queue lag
   - execution queue lag
   - backtest queue lag
3. Record p50/p95/max lag values.
4. Confirm lag stays within accepted baseline for release window.
5. If lag breaches baseline, open follow-up ticket and keep gate open.

Evidence to record:
- Observation window UTC:
- Data source (dashboard/export):
- Queue lag summary (p50/p95/max):
- Reviewer:

## Gate 3: Incident Contacts and Escalation Confirmation
1. Confirm on-call roster for release window:
   - primary engineering on-call
   - backup engineering on-call
   - operations owner
   - product/escalation contact
2. Confirm escalation channel and paging path.
3. Confirm SEV-1 incident commander for first 24h release window.
4. Record confirmation timestamp and approver.

Evidence to record:
- On-call roster reference:
- Escalation channel:
- SEV-1 commander:
- Confirmation UTC timestamp:
- Approver:

## Gate 4: Formal RC Sign-Offs
1. Engineering sign-off after technical gates are green.
2. Product sign-off after scope/known-limits review.
3. Operations sign-off after runbook and incident readiness confirmation.
4. Assign RC owner with rollback authority.
5. Record all names + UTC timestamps in release note.

Evidence to record:
- Engineering sign-off (name + UTC):
- Product sign-off (name + UTC):
- Operations sign-off (name + UTC):
- RC owner with rollback authority:

## Completion Rule
- Update `docs/operations/v1-release-candidate-checklist.md` checkboxes only when each gate has evidence filled above.
- Optional helper summary:
  - Generate gate snapshot from latest SLO artifact:
    - `pnpm run ops:rc:gates:status`
  - Generate empty status template before telemetry is available:
    - `pnpm run ops:rc:gates:status -- --template-only`
  - Run local full helper pipeline (DB dry-run + SLO collect + status snapshot):
    - `pnpm run ops:rc:gates:local-pipeline -- --base-url http://localhost:4001 --duration-minutes 5 --interval-seconds 15`
