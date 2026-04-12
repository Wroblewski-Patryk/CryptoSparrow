# Web Deep-Dive: Backtest Module

## Metadata
- Module name: `backtest`
- Layer: `web`
- Source path: `apps/web/src/features/backtest`
- Owner: frontend/trading-analysis
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Implements backtest execution UX:
  - run creation
  - runs list
  - run details with timeline/trades/report views
- Provides replay and diagnostics presentation for strategy validation.

Out of scope:
- Backtest simulation engine internals (API engine/backtests modules).
- Strategy authoring and market universe management screens.

## 2. Boundaries and Dependencies
- Route entrypoints:
  - `/dashboard/backtests/list`
  - `/dashboard/backtests/create`
  - `/dashboard/backtests/:id`
- Depends on:
  - backtests API service (`features/backtest/services/backtests.service.ts`)
  - shared view-state components and i18n formatting
  - timeline overlay and metrics utility helpers

## 3. Data and Contract Surface
- API contracts used:
  - list/create/delete/get runs
  - run trades
  - run report
  - paged timeline payload with candle/indicator/event toggles
- UI contracts:
  - deterministic staged loading for details pages
  - failed-symbol/timeline error visibility without hard crash

## 4. Runtime Flows
- Create flow:
  1. Fill run config in `BacktestCreateForm`.
  2. Submit to create endpoint.
  3. Navigate to run details page.
- Details flow:
  1. Load core run summary data.
  2. Load timeline chunks and trade/report details.
  3. Render charts, event markers, and performance sections with fallback states.
- List flow:
  1. Fetch latest runs.
  2. Filter/sort and navigate to selected run details.

## 5. UI Integration
- Main components:
  - `BacktestsListView`
  - `BacktestCreateForm`
  - `BacktestRunDetails`
- Additional utilities:
  - timeline indicator overlays
  - pair metrics display
  - non-overlapping trade segment calculations

## 6. Security and Risk Guardrails
- All operations go through authenticated dashboard API client.
- Invalid timeline requests and missing reports are handled with fail-safe UI states.

## 7. Observability and Operations
- Component-level retry and staged loaders reduce transient hard-error flashes.
- Details module includes explicit handling for symbol-level parity failures.

## 8. Test Coverage and Evidence
- Primary tests:
  - `BacktestCreateForm.test.tsx`
  - `BacktestRunDetails.test.tsx`
  - `BacktestsList.test.tsx`
  - `BacktestsListView.test.tsx`
  - `useBacktestRunCoreData.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/backtest/components/BacktestCreateForm.test.tsx src/features/backtest/components/BacktestRunDetails.test.tsx src/features/backtest/components/BacktestsList.test.tsx src/features/backtest/components/BacktestsListView.test.tsx src/features/backtest/hooks/useBacktestRunCoreData.test.tsx
```

## 9. Open Issues and Follow-Ups
- Continue splitting large detail view logic as timeline features grow.
- Consider server-side pagination controls in list view for larger run volumes.

