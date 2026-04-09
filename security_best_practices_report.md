# CryptoSparrow Security + Architecture Audit Report

Date: 2026-04-09  
Scope: `apps/api`, `apps/web`, selected infra/config scripts, targeted test execution

## Executive Summary

Overall posture is **solid but with meaningful hardening gaps**:
- authentication/cookies/origin checks are implemented and covered by tests,
- dependency audit is currently clean (`pnpm audit --prod` -> no known vulnerabilities),
- however, there are still **proxy/header trust risks**, **redirect/callback URL trust gaps**, **CSP weakening**, and **architecture quality regressions** (including a failing security e2e suite).

## Method

- Static review of high-risk code paths (auth, cookies, CORS, trusted-origin, uploads, payments, middleware, CSP, service worker).
- Architecture review for maintainability hotspots and module coupling.
- Commands run:
  - `pnpm audit --prod` -> no known vulnerabilities.
  - `pnpm --filter api test -- src/router/security-headers.test.ts src/middleware/requireTrustedOrigin.test.ts src/modules/upload/upload.e2e.test.ts`
    - `security-headers` and `requireTrustedOrigin` passed,
    - upload security suite failed due FK cleanup breakage.
  - `pnpm run quality:guardrails`
    - failed due source file budget exceeded in three files.

## Findings

### F-01 - High - Global proxy trust + forwarded headers used in security-sensitive flows
- Rule: proxy/header trust hardening.
- Severity: **High**
- Location:
  - `apps/api/src/index.ts:19`
  - `apps/api/src/modules/upload/upload.routes.ts:61-67`
  - `apps/api/src/middleware/rateLimit.ts:20-24`
- Evidence:
  - `app.set('trust proxy', true);`
  - `resolvePublicOrigin` builds URL from `X-Forwarded-Proto` + `X-Forwarded-Host`.
  - rate-limit IP extraction reads raw `x-forwarded-for`.
- Impact:
  - if edge/proxy overwrite rules drift, attacker-supplied forwarding headers can influence security decisions and generated URLs.
- Fix:
  - replace blanket `trust proxy=true` with explicit trust chain/CIDR contract,
  - centralize trusted client/public-origin resolution with allowlisted hostnames,
  - ensure reverse proxy strips/overwrites forwarded headers.
- Mitigation:
  - lock proxy config in ops runbook and enforce with integration smoke tests.

### F-02 - Medium - Avatar URL generation is host-header poisonable
- Rule: untrusted header to URL sink.
- Severity: **Medium**
- Location:
  - `apps/api/src/modules/upload/upload.routes.ts:61-67`
  - `apps/api/src/modules/upload/upload.routes.ts:89`
  - `apps/web/src/features/profile/components/BasicForm.tsx:59-63`
- Evidence:
  - response URL is derived from request headers and then stored in user profile flow.
- Impact:
  - incorrect or attacker-controlled host can be persisted as avatar URL (phishing/tracking/mixed-origin issues).
- Fix:
  - derive public origin from immutable config (`APP_URL`/`CLIENT_URL`) rather than request headers.

### F-03 - Medium - Checkout callback URLs allow arbitrary origins
- Rule: open redirect / URL allowlist validation.
- Severity: **Medium**
- Location:
  - `apps/api/src/modules/profile/subscription/subscription.controller.ts:11-12`
  - `apps/api/src/modules/profile/subscription/subscription.controller.ts:27-31`
  - `apps/api/src/modules/subscriptions/payments/stripePaymentGateway.provider.ts:79-86`
  - `apps/api/src/modules/subscriptions/payments/manualPaymentGateway.provider.ts:11`
- Evidence:
  - `successUrl` and `cancelUrl` are accepted as any URL and forwarded to gateway adapters.
- Impact:
  - redirect/callback can point to attacker-controlled destination.
- Fix:
  - enforce same-origin or strict allowlist for callback URLs; fallback to canonical profile route.

### F-04 - Medium - Production CSP includes `unsafe-inline` scripts
- Rule: CSP hardening.
- Severity: **Medium**
- Location:
  - `apps/web/next.config.ts:7`
  - `apps/web/src/app/layout.tsx:63-86`
