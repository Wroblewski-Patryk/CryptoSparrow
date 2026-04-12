# Web Deep-Dive: Reports Module

## Metadata
- Module name: `reports`
- Layer: `web`
- Source path: `apps/web/src/features/reports`
- Owner: frontend/reporting
- Last updated: 2026-04-12
- Related planning task: `DCP-09`

## 1. Purpose and Scope
- Renders performance analytics page under `/dashboard/reports`.
- Combines:
  - cross-mode performance summary (BACKTEST/PAPER/LIVE)
  - aggregated per-run performance statistics

Out of scope:
- Raw backtest timeline detail rendering (backtest module).
- Persistent reporting export pipelines.

## 2. Boundaries and Dependencies
- Route entrypoint:
  - `/dashboard/reports`
- Depends on:
  - reports API service (`/dashboard/reports/cross-mode-performance`)
  - backtest APIs for completed runs and reports
  - shared locale formatting helpers

## 3. Data and Contract Surface
- API contracts:
  - `getCrossModePerformance()`
  - `listBacktestRuns("COMPLETED")`
  - `getBacktestRunReport(runId)`
- UI metrics:
  - reports count
  - average net pnl
  - average win rate
  - best run summary

## 4. Runtime Flows
- Load flow:
  1. Fetch completed runs and cross-mode performance.
  2. Resolve report payload for recent runs.
  3. Compute dashboard summary metrics.
  4. Render mode comparison and per-run performance tables.

## 5. UI Integration
- Main component:
  - `PerformanceReportsView`
- State model:
  - loading
  - error
  - empty (no reports)
  - success (cards + tables)

## 6. Security and Risk Guardrails
- All report data is sourced through authenticated dashboard API client.
- Missing report rows are safely filtered out of run table rendering.

## 7. Observability and Operations
- Cross-mode table gives operator-level parity snapshot for runtime/backtest outcomes.
- Error state includes retry path for transient backend outages.

## 8. Test Coverage and Evidence
- Primary tests:
  - `PerformanceReportsView.test.tsx`
- Suggested validation command:
```powershell
pnpm --filter web test -- src/features/reports/components/PerformanceReportsView.test.tsx
```

## 9. Open Issues and Follow-Ups
- Continue i18n hardening for remaining static labels in report cards/tables.
- Consider report query filters (date range, bot, market, strategy) for larger datasets.

