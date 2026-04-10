# V1 RC External Gates Runbook

Purpose: close the remaining release-candidate gates that require target-environment evidence and formal approvals.

## Production Prerequisites
Before final closure run, set/verify:
- API access:
  - target API base URL (`https://<target-api>`)
  - admin session token for protected metrics/readiness endpoints (`--auth-token <token>`)
  - or admin credentials for automatic token fetch (`--auth-email <email> --auth-password <password>`)
- Production DB restore-check profile vars:
  - `PROD_DB_CHECK_CONTAINER`
  - `PROD_DB_CHECK_USER`
  - `PROD_DB_CHECK_NAME`
  - accepted aliases: `PRODUCTION_DB_CHECK_CONTAINER`, `PRODUCTION_DB_CHECK_USER`, `PRODUCTION_DB_CHECK_NAME`

Recommended one-command production closure pipeline:
- `pnpm run ops:rc:gates:prod-pipeline -- --base-url https://<target-api> --auth-token <ADMIN_JWT> --duration-minutes 30 --interval-seconds 30`
- equivalent auto-login variant:
  - `pnpm run ops:rc:gates:prod-pipeline -- --base-url https://<target-api> --auth-email <admin-email> --auth-password <admin-password> --duration-minutes 30 --interval-seconds 30`
- this command enforces:
  - `environment=production`,
  - `db-profile=prod`,
  - strict evidence check,
  - Gate2 `PASS` requirement (`--require-production-gate2`).

## Gate 1: Backup Snapshot and Restore Validation
1. Take fresh database snapshot in target release environment.
   - Local dry-run helper (Docker postgres):
     - `pnpm run ops:db:backup-restore:check-local`
   - Profiled command set (repeatable by deployment target):
     - `pnpm run ops:db:backup-verify:local`
     - `pnpm run ops:db:backup-verify:stage`
     - `pnpm run ops:db:backup-verify:prod`
     - optional overrides: `pnpm run ops:db:backup-verify -- --profile stage --container <name> --db-user <user> --db-name <name>`
2. Record snapshot id, timestamp (UTC), and operator.
3. Restore snapshot into isolated restore target (never production primary).
4. Run minimum restore checks:
   - DB connection works.
   - key tables readable (`User`, `Bot`, `Order`, `Position`, `Log`).
   - row counts are non-zero where expected.
   - evidence automation (PASS/FAIL contract artifact):
     - `pnpm run ops:db:restore-drill:local`
     - `pnpm run ops:db:restore-drill:stage`
     - `pnpm run ops:db:restore-drill:prod`
5. Mark gate complete in RC checklist only after restore checks pass.

Evidence to record:
- Snapshot id:
- Snapshot UTC timestamp:
- Restore target:
- Restore verification command/output reference:
- Operator:

Profile env contract:
- `DB_CHECK_CONTAINER`, `DB_CHECK_USER`, `DB_CHECK_NAME` for `local`
- `STAGE_DB_CHECK_CONTAINER`, `STAGE_DB_CHECK_USER`, `STAGE_DB_CHECK_NAME` for `stage`
- `PROD_DB_CHECK_CONTAINER`, `PROD_DB_CHECK_USER`, `PROD_DB_CHECK_NAME` for `prod`

## Gate 2: Queue-Lag Baseline Review
1. Observe production-like telemetry window (minimum 30 minutes under normal load).
   - Recommended collector command:
     - `pnpm run ops:slo:collect -- --base-url https://<target-api> --duration-minutes 30 --interval-seconds 30 --auth-token <ADMIN_JWT> --environment production`
     - auto-login variant:
       - `pnpm run ops:slo:collect -- --base-url https://<target-api> --duration-minutes 30 --interval-seconds 30 --auth-email <admin-email> --auth-password <admin-password> --environment production`
   - Guardrail:
     - `--environment production` is blocked for `localhost`/private hosts unless explicit dry-run override is provided (`--allow-local-production-evidence`).
   - Build rolling SLO window summary (for 7d/30d review cadence):
     - `pnpm run ops:slo:window-report -- --window-days 7`
     - `pnpm run ops:slo:window-report -- --window-days 30`
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

## Binance Live Ops Verification (Recommended Before Gate 4)
1. Execute checklist:
   - `docs/operations/binance-live-ops-verification-checklist-2026-04-06.md`
2. Confirm recorded evidence for:
   - connectivity and permission gate
   - exchange snapshot trust
   - manual-managed safety and bot-managed lifecycle behavior
   - runtime freshness/alerts
   - backtest/runtime alignment spot check
