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

## Runtime and Operations Gates
- [ ] API endpoints healthy:
  - `/health`,
  - `/ready`,
  - `/metrics`,
  - `/alerts`.
- [ ] Worker endpoints healthy:
  - `/workers/health`,
  - `/workers/ready`.
- [ ] Queue lag metrics reviewed and within baseline.
- [ ] Incident contacts and escalation chain confirmed.

## Security and Risk Gates
- [ ] JWT rotation window policy verified.
- [ ] API-key lifecycle policy verified (create/rotate/revoke).
- [ ] Ownership enforcement audit reviewed.
- [ ] LIVE mode requires explicit user confirmations.
- [ ] Kill-switch and emergency stop paths verified.

## Data and Migration Gates
- [ ] Prisma migrations applied to target environment.
- [ ] Backup snapshot created and restore path validated.
- [ ] Index and pagination changes validated on representative datasets.

## Documentation and Communication Gates
- [ ] User guide reviewed (`docs/operations/user-guide.md`).
- [ ] Operator handbook reviewed (`docs/operations/operator-handbook.md`).
- [ ] Design/accessibility/localization QA docs reviewed.
- [ ] Release notes and migration notes drafted.

## RC Sign-Off
- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Operations sign-off.
- [ ] RC owner assigned with rollback authority.
