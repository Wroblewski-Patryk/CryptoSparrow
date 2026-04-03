# Soar Production Hardening (April 3, 2026)

Date: 2026-04-03  
Owner: Ops + Backend + Frontend  
Scope: Production stabilization after first VPS/Coolify rollout

## Why This Document Exists
This document captures what was fixed during the first production rollout of Soar (former CryptoSparrow), why those issues happened, and what must be repeated for future deployments.

## Reported Symptoms
1. Web domain showed `no available server`.
2. Registration/login failed with Prisma errors (`public.User` table missing).
3. Login toast showed success, but user was not always redirected to dashboard.
4. Save flows (markets/strategies) showed success toast, but list views looked empty for affected sessions.

## Root Cause Summary
1. Workers were not fully provisioned/running in production.
2. Database migrations were not fully applied in target production DB.
3. Session cookie behavior changed during deployment:
   - legacy host-only cookie on API subdomain,
   - new shared-domain cookie for web+api,
   - some browsers retained both (`token` duplicated).
4. `/auth/me` initially resolved only one parsed cookie token and could return inconsistent session state when duplicate cookies existed.

## Production Fixes Applied

### 1) Infrastructure and runtime
1. Confirmed full service topology in Coolify:
   - `api`,
   - `web`,
   - `workers-market-data`,
   - `workers-market-stream`,
   - `workers-backtest`,
   - `workers-execution`,
   - managed `postgres`,
   - managed `redis`.
2. Ensured target domains and TLS were attached to correct services.
3. Ensured DB schema is present before smoke tests.

### 2) Auth/session hardening in API
Commits:
- `00a688f` (`fix(auth): harden session cookies and login redirect`)
- `8acab19` (`fix(auth): stabilize duplicate-cookie sessions for /auth/me and dashboard`)

Key backend changes:
1. Session cookies are set/cleared in both scopes:
   - host-only (legacy overwrite),
   - shared-domain (cross-subdomain session).
2. Auth middleware evaluates all candidate `token` cookies.
3. Token selection prefers newest valid JWT (`iat`) when duplicates exist.
4. `/auth/me` now uses the same token-selection strategy as dashboard middleware.
5. `/auth/me` rewrites selected token cookie to heal legacy mixed-cookie sessions.

Changed files:
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/middleware/requireAuth.ts`
- `apps/api/src/modules/auth/sessionToken.ts`
- tests in:
  - `apps/api/src/middleware/requireAuth.test.ts`
  - `apps/api/src/modules/auth/auth.e2e.test.ts`

### 3) Login redirect resiliency in web
1. Login flow uses `router.replace('/dashboard')`.
2. Added fallback hard redirect if still on `/auth/*` after short delay.

## Validation Performed
1. API typecheck passed.
2. Auth regression tests passed:
   - duplicate token handling,
   - `/auth/me` behavior,
   - existing auth e2e.
3. Production smoke verification passed on `api.soar.luckysparrow.ch`:
   - `/health` and `/ready` return `200`,
   - duplicate-token scenario resolves to newest session,
   - create/list persistence for strategies/markets returns expected `201/200`.

## Operational Recovery for Existing Users
If a user still has stale mixed cookies:
1. Logout.
2. Login again.
3. Re-test dashboard + create/list flow.

This is usually enough after backend hardening because `/auth/me` now heals mixed sessions.

## Preventive Rules for Next Releases
1. Never deploy API/web without all worker services.
2. Run migration gate before exposing web traffic.
3. Keep cookie-domain strategy explicit and unchanged across releases.
4. Include duplicate-cookie auth smoke test in post-deploy checks.
5. Promote immutable SHA from stage to production only after full smoke pass.

## Definition of Done for Production Deploy
Deployment is complete only when all pass:
1. `GET /health` = `200`.
2. `GET /ready` = `200`.
3. Login redirects to `/dashboard`.
4. Create strategy, then list strategies includes created item.
5. Create market universe, then list universes includes created item.
6. Workers are healthy and not crash-looping.

