# Dashboard/Auth Production Audit (2026-04-03)

## Scope
- Incident: user gets logged out in production and after re-login sees empty dashboard data.
- Areas audited:
  - `apps/web` auth gate (`middleware`, auth context, API client redirects),
  - `apps/api` session cookie lifecycle (`/auth/login`, `/auth/me`, `requireAuth`),
  - deployment env contract (Coolify docs).

## Findings
1. **Web middleware over-validated JWT locally**
- `apps/web/src/middleware.ts` validated token signature using web runtime `JWT_SECRET`.
- This creates deployment-coupling risk between web and api secrets and can reject a still-valid API session.
- It also handles duplicate cookie states less robustly than API.

2. **Cookie config logic was duplicated in API**
- Cookie options (`domain`, `sameSite`, `secure`) were duplicated across:
  - `auth.controller.ts`,
  - `requireAuth.ts`.
- Duplication increases chance of drift and environment regressions.

3. **Session cookie env contract needed explicit production guidance**
- Coolify and env matrix docs still implied web-side `JWT_SECRET` requirement and lacked explicit `COOKIE_DOMAIN`/`COOKIE_SAME_SITE` contract.

4. **Auth page redirect jitter risk (public template)**
- Login/register flow used delayed redirect (`setTimeout`) plus fallback `window.location.assign`.
- Auth pages also returned `null` while context was loading, which can produce visible layout jump on slower production networks.

## Remediation Plan
1. Move web auth gate to transport-level check (token cookie presence only).
2. Keep auth authority on API:
   - `requireAuth` + `/auth/me` remain canonical validators.
3. Consolidate API cookie option resolution in a shared helper.
4. Add regression tests for cookie parsing and sameSite/domain resolution.
5. Update deployment docs for production-safe cookie and auth env setup.
6. Remove redirect jitter from auth entry pages/hooks and keep deterministic single redirect.

## Implementation Notes
- Web middleware now:
  - checks for any `token` cookie (parsed + raw fallback),
  - no longer verifies JWT signature locally.
- Auth login/register flow now:
  - uses immediate `router.replace('/dashboard')` after confirmed session,
  - removes delayed double-redirect logic,
  - does not blank auth pages while context is loading.
- API now uses shared helper:
  - `apps/api/src/modules/auth/auth.cookie.ts`
  - consumed by `auth.controller.ts` and `requireAuth.ts`.
- Docs updated:
  - `README.md`
  - `docs/operations/coolify-linux-vps-setup-guide.md`
  - `docs/operations/dev-stage-prod-environment-matrix.md`

## Validation
- Run targeted auth regression tests after patch:
  - `auth.cookie.test.ts`
  - `requireAuth.test.ts`
  - `auth.jwt.test.ts`
  - `auth.e2e.test.ts`
