# Module Map

## Backend Modules (Current)
- auth. Registration, login, JWT handling.
- profile. User profile management and API keys.
- strategies. Strategy CRUD and indicator metadata.
- markets. Market universe CRUD (base, whitelist, blacklist).
- bots. Bot CRUD with LIVE opt-in consent validation.
- orders. Read and write endpoints for order history/details plus open/cancel/close actions.
- positions. Read endpoints plus live reconciliation status exposure.
- backtests. Backtest run/trade/report plus timeline endpoint (`/dashboard/backtests/runs/:id/timeline`) with progressive chunk loading (`events` + `candles`), lifecycle event overlays, indicator series, parity diagnostics, and position stats (`tradeCount`, `closedOnFinalCandleCount`, `liquidationsCount`).
- logs. Audit/event log read endpoints.
- exchange. CCXT connector and retrying live-order adapter services.
- market-data. OHLCV ingest/cache service abstractions.
- market-stream. Binance WebSocket ingest worker with normalized ticker/candle payloads.
- market-stream fan-out gateway. Server-owned SSE broadcast path from worker events to dashboard clients.
- execution-orchestrator. Runtime signal -> order -> position orchestration service.
- runtime automation bridge. Continuous stream -> signal evaluation loop with periodic scan support.
- upload, middleware, pagination, isolation. Supporting infrastructure.

## Backend Modules (Planned for MVP Completion)
- reports. Unified performance metrics parity across backtest/paper/live runtime datasets.
- ai-assistants. Assistant profiles, mandate/risk config, and scope assignment to bots/bindings.

## Frontend Areas (Current)
- public. Landing and public pages.
- public/auth. Login and registration.
- dashboard. Control Center shell with snapshots.
- dashboard/exchanges. Exchange connections domain entry with nested orders/positions views.
- dashboard/profile. User settings.
- dashboard/strategies. Strategy list and editor.
- dashboard/markets. Market universe management.
- dashboard/bots. Bot management and mode controls.
- dashboard/backtest. Backtest pages with localized run header, summary/markets/trades/raw tabs, progressive per-symbol timeline loading, and parity-aware error states.
- dashboard/logs. Audit/log pages.
- dashboard/reports. Performance reporting views.
- dashboard home live market bar with SSE client state.

## Frontend Areas (Planned for MVP Completion)
- dashboard richer paper/live runtime controls and state transitions.
- dashboard manual trade ticket UX beyond API-first actions.

## Dashboard IA Order (MVP)
- dashboard. Control Center with risk and operations priority.
- dashboard/exchanges.
- dashboard/strategies.
- dashboard/markets.
- dashboard/bots.
- dashboard/backtest.
- dashboard/reports.
- dashboard/logs.
- dashboard/profile.

## UX Expectations Per Frontend Module (MVP)
- dashboard (Control Center). Safety bar, KPI risk row, positions/orders snapshots, bot status, quick actions, and recent audit feed.
- dashboard/strategies. List-first workflow with clear preset/source metadata and safe edit/delete controls.
- dashboard/markets. Universe builder with filter explainability and explicit whitelist/blacklist outcomes.
- dashboard/bots. Lifecycle controls with explicit paper/live mode, heartbeat visibility, and emergency controls.
- dashboard/exchanges. Connection health, permission checks, secure API key UX, plus nested order/position operational views.
- dashboard/backtest. Run management with:
  - run header KPI strip (trades, net PnL, win rate, drawdown) and compact stage timeline,
  - summary charts (daily PnL bars + portfolio balance line),
  - market-by-market timeline overlays (candles, indicators, entry/exit/DCA markers, non-overlapping position ranges, RSI panel),
  - pair-side stats card (trades in-range/total, win rate, PnL, avg hold, execution and lifecycle counts),
  - trades table with capital context (notional/margin entry+exit), move%, PnL%, fees, exit reason, cumulative PnL.
- dashboard/reports. Performance summaries focused on PnL, drawdown, fees, and funding costs.
- dashboard/logs. High-signal audit trail with severity, source, and actor filtering.
- dashboard/profile. Account and user preferences, including locale selection.
