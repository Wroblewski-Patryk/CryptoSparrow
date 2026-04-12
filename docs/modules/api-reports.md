# API Deep-Dive: Reports Module

## Metadata
- Module name: `reports`
- Layer: `api`
- Source path: `apps/api/src/modules/reports`
- Owner: backend/reporting
- Last updated: 2026-04-12
- Related planning task: `DCP-07`

## 1. Purpose and Scope
- Provides dashboard performance summary across execution modes.
- Exposes a single authenticated read endpoint for cross-mode performance aggregation.

Out of scope:
- Backtest run orchestration and timeline details (backtests module).
- Runtime execution details and order placement (engine/orders modules).

## 2. Boundaries and Dependencies
- Mounted under `/dashboard/reports`.
- Depends on:
  - Prisma read access to `backtestReport` and `trade`.
  - Dashboard auth context (`req.user.id`) from shared middleware chain.

## 3. Data and Contract Surface
- Core response contract:
  - `generatedAt`
  - `modeResolution` (`BOT_CURRENT_MODE`)
  - `rows[]` with `BACKTEST | PAPER | LIVE` aggregates
- Aggregate row fields:
  - `totalTrades`, `winningTrades`, `losingTrades`
  - `winRate`, `netPnl`, `grossProfit`, `grossLoss`

## 4. Runtime Flows
- Cross-mode performance flow:
  1. Controller requires authenticated `userId`.
  2. Service fetches backtest report rows and paper/live trades in parallel.
  3. Aggregator computes deterministic metrics per mode.
  4. API returns compact summary payload for dashboard reports widgets.

## 5. API and UI Integration
- Representative routes:
  - `GET /dashboard/reports/cross-mode-performance`
- Rate limit:
  - 120 requests per 60 seconds (trading read limiter).

## 6. Security and Risk Guardrails
- No public access; endpoint requires dashboard authentication.
- Query is user-scoped and never returns cross-tenant data.
- Read-only contract with no write side effects.

## 7. Observability and Operations
- Lightweight service with deterministic aggregation logic.
- Uses bounded reads (`take`) to avoid unbounded query amplification.

## 8. Test Coverage and Evidence
- Primary tests:
  - `reports.service.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/reports/reports.service.test.ts
```

## 9. Open Issues and Follow-Ups
- Add richer filtering dimensions (time window, strategy, symbol) when reporting scope expands.
- Consider explicit report snapshot persistence if dashboard history UX requires it.
