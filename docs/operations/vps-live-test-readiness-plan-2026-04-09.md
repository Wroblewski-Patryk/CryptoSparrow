# VPS Live-Test Readiness Plan (2026-04-09)

Goal: reach a controlled, low-risk state where LIVE mode can be tested on VPS with real exchange side effects and clear rollback path.

## Execution Snapshot (2026-04-09)

- [x] RC gates refresh and evidence summary executed (`ops:rc:gates:refresh:summary`).
- [x] Local backup verification PASS (`ops:db:backup-verify:local`).
- [x] Local restore drill PASS (`ops:db:restore-drill:local`).
- [x] Backup/restore script hardening applied to avoid restore-DB name collisions in consecutive runs (`scripts/verifyLocalBackupRestore.mjs`).
- [ ] Deploy smoke on target environment (`ops:deploy:smoke`) blocked: no reachable API/WEB target in current context.
- [ ] Production Gate 2 (`SLO observation`) blocked: missing target URL + admin token for production collection.
- [ ] Production Gate 3 (`incident contacts/escalation`) still open.
- [ ] Production Gate 4 (`formal sign-offs`) still open.

Latest generated evidence references:
- `docs/operations/v1-rc-external-gates-status.md`
- `docs/operations/_artifacts-rc-evidence-check-latest.json`
- `docs/operations/v1-db-restore-check-2026-04-09T19-32-32-768Z.md`
- `docs/operations/v1-restore-drill-local-2026-04-09T19-32-34-979Z.md`

Inputs required to continue execution on target VPS/PROD:
- target API base URL (`https://<target-api>`),
- admin JWT for protected ops endpoints,
- production DB check profile envs (`PROD_DB_CHECK_CONTAINER`, `PROD_DB_CHECK_USER`, `PROD_DB_CHECK_NAME`),
- sign-off owners (Engineering/Product/Operations + RC owner).

## Current Starting Point

- [x] Backtest details page resilience fix delivered (`404` run handling + partial fetch tolerance).
- [x] Runtime pre-check for exchange minimum order constraints delivered (prevent pointless LIVE order submissions).
- [ ] Production exit-gates remain open (SLO window evidence, target-env backup/restore, queue-lag review, formal sign-offs).

## Execution Rules

- Keep first LIVE tests on smallest practical risk and one symbol only.
- Treat rollout as staged (`DEV -> STAGE -> VPS target`) with explicit go/no-go checkpoints.
- Do not enable LIVE trading without rollback authority and tested restore drill evidence.

## Phase 1 - VPS Environment Hardening

- [ ] Prepare dedicated VPS host for trading runtime:
  - patch OS and packages,
  - configure firewall policy (deny by default, allow only required ports),
  - configure SSH hardening (key-only auth, no password login).
- [ ] Ensure secrets policy is enforced:
  - no secrets in repo files,
  - env vars managed only in VPS secret store/runtime config.
- [ ] Create dedicated exchange API key for test account/subaccount with:
  - trading permission only,
  - no withdraw permission,
  - IP whitelist restricted to VPS egress IP.

Evidence:
- host hardening notes,
- screenshot/export of exchange key restrictions,
- VPS secret mapping snapshot (without values).

## Phase 2 - Deploy and Runtime Baseline on VPS

- [ ] Deploy current `main` to VPS target.
- [ ] Run baseline post-deploy checks:
  - `pnpm run ops:deploy:smoke`
  - `pnpm run ops:deploy:runtime-freshness -- --base-url https://<target-api> --auth-token <ADMIN_JWT>`
  - `pnpm run ops:deploy:rollback-guard -- --base-url https://<target-api> --auth-token <ADMIN_JWT>`
- [ ] Verify endpoint gates:
  - `GET /health` -> `200`
  - `GET /ready` -> `200`
  - `GET /workers/health` -> `200`
  - `GET /workers/ready` -> `200`
  - `GET /workers/runtime-freshness` -> `200` + `status=PASS`
  - `GET /alerts` -> no rollback-critical runtime alerts.

Evidence:
- smoke logs,
- freshness and rollback-guard outputs,
- endpoint check timestamps.

## Phase 3 - Data Safety and Rollback Proof

- [ ] Run target-profile backup verification.
- [ ] Run target-profile restore drill and confirm PASS artifact.
- [ ] Confirm rollback procedure ownership and decision authority.

Recommended commands:
- `pnpm run ops:db:backup-verify:prod`
- `pnpm run ops:db:restore-drill:prod`

Evidence:
- latest backup artifact,
- latest restore-drill artifact,
- named rollback owner in sign-off record.

## Phase 4 - Live-Ops Functional Validation (Binance)

- [ ] Execute full checklist:
  - `docs/operations/binance-live-ops-verification-checklist-2026-04-06.md`
- [ ] Confirm management-mode safety:
  - `MANUAL_MANAGED` symbol blocks bot entry automation,
  - `BOT_MANAGED` symbol allows lifecycle automation.
- [ ] Confirm runtime lifecycle behavior:
  - coherent `OPEN -> DCA -> CLOSE`,
  - no-flip guard respected,
  - no duplicate side effects after retry/restart scenarios.

Evidence:
- completed checklist with timestamps/operator,
- symbol-level runtime event trace excerpts.

## Phase 5 - Controlled First LIVE Test Window

- [ ] Run first LIVE test with strict limits:
  - one bot,
  - one symbol,
  - smallest risk profile and leverage acceptable for test objective.
- [ ] Observe runtime for at least 30 minutes:
  - order placement/fill behavior,
  - runtime freshness and alerts,
  - no unexpected restart spikes.
- [ ] Validate exchange-vs-app position consistency after test window.

Evidence:
- session id + symbol list,
- alerts snapshot during/after run,
- positions reconciliation snapshot.

## Phase 6 - Production Exit-Gates Closure

- [ ] Collect production SLO observation evidence:
  - `pnpm run ops:slo:collect -- --base-url https://<target-api> --duration-minutes 30 --interval-seconds 30 --auth-token <ADMIN_JWT> --environment production`
- [ ] Build/refresh external gates status:
  - `pnpm run ops:rc:gates:prod-pipeline -- --base-url https://<target-api> --auth-token <ADMIN_JWT> --duration-minutes 30 --interval-seconds 30`
- [ ] Complete formal sign-offs in:
  - `docs/operations/v1-rc-signoff-record.md`.

## Go / No-Go Criteria for Ongoing LIVE Testing

GO only if all are true:
- health/readiness/freshness gates pass,
- no rollback-critical alerts,
- backup + restore drill evidence is current and PASS,
- Binance live-ops checklist completed with no unresolved mismatch,
- RC sign-off record has required approvals.

NO-GO (stop LIVE immediately) if any occur:
- repeated runtime restart critical alerts,
- reconciliation drift critical alerts,
- unresolved exchange/app position mismatch,
- failed restore drill or unknown rollback ownership.