3. If checklist has open mismatch or critical alert, keep RC blocked.

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
6. Optional automation helper (builds sign-off record from gate snapshot + provided approvers):
   - `pnpm run ops:rc:signoff:build -- --engineering-name "<name>" --product-name "<name>" --operations-name "<name>" --owner-name "<name>" --owner-contact "<email/slack>"`

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
    - gate snapshot prefers latest `v1-slo-window-report-*.json` (rolling review) and falls back to latest `_artifacts-slo-window-*.json`.
  - Execute Binance live-ops verification checklist:
    - `docs/operations/binance-live-ops-verification-checklist-2026-04-06.md`
  - Sync RC checklist checkboxes from current gate snapshot + sign-off record:
    - `pnpm run ops:rc:checklist:sync`
  - Check missing external evidence fields (Gate1/Gate3/Gate4):
    - `pnpm run ops:rc:gates:evidence:check`
    - strict mode (exit code 1 when evidence is incomplete): `pnpm run ops:rc:gates:evidence:check -- --strict`
    - command verifies Gate2 status from `v1-rc-external-gates-status.md`:
      - default policy: `PASS` or `LOCAL_PASS (...)` accepted,
      - production-only policy: `pnpm run ops:rc:gates:evidence:check -- --strict --require-production-gate2`.
      - shortcut: `pnpm run ops:rc:gates:evidence:check:strict:prod`.
    - machine-readable output:
      - `pnpm run ops:rc:gates:evidence:check -- --json`
      - `pnpm run ops:rc:gates:evidence:check -- --json --output docs/operations/_artifacts-rc-evidence-check.json`
  - Quick summary (gate labels + missing evidence count):
    - `pnpm run ops:rc:gates:summary`
    - JSON: `pnpm run ops:rc:gates:summary -- --json`
    - when evidence JSON artifact is missing, summary still works (missing count reported as `null`).
  - Generate rolling SLO summary from collected artifacts:
    - `pnpm run ops:slo:window-report -- --window-days 7`
    - `pnpm run ops:slo:window-report -- --window-days 30`
  - Generate empty status template before telemetry is available:
    - `pnpm run ops:rc:gates:status -- --template-only`
  - Run local full helper pipeline (DB dry-run + SLO collect + status snapshot):
    - `pnpm run ops:rc:gates:local-pipeline -- --base-url http://localhost:4001 --duration-minutes 5 --interval-seconds 15`
    - if you intentionally need `environment=production` in local dry-run: add `--allow-local-production-evidence`.
    - by default this pipeline also generates SLO rolling reports for `7d` and `30d`.
    - by default this pipeline also syncs `v1-release-candidate-checklist.md` checkbox states from status/sign-off artifacts.
    - by default this pipeline also prints missing evidence diagnostics (`ops:rc:gates:evidence:check`).
    - by default diagnostics are saved to `docs/operations/_artifacts-rc-evidence-check-latest.json`.
    - customize window outputs:
      - `pnpm run ops:rc:gates:local-pipeline -- --window-days 7,30`
      - `pnpm run ops:rc:gates:local-pipeline -- --skip-window-report`
      - `pnpm run ops:rc:gates:local-pipeline -- --skip-checklist-sync`
      - `pnpm run ops:rc:gates:local-pipeline -- --skip-evidence-check`
      - `pnpm run ops:rc:gates:local-pipeline -- --strict-evidence-check`
      - `pnpm run ops:rc:gates:local-pipeline -- --strict-evidence-check --require-production-gate2`
      - `pnpm run ops:rc:gates:local-pipeline -- --evidence-output docs/operations/_artifacts-rc-evidence-check-custom.json`
    - strict shortcut:
      - `pnpm run ops:rc:gates:local-pipeline:strict`
      - `pnpm run ops:rc:gates:local-pipeline:strict:prod`
      - explicit production pipeline alias (same strict-prod behavior): `pnpm run ops:rc:gates:prod-pipeline -- --base-url https://<target-api> --auth-token <ADMIN_JWT> --duration-minutes 30 --interval-seconds 30`
  - Offline fallback when API is unavailable (template status only):
    - `pnpm run ops:rc:gates:local-pipeline -- --allow-offline`
  - Quick refresh (status + checklist + evidence check, no DB/SLO collection):
    - `pnpm run ops:rc:gates:refresh`
    - strict quick refresh: `pnpm run ops:rc:gates:refresh:strict`
    - strict quick refresh (production Gate2 only): `pnpm run ops:rc:gates:refresh:strict:prod`
    - refresh + instant summary: `pnpm run ops:rc:gates:refresh:summary`
    - strict refresh + always-print summary (returns strict exit code): `pnpm run ops:rc:gates:refresh:summary:strict`
    - strict refresh + summary (production Gate2 only): `pnpm run ops:rc:gates:refresh:summary:strict:prod`
