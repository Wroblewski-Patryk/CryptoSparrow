# MVP Release Checklist

## Code and Build
- [x] `pnpm --filter api build` passes.
- [x] `pnpm --filter web build` passes.
- [x] `pnpm --filter api test` passes.
- [x] `pnpm --filter web test` passes.
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

## Re-Run Evidence (2026-03-21)
- `pnpm --filter api build` passed.
- `pnpm --filter web build` passed.
- `pnpm --filter api test` passed (`41 files`, `157 tests`).
- `pnpm --filter web test` passed (`24 files`, `45 tests`).
- `pnpm --filter api exec prisma migrate deploy` reported `No pending migrations to apply`.

