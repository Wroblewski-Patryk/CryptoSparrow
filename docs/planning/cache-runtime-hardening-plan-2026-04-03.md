# Cache / Runtime Hardening Plan (2026-04-03)

Status: planned  
Owner: Web + API + Ops  
Scope: eliminate stale session/runtime data in production (web + api + PWA + proxy) while preserving performance.

## 1) Problem statement

Observed in production:
- After creating or updating runtime data (for example bot create), UI may still show old list state until hard refresh (`Ctrl+F5`).
- This indicates stale content served from one or more cache layers.

Primary risk:
- Operator sees outdated runtime truth (`bots`, `sessions`, `positions`, `signals`) and makes wrong decisions.

## 2) Target cache contract

### 2.1 Never cache (must be fresh)
- All authenticated API routes:
  - `/auth/*`
  - `/dashboard/*`
  - `/admin/*`
- Any runtime/session payload:
  - bot list/detail,
  - runtime sessions,
  - symbol stats,
  - positions/trades,
  - dashboard control-center snapshots.
- HTML for protected routes (`/dashboard/*`, `/admin/*`) should not be cached by proxy/CDN.

Expected headers:
- `Cache-Control: private, no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`
- `Vary: Origin, Cookie, Authorization`

### 2.2 Cache allowed (static only)
- Next static bundles and assets:
  - `/_next/static/*`
  - fonts/images/icons/logo assets
- PWA offline fallback assets only.

### 2.3 Streaming transport
- SSE endpoint (`/dashboard/market-stream/events`) must stay unbuffered and uncached.
- Keep:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `X-Accel-Buffering: no`

## 3) Diagnosis summary (current state)

- Root cause for stale bot list identified in PWA Service Worker:
  - broad GET caching could serve stale runtime responses.
- Runtime polling already exists in dashboard/bots (5s), but stale browser/proxy cache can still mask fresh data.
- API/router currently does not enforce global `no-store` policy on authenticated routes.

## 4) Implementation plan (tiny commits)

## Phase A - Cache policy hardening on API
- [ ] `CACHE-01 feat(api-headers): add authenticated no-store middleware for /auth, /dashboard, /admin responses`
- [ ] `CACHE-02 test(api-headers): add route tests asserting no-store/vary headers on protected endpoints`

Exit criteria:
- All protected endpoints return anti-cache headers consistently.

## Phase B - Web/PWA runtime safety
- [ ] `CACHE-03 fix(web-sw): restrict service worker runtime caching to static assets only, bypass API/runtime payloads`
- [ ] `CACHE-04 feat(web-sw-lifecycle): add service-worker update strategy (registration update + activation handoff) to reduce stale clients after deploy`
- [ ] `CACHE-05 test(web-pwa): add regression checks for market/dashboard runtime requests not served from SW cache`

Exit criteria:
- Bot list/session data refreshes without hard reload.

## Phase C - Edge/Proxy/Coolify contract
- [ ] `CACHE-06 docs(ops-coolify): document reverse-proxy cache rules (never cache /auth|/dashboard|/admin, cache static only)`
- [ ] `CACHE-07 docs(runbook): add stale-cache incident playbook with clear verify/mitigate/rollback steps`

Exit criteria:
- Ops can verify effective cache behavior from headers and reproduce mitigation safely.

## Phase D - Runtime UX resilience
- [ ] `CACHE-08 feat(web-runtime): add explicit stale-data guard in dashboard/bots runtime (age watchdog + transparent warning state)`
- [ ] `CACHE-09 test(web-runtime): cover stale-age warning and recovery after fresh payload arrival`

Exit criteria:
- User sees deterministic stale/fresh state without visual ambiguity.

## 5) Validation matrix

### Manual checks
1. Create bot on production-like env.
2. Return to bot list without hard refresh.
3. Confirm new row appears on normal refresh/poll cycle.
4. Validate response headers for:
   - `/auth/me`
   - `/dashboard/bots`
   - `/dashboard/bots/:id/runtime-sessions`
5. Confirm static asset responses remain cacheable.

### Automated checks
- API integration tests for protected-route headers.
- Web/PWA regression tests for non-cached runtime fetches.
- Smoke check in deploy runbook:
  - fetch protected endpoint headers and fail if `no-store` missing.

## 6) Rollout and rollback

Rollout:
1. Deploy API no-store headers.
2. Deploy SW update (new cache version).
3. Deploy proxy cache rules.
4. Run post-deploy cache smoke.

Rollback:
1. Revert proxy rules first (if static regression detected).
2. Revert SW release (if offline/static behavior regresses).
3. Keep API no-store unless critical throughput issue is proven.

## 7) Risks

- Overly strict no-store on static assets can hurt performance.
  - Mitigation: apply policy only to protected/authenticated/dynamic routes.
- SW lifecycle mismatch across old clients.
  - Mitigation: cache versioning + activation strategy + incident runbook.
- Proxy-level hidden cache despite app headers.
  - Mitigation: explicit Coolify/proxy rules and smoke assertions.

