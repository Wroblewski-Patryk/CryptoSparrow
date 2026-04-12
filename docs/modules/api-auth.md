# API Deep-Dive: Auth Module

## Metadata
- Module name: `auth`
- Layer: `api`
- Source path: `apps/api/src/modules/auth`
- Owner: backend/core
- Last updated: 2026-04-12
- Related planning task: `DCP-04`

## 1. Purpose and Scope
- Handles account registration, login, session bootstrap, and logout.
- Issues JWT-based session tokens and returns public user payload.
- Initializes default subscription state during registration transaction.

Out of scope:
- Dashboard resource authorization (handled by `requireAuth` middleware on dashboard/admin routers).
- API key management (profile module).

## 2. Boundaries and Dependencies
- Router mount: `/auth` via `apps/api/src/router/index.ts`.
- Depends on:
  - `prisma` for user/sessionVersion data.
  - password hashing utils (`hashPassword`, `comparePassword`).
  - JWT/session helpers (`auth.jwt`, `auth.session`, cookie helpers).
  - subscriptions bootstrap (`ensureSubscriptionCatalog`, `ensureDefaultSubscriptionForUser`).
- Consumed by web auth flows (`/auth/login`, `/auth/register`) and session bootstrap calls.

## 3. Data and Contract Surface
- Input contracts: `RegisterInput`, `LoginInput` (`auth.types.ts`).
- Output contracts:
  - registration returns public user profile.
  - login returns `{ token, user }` where user matches `publicUserSelect`.
- Invariants:
  - unique email enforced before create.
  - login requires password validation.
  - `sessionVersion` carried in token payload for forced logout/session invalidation.

## 4. Runtime Flows
- Register:
  1. Check duplicate email.
  2. Hash password.
  3. Create user in transaction.
  4. Ensure subscription catalog/default assignment.
- Login:
  1. Load user + password hash + `sessionVersion`.
  2. Validate password.
  3. Sign token with remember-aware TTL.
  4. Return token + public user fields.
- Logout:
  - Token/cookie invalidation handled in controller/cookie helpers.

## 5. API and UI Integration
- Routes:
  - `POST /auth/register`
  - `GET /auth/me`
  - `POST /auth/login`
  - `POST /auth/logout`
- Rate limits:
  - auth general limiter.
  - stricter login limiter.

## 6. Security and Risk Guardrails
- Passwords are never stored plaintext (hash-only persistence).
- Session token includes `sessionVersion` for revocation after sensitive actions.
- Auth endpoints are rate-limited to reduce brute-force pressure.
- Public response uses `publicUserSelect` (no password leakage).

## 7. Observability and Operations
- Auth outcomes surface through standard request logging.
- Cookie/session behavior covered by dedicated auth cookie/session tests.

## 8. Test Coverage and Evidence
- Primary tests:
  - `apps/api/src/modules/auth/auth.e2e.test.ts`
  - `apps/api/src/modules/auth/auth.service.test.ts`
  - `apps/api/src/modules/auth/auth.cookie.test.ts`
  - `apps/api/src/modules/auth/auth.jwt.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/auth/auth.e2e.test.ts src/modules/auth/auth.service.test.ts src/modules/auth/auth.cookie.test.ts src/modules/auth/auth.jwt.test.ts
```

## 9. Open Issues and Follow-Ups
- Migrate remaining message-string failures to typed auth errors in optimization wave.
- Continue hardening session invalidation semantics around account deletion and password rotation.
