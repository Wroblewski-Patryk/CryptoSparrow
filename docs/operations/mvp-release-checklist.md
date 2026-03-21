# MVP Release Checklist

## Code and Build
- [x] `pnpm --filter server build` passes.
- [x] `pnpm --filter client build` passes.
- [x] `pnpm --filter server test` passes.
- [x] `pnpm --filter client test` passes.
- [ ] Working tree is clean except intended release artifacts.

## Runtime Verification
- [x] Docker services up (`postgres`, `redis`).
- [ ] Server starts and responds on `/`.
- [ ] Client starts and renders dashboard routes.
- [x] Auth flow works (`register`, `login`, `logout`, `me`).
- [x] Upload endpoint works for authenticated user.

## Security and Risk Controls
- [x] API keys are stored encrypted and masked in responses.
- [x] Live consent requires `consentTextVersion`.
- [x] Pre-trade checks enforce live consent + kill-switch guards.
- [ ] Redis-backed rate limiting active in runtime env.
- [x] Audit logs visible through `/dashboard/logs`.

## Data and Migration
- [x] Prisma migrations applied in target environment.
- [ ] Backup snapshot taken before release.
- [ ] Rollback steps validated against runbook.

## Documentation
- [x] Runbook reviewed: `docs/operations/mvp-ops-runbook.md`.
- [x] Risk notice reviewed: `docs/security/mvp-risk-consent-text.md`.
- [x] Known limits reviewed: `docs/product/known-limits.md`.
- [x] Changelog updated for this release.

## Sign-Off
- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Go-live owner assigned.

## Re-Run Evidence (2026-03-19)
- `pnpm --filter server build` passed.
- `pnpm --filter client build` passed.
- `pnpm --filter server test` passed (`39 files`, `151 tests`).
- `pnpm --filter client test` passed (`24 files`, `45 tests`).
- `pnpm --filter server exec prisma migrate deploy` reported `No pending migrations to apply`.
