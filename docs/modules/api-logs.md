# API Deep-Dive: Logs Module

## Metadata
- Module name: `logs`
- Layer: `api`
- Source path: `apps/api/src/modules/logs`
- Owner: backend/observability
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Exposes authenticated audit log read API for dashboard operators.
- Supports filtering and pagination over user-scoped log events.

Out of scope:
- Log write pipeline (produced by runtime and feature modules).
- External log shipping/retention infrastructure.

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/logs`.
- Depends on:
  - Prisma `log` model reads.
  - query schema validation (`LogsQuerySchema`).
  - dashboard auth context (`req.user.id`).

## 3. Data and Contract Surface
- Query contract:
  - filters: `source`, `actor`, `severity`
  - pagination: `limit` (1..200, default 100), `page` (min 1, default 1)
- Result contract:
  - raw log rows ordered by `occurredAt desc`.

## 4. Runtime Flows
- Logs list flow:
  1. Require authenticated user id.
  2. Parse and validate query parameters.
  3. Compute pagination offset (`skip = (page - 1) * limit`).
  4. Query logs with user and optional filter constraints.
  5. Return ordered log list.

## 5. API and UI Integration
- Representative route:
  - `GET /dashboard/logs`
- Rate limit:
  - 120 requests per 60 seconds.

## 6. Security and Risk Guardrails
- Auth required for access.
- Strict user scoping in query filter prevents cross-tenant reads.
- Query schema constrains pagination and filter payload shape.

## 7. Observability and Operations
- Designed for dashboard audit trail drill-down and incident triage.
- Compatible with shared pagination standards test.

## 8. Test Coverage and Evidence
- Primary tests:
  - `logs.e2e.test.ts`
  - `pagination-query.test.ts` (shared pagination standard)
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/logs/logs.e2e.test.ts src/modules/pagination/pagination-query.test.ts
```

## 9. Open Issues and Follow-Ups
- Add total-count envelope for richer paginated UI controls.
- Consider index tuning if log volume growth impacts query latency.

