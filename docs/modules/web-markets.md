# Web Deep-Dive: Markets Module

## Metadata
- Module name: `markets`
- Layer: `web`
- Source path: `apps/web/src/features/markets`
- Owner: frontend/market-universe
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Owns market-universe authoring used by bots and backtests.
- Provides CRUD screens and symbol selection tools for whitelist/blacklist driven groups.

Out of scope:
- Strategy rule authoring and bot lifecycle management.
- Exchange execution configuration.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/dashboard/markets/list`
  - `/dashboard/markets/create`
  - `/dashboard/markets/:id/edit`
- Depends on:
  - markets API service (`/dashboard/markets/universes*`, `/dashboard/markets/catalog`)
  - market universe helpers and multi-select field controls
  - shared page state components

## 3. Data and Contract Surface
- API contracts:
  - list/create/get/update/delete market universes
  - fetch market catalog by exchange/baseCurrency/marketType
- Form contracts:
  - `CreateMarketUniverseInput`
  - market symbol include/exclude and auto-exclude controls

## 4. Runtime Flows
- List flow:
  1. Load universes.
  2. Show table with delete/update actions.
  3. Surface empty state with path to create first universe.
- Create/edit flow:
  1. Resolve market catalog candidates.
  2. Build whitelist/blacklist payload.
  3. Submit and navigate back to edit/list flow.
  4. Handle active-bot edit lock errors with explicit messaging.

## 5. UI Integration
- Main components:
  - `MarketUniversesTable`
  - `MarketUniverseForm`
  - `SearchableMultiSelect`
  - shared field controls

## 6. Security and Risk Guardrails
- All mutations are authenticated dashboard calls.
- Edit errors from active bot usage are surfaced clearly and fail closed.
- Input normalization reduces invalid symbol list drift.

## 7. Observability and Operations
- Form derives symbol options from catalog endpoint when capability is available.
- List and form states include explicit loading/error/empty branches.

## 8. Test Coverage and Evidence
- Primary tests:
  - `MarketUniverseForm.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/markets/components/MarketUniverseForm.test.tsx
```

## 9. Open Issues and Follow-Ups
- Expand table-level regressions for filtering/sorting behavior.
- Consider server-driven pagination for large universe lists.

