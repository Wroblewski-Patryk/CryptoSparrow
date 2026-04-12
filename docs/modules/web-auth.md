# Web Deep-Dive: Auth Module

## Metadata
- Module name: `auth`
- Layer: `web`
- Source path: `apps/web/src/features/auth`
- Owner: frontend/auth
- Last updated: 2026-04-12
- Related planning task: `DCP-08`

## 1. Purpose and Scope
- Owns public authentication pages and form workflows:
  - login
  - registration
  - password visibility UX controls
- Integrates with session bootstrap from shared `AuthContext`.

Out of scope:
- Server auth token issuance and cookie policy (API auth module).
- Protected dashboard route rendering after login.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/auth/login` -> `features/auth/pages/LoginPage.tsx`
  - `/auth/register` -> `features/auth/pages/RegisterPage.tsx`
- Depends on:
  - auth service calls to `/auth/login` and `/auth/register`
  - shared `AuthContext` (`refetchUser`) for session confirmation
  - Next router redirects and toast messaging

## 3. Data and Contract Surface
- Client validation:
  - zod-based form schemas (`types/form.types.ts`)
- API contracts used:
  - `POST /auth/login`
  - `POST /auth/register`
- UI behavior contract:
  - confirm session via `refetchUser` before success redirect to `/dashboard`
  - inline + toast error feedback on failed login/register

## 4. Runtime Flows
- Login flow:
  1. Validate form with zod/react-hook-form.
  2. Submit login request.
  3. Trigger `refetchUser` to confirm active session.
  4. Redirect to `/dashboard` on success; show deterministic error on failure.
- Register flow:
  1. Validate payload and terms acceptance.
  2. Submit registration request.
  3. Redirect to login/dashboard path based on session behavior.

## 5. UI Integration
- Components:
  - `LoginForm`
  - `RegisterForm`
  - `PasswordVisibilityToggle`
- Public layout route group:
  - `apps/web/src/app/(public)/auth/*`

## 6. Security and Risk Guardrails
- Password fields support visibility toggle without exposing values outside form scope.
- Protected-route session failures are centrally handled by API interceptor and auth context.
- Auth forms avoid false-positive success by requiring real session refresh confirmation.

## 7. Observability and Operations
- Session-expired routing path is standardized (`/auth/login?session=expired`) by API interceptor.
- Middleware transport guard checks token cookie before `/dashboard` and `/admin` access.

## 8. Test Coverage and Evidence
- Primary tests:
  - `LoginForm.test.tsx`
  - `RegisterForm.test.tsx`
  - `useLoginForm.test.tsx`
  - `types/form.types.test.ts`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/auth/components/LoginForm.test.tsx src/features/auth/components/RegisterForm.test.tsx src/features/auth/hooks/useLoginForm.test.tsx src/features/auth/types/form.types.test.ts
```

## 9. Open Issues and Follow-Ups
- Forgot-password UX is intentionally deferred and currently represented as static hint text.
- Consider i18n migration for remaining hardcoded auth component labels.