- Evidence:
  - prod CSP sets `script-src 'self' 'unsafe-inline'`,
  - inline bootstrap script is injected via `dangerouslySetInnerHTML`.
- Impact:
  - XSS defense-in-depth from CSP is weakened.
- Fix:
  - migrate to nonce/hash-based boot script and remove `unsafe-inline` for scripts.

### F-05 - Low - `/ready` exposes detailed configuration gaps without auth
- Rule: error/info minimization on public health surfaces.
- Severity: **Low**
- Location:
  - `apps/api/src/router/index.ts:33-41`
- Evidence:
  - response returns `missing` and `issues` arrays for secrets/config readiness.
- Impact:
  - reconnaissance value for attackers.
- Fix:
  - keep detailed readiness only on protected ops route; expose generic public readiness status.

### F-06 - Medium - Missing abuse throttling on some sensitive profile flows
- Rule: rate limit critical state-changing endpoints.
- Severity: **Medium**
- Location:
  - `apps/api/src/modules/profile/subscription/subscription.routes.ts:7`
  - `apps/api/src/modules/profile/security/security.routes.ts:6-7`
  - `apps/api/src/modules/profile/apiKey/apiKey.routes.ts:7,12-13` (positive reference: has limiter)
- Evidence:
  - `checkout-intents` and security routes have no local limiter, while API-key test endpoints are throttled.
- Impact:
  - higher abuse/cost surface (checkout intent spam, password/account action spray from stolen sessions).
- Fix:
  - add per-user limiter for `checkout-intents`, password change, and account deletion routes.

### F-07 - Medium - Upload security e2e suite currently fails before assertions
- Rule: security regression suite must stay green.
- Severity: **Medium**
- Location:
  - `apps/api/src/modules/upload/upload.e2e.test.ts:19-38`
- Evidence:
  - cleanup omits runtime bot tables before `prisma.bot.deleteMany()`,
  - observed failure: FK constraint `BotRuntimeSession_botId_fkey`.
- Impact:
  - upload security contract tests do not provide real protection in CI/local runs.
- Fix:
  - align cleanup order with newer schema (include runtime tables first), same pattern as `subscription.e2e.test.ts:30-33`.

### F-08 - Medium - File-budget guardrails failing on key modules (architecture risk)
- Rule: maintainability and change blast-radius control.
- Severity: **Medium**
- Location:
  - `apps/api/src/modules/backtests/backtests.service.ts`
  - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
  - `apps/web/src/features/bots/components/BotsManagement.tsx`
  - `scripts/repoGuardrails.mjs:89-118`
- Evidence:
  - `pnpm run quality:guardrails` reports size budget exceeded for all three files.
- Impact:
  - high regression risk, slower reviews, harder secure refactors.
- Fix:
  - continue extraction plan into domain-focused services/components; keep orchestration wrappers thin.

### F-09 - Low - Strong DB coupling across modules (architecture scalability risk)
- Rule: layered architecture / boundary hygiene.
- Severity: **Low**
- Location:
  - multiple service modules import Prisma directly (60 matches in `apps/api/src/modules/**`).
- Evidence:
  - broad direct `prisma` usage in module services.
- Impact:
  - transaction boundaries are diffuse, tests are more brittle, and domain extraction is harder.
- Fix:
  - introduce per-domain repositories/data-access boundaries for high-change modules first (`bots`, `backtests`, `engine`).

## Validation Results

- `pnpm audit --prod`: **pass** (no known vulnerabilities)
- `security-headers.test.ts`: **pass**
- `requireTrustedOrigin.test.ts`: **pass**
- `upload.e2e.test.ts`: **fail** (schema-cleanup FK issue)
- `pnpm run quality:guardrails`: **fail** (file-size budget exceed)

## Recommended Remediation Order

1. Fix F-07 (restore failing security e2e signal).
2. Fix F-01 + F-02 together (proxy/header trust and public origin derivation).
3. Fix F-03 (checkout callback allowlist).
4. Fix F-04 (CSP `unsafe-inline` removal path).
5. Fix F-06 (rate limits for profile security/payment intents).
6. Continue F-08/F-09 architecture decomposition workstream.

