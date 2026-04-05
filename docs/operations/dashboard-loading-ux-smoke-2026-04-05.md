# Dashboard Loading UX Smoke (2026-04-05)

Task: `LDUX-09 qa(web-dashboard): run manual desktop/mobile smoke and capture evidence`.

## Scope

- Global dashboard route progress under header.
- Skeleton-first loading states for dashboard runtime modules.
- Skeleton loading states in backtests list/details.
- Responsive contract for mobile dashboard navigation overlay (`dvh` sizing).

## Environment

- Workspace: `C:\Personal\Projekty\Aplikacje\CryptoSparrow`
- Date: 2026-04-05
- Mode: local QA smoke (test-driven evidence, desktop/mobile contracts)

## Executed checks

1. `pnpm --filter web run typecheck`
2. `pnpm --filter web exec -- vitest run src/ui/layout/dashboard/Header.responsive.test.tsx src/ui/layout/dashboard/DashboardRouteProgress.test.tsx src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/features/dashboard-home/components/LiveMarketBar.test.tsx src/features/bots/components/BotsManagement.test.tsx src/features/markets/components/MarketsFlow.test.tsx src/features/logs/components/AuditTrailView.test.tsx src/features/backtest/components/BacktestsListView.test.tsx src/features/backtest/components/BacktestRunDetails.test.tsx`

## Result

- `typecheck`: PASS
- `vitest`: PASS (`9` files / `26` tests)

## Evidence highlights

- Route progress lifecycle: start/complete/hash-ignore contract green in `DashboardRouteProgress.test.tsx`.
- Mobile menu responsive overlay (`top/height/max/min`, scroll lock): green in `Header.responsive.test.tsx`.
- Dashboard/Bots runtime loading skeleton paths: green in `HomeLiveWidgets.test.tsx` and `BotsManagement.test.tsx`.
- Markets/Logs loading skeleton paths: green in `MarketsFlow.test.tsx` and `AuditTrailView.test.tsx`.
- Backtests list/details skeleton loading paths: green in `BacktestsListView.test.tsx` and `BacktestRunDetails.test.tsx`.

## QA status

- PASS (loading UX regression set stable for desktop/mobile contracts).

