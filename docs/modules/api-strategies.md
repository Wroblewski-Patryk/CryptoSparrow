# API Deep-Dive: Strategies Module

## Metadata
- Module name: `strategies`
- Layer: `api`
- Source path: `apps/api/src/modules/strategies`
- Owner: backend/trading-domain
- Last updated: 2026-04-12
- Related planning task: `DCP-06`

## 1. Purpose and Scope
- Owns strategy CRUD plus import/export contracts for user trading strategies.
- Exposes indicators catalog endpoint used by strategy builder UX.
- Enforces active-bot safety guardrails before strategy mutation/deletion.

Out of scope:
- Runtime signal execution (engine/bots runtime services).
- Market universe ownership and symbol resolution (markets module).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/strategies`.
- Depends on:
  - `prisma` strategy persistence.
  - bot linkage tables (`marketGroupStrategyLink`, legacy `botStrategy`) for active-use checks.
  - indicators submodule data/service.

## 3. Data and Contract Surface
- Core DTO: `CreateStrategyDto` (+ partial updates).
- Import/export contracts:
  - `StrategyExportPackage`
  - `STRATEGY_EXPORT_FORMAT_VERSION`
- Safety invariant:
  - update/delete blocked when strategy is used by active bot (`STRATEGY_USED_BY_ACTIVE_BOT`).

## 4. Runtime Flows
- CRUD flow:
  1. Scope by `userId`.
  2. Validate ownership and active-bot guardrail.
  3. Persist strategy config as JSON.
- Import flow:
  - validate package format and required fields before create.
- Export flow:
  - emit deterministic package schema with format version.

## 5. API and UI Integration
- Routes:
  - `GET /dashboard/strategies`
  - `POST /dashboard/strategies/import`
  - `GET /dashboard/strategies/:id`
  - `GET /dashboard/strategies/:id/export`
  - `POST /dashboard/strategies`
  - `PUT /dashboard/strategies/:id`
  - `DELETE /dashboard/strategies/:id`
  - `GET /dashboard/strategies/indicators`
- Read/write rate limiters applied at router level.

## 6. Security and Risk Guardrails
- All routes under dashboard auth boundary.
- Ownership isolation on all reads/writes.
- Active bot usage block reduces runtime contract breakage.

## 7. Observability and Operations
- Standard request logging + e2e coverage for strategy contracts.
- Import/export version contract prevents silent schema drift.

## 8. Test Coverage and Evidence
- Primary tests:
  - `apps/api/src/modules/strategies/strategies.e2e.test.ts`
  - `apps/api/src/modules/strategies/indicators/indicators.service.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/strategies/strategies.e2e.test.ts src/modules/strategies/indicators/indicators.service.test.ts
```

## 9. Open Issues and Follow-Ups
- Migrate string-based error signaling to typed domain errors.
- Keep indicators catalog synchronized with web strategy presentation contracts.
