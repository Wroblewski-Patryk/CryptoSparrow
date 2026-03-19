# V1 Release Candidate Checklist

## Build and Test Gates
- [ ] `pnpm --filter server build` passes.
- [ ] `pnpm --filter client build` passes.
- [ ] Critical server tests pass:
  - auth regression,
  - exchange retry path,
  - health/readiness,
  - metrics/alerts.
- [ ] Critical client tests pass:
  - logs decision trace,
  - bots LIVE confirmations,
  - shell/accessibility smoke.

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
- [ ] User guide reviewed (`docs/user-guide.md`).
- [ ] Operator handbook reviewed (`docs/operator-handbook.md`).
- [ ] Design/accessibility/localization QA docs reviewed.
- [ ] Release notes and migration notes drafted.

## RC Sign-Off
- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Operations sign-off.
- [ ] RC owner assigned with rollback authority.
