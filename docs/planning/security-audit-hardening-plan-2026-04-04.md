# Security Audit + Hardening Plan (2026-04-04)

Status: planned  
Owner: Backend + Web + Ops  
Scope: full security review of `apps/api` + `apps/web`, dependency posture, and planning coverage.

## 1) Executive summary

Audit result: **medium-to-high risk overall**.

What is already good:
- auth is cookie-based (`httpOnly`) with JWT issuer/audience checks and secret-rotation support,
- protected dashboard/admin APIs are behind `requireAuth`,
- upload endpoint is authenticated and has MIME + size limits,
- API keys are encrypted (AEAD) and masked in reads,
- rate-limiting exists for auth and API-key connection testing.

Main problems:
- vulnerable dependency set in production (`next`, `axios`, `multer`, transitive security advisories),
- missing explicit security headers/CSP contract at app level,
- ops network guard can be bypassed by spoofed `x-forwarded-for` in current implementation,
- weak password policy + no forced session invalidation after password change,
- CSRF protection is implicit (SameSite/cookie model) and not enforced as explicit contract.

## 2) Method and evidence

Review inputs:
- static code review of auth/runtime/api/web security-sensitive files,
- planning docs review (`mvp-*`, `production-excellence`, `cache-runtime-hardening`, `open-decisions`),
- dependency audit:
  - command: `pnpm audit --prod --audit-level=moderate`
  - result: `22 vulnerabilities found` (`1 critical`, `10 high`, `10 moderate`, `1 low`).

## 3) Findings (prioritized)

## F-01 (Critical): vulnerable production dependency set
- Severity: **Critical**
- Evidence:
  - `apps/web/package.json:21` -> `next: 15.4.3`
  - `apps/web/package.json:17` -> `axios: ^1.11.0`
  - `apps/api/package.json:40` -> `multer: ^2.0.2`
  - `pnpm audit` reports:
    - Next.js RCE advisory (patched in `>=15.4.8`),
    - multiple Next.js DoS/smuggling advisories (patched in newer `15.4.x/15.5.x`),
    - Axios DoS advisories (patched in newer versions),
    - Multer DoS advisories (`>=2.1.x`),
    - transitive advisories (`qs`, `path-to-regexp`, `body-parser`, `jws`).
- Impact:
  - increased exploit surface in public deployment; known CVE/advisory exposure.

## F-02 (High): ops-network guard trusts spoofable forwarding header
- Severity: **High**
- Evidence:
  - `apps/api/src/index.ts:12` -> `app.set('trust proxy', true)`
  - `apps/api/src/middleware/requireOpsNetwork.ts:42` reads raw `x-forwarded-for` first.
- Impact:
  - attacker can spoof source IP in header path (especially if app is reachable outside strict proxy boundary), weakening `/metrics`, `/alerts`, `/workers/*` network guard.

## F-03 (High): no explicit app-level security headers baseline
- Severity: **High**
- Evidence:
  - `apps/api/src/index.ts` has no `helmet`/explicit hardening headers,
  - `apps/web/next.config.ts:3-6` is effectively empty (no security headers/CSP policy),
  - only inline theme script exists in root layout (`apps/web/src/app/layout.tsx`) without explicit CSP contract.
- Impact:
  - missing defense-in-depth against XSS, clickjacking, MIME sniffing, unsafe embedding.

## F-04 (Medium): weak password policy and no hardening constraints
- Severity: **Medium**
- Evidence:
  - `apps/api/src/modules/auth/auth.types.ts:5` -> `password.min(6)`
  - `apps/api/src/modules/profile/security/security.types.ts` mirrors low baseline.
- Impact:
  - low-entropy password acceptance increases account takeover risk.

## F-05 (Medium): password change does not revoke active sessions
- Severity: **Medium**
- Evidence:
  - `apps/api/src/modules/profile/security/security.service.ts:10-24` updates hash only.
- Impact:
  - if session token is stolen before password change, session remains valid until token TTL expires.

## F-06 (Medium): CSRF not codified as explicit contract
- Severity: **Medium**
- Evidence:
  - auth uses cookie session model (`apps/api/src/modules/auth/auth.cookie.ts`),
  - no explicit CSRF token/origin-check middleware on state-changing endpoints.
- Impact:
  - currently relies on SameSite behavior and CORS assumptions; if `COOKIE_SAME_SITE=none` or topology changes, risk increases.

## 4) Are security improvements already planned?

## Already planned (good coverage)
- `CACHE-01..09` (`docs/planning/cache-runtime-hardening-plan-2026-04-03.md`):
  - cache/no-store runtime correctness and stale data defense.
- `PEX-13..15` (`docs/planning/production-excellence-plan-2026-04-03.md`):
  - secret inventory, rotation readiness, fail-safe startup checks.
- `PEX-04..09`:
  - runtime watchdog, recovery, observability, incident runbooks.

## Missing from current plans (gap)
- dependency vulnerability remediation program (explicit package upgrade wave),
- spoof-resistant proxy/IP trust model for ops endpoints,
- explicit security headers/CSP rollout contract,
- password policy uplift + session revocation on credential change,
- explicit CSRF guardrail policy for cookie-auth state-changing APIs.

## 5) Concrete hardening plan (new)

Tiny-commit track IDs: `SEC-01..SEC-14`.

## Phase A - Dependency security (highest priority)
- [x] `SEC-01 chore(deps-web): upgrade next to latest patched 15.x line and align eslint-config-next`
- [x] `SEC-02 chore(deps-web): upgrade axios to patched version and run web regression/typecheck`
- [x] `SEC-03 chore(deps-api): upgrade multer to patched 2.1.x and run upload/auth regressions`
- [x] `SEC-04 chore(deps-root): refresh lockfile and re-run pnpm audit (target: no critical/high in prod deps)`

