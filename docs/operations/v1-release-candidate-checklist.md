# V1 Release Candidate Checklist

## Build and Test Gates
- [x] `pnpm --filter api build` passes.
- [x] `pnpm --filter web build` passes.
- [x] Critical server tests pass:
  - auth regression,
  - exchange retry path,
  - health/readiness,
  - metrics/alerts.
- [x] Critical client tests pass:
  - logs decision trace,
  - bots LIVE confirmations,
  - shell/accessibility smoke.

### Latest Verification (2026-03-21)
- `pnpm --filter api build` passed.
- `pnpm --filter web build` passed.
- `pnpm --filter api test -- src/modules/auth/auth.e2e.test.ts src/modules/exchange/liveOrderAdapter.service.test.ts src/router/health-readiness.test.ts src/router/workers-health-readiness.test.ts src/router/metrics.test.ts src/router/alerts.test.ts` passed (`6` files, `20` tests).
- `pnpm --filter web exec vitest run src/features/logs/components/AuditTrailView.test.tsx src/features/bots/components/BotsManagement.test.tsx src/ui/layout/dashboard/Header.responsive.test.tsx` passed (`3` files, `8` tests).
- API runtime endpoint coverage confirmed via `health-readiness`, `metrics`, and `alerts` test suites.
- Worker runtime endpoint coverage confirmed via `workers-health-readiness` test suite.
- `pnpm --filter api test -- src/modules/auth/auth.jwt.test.ts src/modules/profile/apiKey/apiKey.e2e.test.ts src/modules/engine/preTrade.e2e.test.ts` passed (`3` files, `11` tests).
- `pnpm --filter web exec vitest run src/features/bots/components/BotsManagement.test.tsx` passed (`1` file, `5` tests).
- Ownership audit reviewed: `docs/security/security-ownership-audit.md` (baseline review date `2026-03-16`).
- Final security verification: `docs/security/security-audit-verification-2026-03-21.md` (`9` files, `34` tests, all green).
- `pnpm --filter api exec prisma migrate deploy` passed (`16` migrations found, no pending migrations).
- `pnpm --filter api test -- src/modules/orders/orders-positions.e2e.test.ts src/modules/logs/logs.e2e.test.ts src/modules/pagination/pagination-query.test.ts` passed (`3` files, `8` tests).
- Documentation reviewed: `docs/operations/user-guide.md`, `docs/operations/operator-handbook.md`.
- QA docs reviewed: `docs/ux/localization-qa.md`, `docs/ux/accessibility-dashboard-audit.md`.
- Release docs drafted: `docs/operations/v1-changelog.md`, `docs/operations/v1-migration-notes.md`.
- Load baseline evidence: `docs/operations/v1-load-baseline-2026-03-21.md` (error rate `0`, p95 `37ms`, p99 `72ms`, threshold gate `PASS`).
- 2026-03-25 local backup/restore dry-run passed via `pnpm run ops:db:backup-restore:check-local` (artifacts: `docs/operations/_artifacts-db-restore-check-2026-03-25T18-10-26-980Z.txt`, `docs/operations/v1-db-restore-check-2026-03-25T18-10-26-980Z.md`).

## Runtime and Operations Gates
- [x] API endpoints healthy:
  - `/health`,
  - `/ready`,
  - `/metrics`,
  - `/alerts`.
- [x] Worker endpoints healthy:
  - `/workers/health`,
  - `/workers/ready`.
- [ ] Queue lag metrics reviewed and within baseline.
- [ ] Incident contacts and escalation chain confirmed.

## Security and Risk Gates
- [x] JWT rotation window policy verified.
- [x] API-key lifecycle policy verified (create/rotate/revoke).
- [x] Ownership enforcement audit reviewed.
- [x] LIVE mode requires explicit user confirmations.
- [x] Kill-switch and emergency stop paths verified.

## Data and Migration Gates
- [x] Prisma migrations applied to target environment.
- [ ] Backup snapshot created and restore path validated.
- [x] Index and pagination changes validated on representative datasets.

