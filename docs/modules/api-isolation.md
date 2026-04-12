# API Deep-Dive: Isolation Contract Module

## Metadata
- Module name: `isolation`
- Layer: `api`
- Source path: `apps/api/src/modules/isolation`
- Owner: backend/security
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Verifies cross-module tenant data isolation with integration-level contract tests.
- Ensures authenticated user can only access owned data across critical dashboard domains.

Out of scope:
- Runtime ownership middleware implementation details in each module.
- Database row-level-security managed outside application logic.

## 2. Boundaries and Dependencies
- No runtime HTTP routes in this module.
- Depends on representative endpoints and persistence for:
  - markets
  - bots
  - orders
  - positions
  - backtests data-level ownership checks

## 3. Data and Contract Surface
- Canonical isolation contract:
  - user A must not read/write user B entities
  - list endpoints return owner-scoped data only
  - direct DB assertions verify separation for backtest runs when endpoint coverage is partial

## 4. Runtime Flows
- Contract test flow:
  1. Create two authenticated users.
  2. Seed separate entities for each user across modules.
  3. Read endpoints with owner auth and validate single-tenant visibility.
  4. Assert data-level backtest isolation in persistence layer.

## 5. API and UI Integration
- No direct endpoint exposure.
- Serves as integration safety net for dashboard API surface.

## 6. Security and Risk Guardrails
- Acts as regression barrier for cross-tenant data leaks.
- Covers both API read paths and data-layer ownership assumptions.

## 7. Observability and Operations
- Test suite is an operational confidence pack for auth + ownership policies.

## 8. Test Coverage and Evidence
- Primary tests:
  - `data-isolation.e2e.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/isolation/data-isolation.e2e.test.ts
```

## 9. Open Issues and Follow-Ups
- Add explicit negative tests for update/delete ownership violations across more modules.
- Expand isolation contract once backtest endpoint coverage is fully implemented.