Exit criteria:
- `pnpm audit --prod --audit-level=high` returns no critical/high for app runtime packages.

## Phase B - Network/proxy trust hardening
- [x] `SEC-05 fix(api-ops-guard): stop trusting raw x-forwarded-for directly in requireOpsNetwork; use trusted proxy chain contract`
- [x] `SEC-06 docs(ops-proxy): document canonical proxy trust setup (Coolify/Traefik) and header overwrite requirements`
- [x] `SEC-07 test(api-ops-guard): add regression tests for spoofed forwarded headers`

Exit criteria:
- spoofed forwarded header cannot satisfy ops-network allow checks.

## Phase C - Security headers + CSP
- [x] `SEC-08 feat(api-security-headers): add helmet baseline on api (noSniff/frameguard/referrerPolicy etc.)`
- [x] `SEC-09 feat(web-security-headers): define Next headers() baseline with CSP/frame-ancestors/x-content-type-options`
- [x] `SEC-10 test(web-api-headers): add smoke assertions for security headers in prod-like runs`

Exit criteria:
- dashboard/auth pages and API responses carry documented hardening headers.

## Phase D - Auth hardening
- [x] `SEC-11 feat(auth-password-policy): raise password complexity/length contract + localized validation messages`
- [x] `SEC-12 feat(auth-session-revoke): invalidate existing sessions/tokens on password change`
- [ ] `SEC-13 feat(csrf-guard): add origin+method guard for cookie-auth state-changing endpoints (and stricter behavior when SameSite=None)`
- [ ] `SEC-14 test(auth-security): add e2e coverage for password-policy, session-revoke, csrf/origin guard`

Exit criteria:
- password-change invalidates old sessions and CSRF guard is explicit/covered by tests.

## 6) Suggested order (fastest risk reduction)
1. `SEC-01..04` (dependency vulnerabilities),
2. `SEC-05..07` (ops endpoint trust bypass),
3. `SEC-08..10` (headers/CSP),
4. `SEC-11..14` (auth/CSRF hardening).

## 7) Validation checklist
- `pnpm audit --prod --audit-level=high`
- `pnpm --filter api test -- src/modules/auth/*.test.ts src/modules/upload/*.test.ts`
- `pnpm --filter api test -- src/modules/auth/*.e2e.test.ts src/modules/profile/security/*.e2e.test.ts`
- `pnpm --filter web test`
- `pnpm typecheck`

## 8) Notes
- This plan intentionally avoids behavior changes in trading logic.
- Focus is security posture and production-safe hardening only.

## Progress log
- 2026-04-04: Completed `SEC-01` by upgrading `apps/web` to `next@15.5.14` and `eslint-config-next@15.5.14`; validated with `pnpm --filter web run build` and `pnpm --filter web run typecheck` (after refreshing route types via `pnpm --filter web exec next typegen`).
- 2026-04-04: Completed `SEC-02` by upgrading `apps/web` to `axios@^1.14.0`; validated with `pnpm --filter web run typecheck` and targeted regressions `useLoginForm` + `ApiKeyForm`.
- 2026-04-04: Completed `SEC-03` by upgrading `apps/api` to `multer@^2.1.1`; validated with `pnpm --filter api run typecheck` and auth/upload regression pack (`auth.*`, `requireAuth`, `upload.e2e`).
- 2026-04-04: Completed `SEC-04` by refreshing lockfile and finalizing dependency wave (`express@^5.2.1`, `jsonwebtoken@^9.0.3`, `prisma/@prisma-client@^6.19.3`); validation: `pnpm --filter api run typecheck`, targeted auth/upload/strategies/backtests tests, `pnpm --filter web run typecheck`, auth web tests, and `pnpm audit --prod --audit-level=high` => **No known vulnerabilities found**.
- 2026-04-04: Completed `SEC-05` + `SEC-07` by hardening `requireOpsNetwork` to trust `x-forwarded-for` only when socket peer is a trusted proxy (`OPS_TRUSTED_PROXY_IPS` or private ranges), and adding spoof-regression coverage (`requireOpsNetwork.test.ts`); validated with `pnpm --filter api run typecheck` + middleware tests.
- 2026-04-04: Completed `SEC-06` by documenting proxy trust contract and Coolify/Traefik header-overwrite requirements in `docs/operations/v1-ops-runbook.md` (`Ops Endpoint Proxy Trust Contract` section).
- 2026-04-04: Completed `SEC-08..10` by adding `helmet` baseline headers in API, introducing web `headers()` security contract in `next.config.ts` (CSP + frame/content/referrer/permissions policies), and adding smoke regressions (`security-headers.test.ts`, `next.config.test.ts`); validated with API+web typecheck, targeted tests, and `pnpm --filter web run build`.
- 2026-04-04: Completed `SEC-11` by enforcing stronger password policy (min 8 + letter + digit) across API register/change-password and web register schema, while keeping login/delete-account presence-only validation for backward compatibility with legacy credentials; validated via API+web typecheck and targeted auth/security test packs.
- 2026-04-04: Completed `SEC-12` by introducing user `sessionVersion` (Prisma migration), embedding session version in newly minted auth tokens, validating it in `/auth/me` and `requireAuth`, and incrementing/clearing sessions on password change; validated with `pnpm --filter api run typecheck` and auth/security middleware e2e/unit suite.