## Documentation and Communication Gates
- [x] User guide reviewed (`docs/operations/user-guide.md`).
- [x] Operator handbook reviewed (`docs/operations/operator-handbook.md`).
- [x] Design/accessibility/localization QA docs reviewed.
- [x] Release notes and migration notes drafted.
- [x] Launch evidence pack compiled (`docs/operations/v1-launch-evidence-pack.md`).

## RC Sign-Off
- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Operations sign-off.
- [ ] RC owner assigned with rollback authority.
- Sign-off record template: `docs/operations/v1-rc-signoff-record.md`.

## Outstanding External Gates (2026-03-21)
- Backup snapshot + restore-path validation on target release environment.
- Queue-lag baseline review from live telemetry window (`/metrics` + worker lag gauges).
- Incident contacts/escalation chain confirmation for release shift.
- Formal sign-offs (Engineering/Product/Operations) and RC owner assignment.
- Execution guide: `docs/operations/v1-rc-external-gates-runbook.md`.
- SLO definitions and metric mapping: `docs/operations/v1-slo-catalog.md`.

### External Gates Quick Commands
- Collect SLO observation evidence:
  - `pnpm run ops:slo:collect -- --base-url https://<target-api> --duration-minutes 30 --interval-seconds 30 --auth-token <ADMIN_JWT>`
- Run local backup/restore validation dry-run (Docker postgres):
  - `pnpm run ops:db:backup-restore:check-local`
- Build RC external-gates status snapshot from latest SLO artifact:
  - `pnpm run ops:rc:gates:status`
- Build rolling SLO summaries (for recurring 7d/30d review cadence):
  - `pnpm run ops:slo:window-report -- --window-days 7`
  - `pnpm run ops:slo:window-report -- --window-days 30`
- Build template-only snapshot before SLO artifact exists:
  - `pnpm run ops:rc:gates:status -- --template-only`
- Build RC sign-off artifact from current gate status + approvers:
  - `pnpm run ops:rc:signoff:build -- --engineering-name "<name>" --product-name "<name>" --operations-name "<name>" --owner-name "<name>" --owner-contact "<email/slack>"`
- Sync RC checklist gate/sign-off checkboxes from current status artifacts:
  - `pnpm run ops:rc:checklist:sync`
- Check missing evidence fields before formal sign-off:
  - `pnpm run ops:rc:gates:evidence:check`
- Run local end-to-end helper pipeline:
  - `pnpm run ops:rc:gates:local-pipeline -- --base-url http://localhost:4001 --duration-minutes 5 --interval-seconds 15`
  - Includes status rebuild + checklist sync + evidence diagnostics by default.
  - Use `--skip-checklist-sync` / `--skip-evidence-check` to disable selected steps.
  - Use `--strict-evidence-check` to fail pipeline when evidence is incomplete.
  - Use `--evidence-output <file>` to override JSON evidence artifact path.
  - Shortcut strict mode: `pnpm run ops:rc:gates:local-pipeline:strict`
  - Offline fallback: `pnpm run ops:rc:gates:local-pipeline -- --allow-offline`
  - Quick refresh (no DB/SLO collection): `pnpm run ops:rc:gates:refresh`
  - Quick refresh strict mode: `pnpm run ops:rc:gates:refresh:strict`
- Run local cutover dry-run with structured artifact output:
  - `pnpm run ops:cutover:dry-run`
- Expected outputs:
  - `docs/operations/_artifacts-slo-window-*.json`
  - `docs/operations/v1-slo-observation-*.md`
  - `docs/operations/v1-slo-window-report-7d-*.md`
  - `docs/operations/v1-slo-window-report-30d-*.md`
  - `docs/operations/v1-rc-external-gates-status.md`
  - `docs/operations/v1-rc-signoff-record.md`
  - `docs/operations/_artifacts-rc-evidence-check-latest.json`
  - `docs/operations/_artifacts-cutover-dry-run-*.json`
  - `docs/operations/v1-local-cutover-dry-run-*.md`

