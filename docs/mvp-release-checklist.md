# MVP Release Checklist

## Code and Build
- [ ] `pnpm --filter server build` passes.
- [ ] `pnpm --filter client build` passes.
- [ ] `pnpm --filter server test` passes.
- [ ] `pnpm --filter client test` passes.
- [ ] Working tree is clean except intended release artifacts.

## Runtime Verification
- [ ] Docker services up (`postgres`, `redis`).
- [ ] Server starts and responds on `/`.
- [ ] Client starts and renders dashboard routes.
- [ ] Auth flow works (`register`, `login`, `logout`, `me`).
- [ ] Upload endpoint works for authenticated user.

## Security and Risk Controls
- [ ] API keys are stored encrypted and masked in responses.
- [ ] Live consent requires `consentTextVersion`.
- [ ] Pre-trade checks enforce live consent + kill-switch guards.
- [ ] Redis-backed rate limiting active in runtime env.
- [ ] Audit logs visible through `/dashboard/logs`.

## Data and Migration
- [ ] Prisma migrations applied in target environment.
- [ ] Backup snapshot taken before release.
- [ ] Rollback steps validated against runbook.

## Documentation
- [ ] Runbook reviewed: `docs/mvp-ops-runbook.md`.
- [ ] Risk notice reviewed: `docs/mvp-risk-consent-text.md`.
- [ ] Known limits reviewed: `docs/mvp-known-limits.md`.
- [ ] Changelog updated for this release.

## Sign-Off
- [ ] Engineering sign-off.
- [ ] Product sign-off.
- [ ] Go-live owner assigned.
