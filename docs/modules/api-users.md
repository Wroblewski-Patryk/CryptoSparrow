# API Deep-Dive: Users Module

## Metadata
- Module name: `users`
- Layer: `api`
- Source path: `apps/api/src/modules/users`
- Owner: backend/core
- Last updated: 2026-04-12
- Related planning task: `DCP-04`

## 1. Purpose and Scope
- Provides shared public-user projection contract used across auth/profile/admin responses.
- Centralizes canonical safe user selection to avoid accidental password/private field exposure.

Out of scope:
- User CRUD endpoints (handled by auth/admin/profile modules).
- Authorization and session lifecycle.

## 2. Boundaries and Dependencies
- Current module content: `publicUser.ts`.
- Depends on Prisma typing (`Prisma.UserSelect` / `Prisma.UserGetPayload`).
- Consumed by:
  - auth service/controller payloads.
  - profile basic service payloads.
  - any API surface requiring safe user projection.

## 3. Data and Contract Surface
- Exports:
  - `publicUserSelect`
  - `PublicUser` type alias
- Included fields:
  - `id`, `email`, `role`, `name`, `avatarUrl`, `createdAt`, `updatedAt`
- Explicitly excludes sensitive fields:
  - `password`
  - session internals unless explicitly selected by caller.

## 4. Runtime Flows
- No standalone runtime flow; this is a shared contract module.
- Flow role is compile-time safety + reuse in dependent modules.

## 5. API and UI Integration
- No direct routes.
- Indirectly impacts API responses consumed by auth/profile/admin UI flows.

## 6. Security and Risk Guardrails
- Security-by-default selection contract for user payload exposure.
- Reduces accidental leakage by standardizing safe field projection.

## 7. Observability and Operations
- No direct logging/metrics.
- Operational impact is correctness of user payload surfaces in dependent modules.

## 8. Test Coverage and Evidence
- No dedicated test file in this module directory.
- Coverage is indirect via auth/profile/admin integration tests.
- Suggested indirect validation command:
```powershell
pnpm --filter api test -- src/modules/auth/auth.e2e.test.ts src/modules/profile/basic/basic.e2e.test.ts src/modules/admin/users/users.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Keep this projection aligned when user schema evolves.
- If multiple projections emerge, define naming policy (`public`, `minimal`, `admin-extended`) to prevent contract drift.
