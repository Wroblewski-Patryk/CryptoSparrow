# V1 Release Candidate Checklist

## Build and Test Gates
- [x] `pnpm --filter server build` passes.
- [x] `pnpm --filter client build` passes.
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
- `pnpm --filter server build` passed.
- `pnpm --filter client build` passed.
- `pnpm --filter server test -- src/modules/auth/auth.e2e.test.ts src/modules/exchange/liveOrderAdapter.service.test.ts src/router/health-readiness.test.ts src/router/workers-health-readiness.test.ts src/router/metrics.test.ts src/router/alerts.test.ts` passed (`6` files, `20` tests).
- `pnpm --filter client exec vitest run src/features/logs/components/AuditTrailView.test.tsx src/features/bots/components/BotsManagement.test.tsx src/ui/layout/dashboard/Header.responsive.test.tsx` passed (`3` files, `8` tests).
- API runtime endpoint coverage confirmed via `health-readiness`, `metrics`, and `alerts` test suites.
- Worker runtime endpoint coverage confirmed via `workers-health-readiness` test suite.
- `pnpm --filter server test -- src/modules/auth/auth.jwt.test.ts src/modules/profile/apiKey/apiKey.e2e.test.ts src/modules/engine/preTrade.e2e.test.ts` passed (`3` files, `11` tests).
- `pnpm --filter client exec vitest run src/features/bots/components/BotsManagement.test.tsx` passed (`1` file, `5` tests).
- Ownership audit reviewed: `docs/security/security-ownership-audit.md` (baseline review date `2026-03-16`).
- `pnpm --filter server exec prisma migrate deploy` passed (`16` migrations found, no pending migrations).
- `pnpm --filter server test -- src/modules/orders/orders-positions.e2e.test.ts src/modules/logs/logs.e2e.test.ts src/modules/pagination/pagination-query.test.ts` passed (`3` files, `8` tests).
- Documentation reviewed: `docs/operations/user-guide.md`, `docs/operations/operator-handbook.md`.
- QA docs reviewed: `docs/ux/localization-qa.md`, `docs/ux/accessibility-dashboard-audit.md`.
- Release docs drafted: `docs/operations/v1-changelog.md`, `docs/operations/v1-migration-notes.md`.

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

## RC Sign-Off
- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Operations sign-off.
- [ ] RC owner assigned with rollback authority.

## Outstanding External Gates (2026-03-21)
- Backup snapshot + restore-path validation on target release environment.
- Queue-lag baseline review from live telemetry window (`/metrics` + worker lag gauges).
- Incident contacts/escalation chain confirmation for release shift.
- Formal sign-offs (Engineering/Product/Operations) and RC owner assignment.
- Execution guide: `docs/operations/v1-rc-external-gates-runbook.md`.
