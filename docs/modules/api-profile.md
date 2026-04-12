# API Deep-Dive: Profile Module

## Metadata
- Module name: `profile`
- Layer: `api`
- Source path: `apps/api/src/modules/profile`
- Owner: backend/core
- Last updated: 2026-04-12
- Related planning task: `DCP-04`

## 1. Purpose and Scope
- Owns authenticated user profile surfaces under dashboard scope:
  - basic profile + UI preferences
  - security actions (password/account deletion)
  - API key lifecycle and exchange connection tests
  - active subscription view + checkout intent bootstrap

Out of scope:
- Admin-managed user mutations.
- Exchange order execution (orders/exchange modules).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/profile/*` via `apps/api/src/router/dashboard.routes.ts`.
- Protected by global `requireAuth` on dashboard router.
- Depends on:
  - `prisma` persistence.
  - `users/publicUser` projection contract.
  - `subscriptions.service` for catalog/default subscription alignment.
  - exchange capability/probe helpers for API-key tests.
  - crypto helpers for encrypted API key storage.

## 3. Data and Contract Surface
- Basic profile:
  - `GET/PATCH/DELETE /dashboard/profile/basic`.
  - merges `uiPreferences` safely with table column visibility normalization.
- Security:
  - `PATCH /dashboard/profile/security/password`
  - `DELETE /dashboard/profile/security/account`
- API keys:
  - `GET/POST/PATCH/DELETE /dashboard/profile/apiKeys`
  - `POST /dashboard/profile/apiKeys/test`
  - `POST /dashboard/profile/apiKeys/:id/test`
  - `POST /dashboard/profile/apiKeys/:id/rotate`
  - `POST /dashboard/profile/apiKeys/:id/revoke`
- Subscription:
  - `GET /dashboard/profile/subscription`
  - `POST /dashboard/profile/subscription/checkout-intents`

## 4. Runtime Flows
- Basic profile update:
  1. Read current `uiPreferences`.
  2. Normalize incoming map payloads.
  3. Merge and persist with selected profile fields.
- API key create/test:
  1. Encrypt key/secret at write time.
  2. Execute capability-aware connection probe (Binance contract currently active).
  3. Write audit-safe connection test log metadata.
- Security operations:
  - password change increments `sessionVersion`.
  - account deletion cascades through related domain entities in transaction.

## 5. API and UI Integration
- Dashboard settings and onboarding flows consume these endpoints for profile/security/exchange/subscription panels.
- API-key test routes back LIVE readiness UX in profile and bot setup flows.

## 6. Security and Risk Guardrails
- API key secrets are encrypted at rest; public responses expose masked key values only.
- Sensitive profile routes are rate-limited (`user`/`user_exchange` scopes).
- Security actions require current password verification.
- Account deletion clears dependent runtime/trading entities before user removal.

## 7. Observability and Operations
- API key tests write structured audit entries (`profile.api_key.test_connection`).
- Stage abuse throttling coverage exists for profile-sensitive endpoints.

## 8. Test Coverage and Evidence
- Primary tests:
  - `apps/api/src/modules/profile/basic/basic.e2e.test.ts`
  - `apps/api/src/modules/profile/security/security.e2e.test.ts`
  - `apps/api/src/modules/profile/apiKey/apiKey.e2e.test.ts`
  - `apps/api/src/modules/profile/subscription/subscription.e2e.test.ts`
  - `apps/api/src/modules/profile/stage-abuse-throttling.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/profile/basic/basic.e2e.test.ts src/modules/profile/security/security.e2e.test.ts src/modules/profile/apiKey/apiKey.e2e.test.ts src/modules/profile/subscription/subscription.e2e.test.ts src/modules/profile/stage-abuse-throttling.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Replace remaining string-matched errors with typed error taxonomy.
- Continue reducing duplicated validation logic between profile subdomains where feasible.
