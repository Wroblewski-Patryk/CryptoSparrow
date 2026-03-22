# Module Map

## Backend Modules (Current)
- auth. Registration, login, JWT handling.
- profile. User profile management and API keys.
- strategies. Strategy CRUD and indicator metadata.
- markets. Market universe CRUD (base, whitelist, blacklist).
- bots. Bot CRUD with LIVE opt-in consent validation.
- orders. Read and write endpoints for order history/details plus open/cancel/close actions.
- positions. Read endpoints plus live reconciliation status exposure.
- backtests. Backtest run/trade/report plus timeline endpoint (`/dashboard/backtests/runs/:id/timeline`) with chunked candles, event overlays, and indicator series.
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

## Frontend Areas (Current)
- public. Landing and public pages.
- public/auth. Login and registration.
- dashboard. Control Center shell with snapshots.
- dashboard/profile. User settings.
- dashboard/strategies. Strategy list and editor.
- dashboard/markets. Market universe management.
- dashboard/bots. Bot management and mode controls.
- dashboard/orders. Order history and risk-first write-side actions.
- dashboard/positions. Position views with live-status support.
- dashboard/backtest. Backtest pages with report summary, per-market timeline charts, and progressive chunk loading.
- dashboard/logs. Audit/log pages.
- dashboard/exchanges. API key connection pages.
- dashboard/reports. Performance reporting views.
- dashboard home live market bar with SSE client state.

## Frontend Areas (Planned for MVP Completion)
- dashboard richer paper/live runtime controls and state transitions.
- dashboard manual trade ticket UX beyond API-first actions.

## Dashboard IA Order (MVP)
- dashboard. Control Center with risk and operations priority.
- dashboard/strategies.
- dashboard/markets.
- dashboard/bots.
- dashboard/orders.
- dashboard/positions.
- dashboard/backtest.
- dashboard/reports.
- dashboard/logs.
- dashboard/exchanges.
- dashboard/profile.

## UX Expectations Per Frontend Module (MVP)
- dashboard (Control Center). Safety bar, KPI risk row, positions/orders snapshots, bot status, quick actions, and recent audit feed.
- dashboard/strategies. List-first workflow with clear preset/source metadata and safe edit/delete controls.
- dashboard/markets. Universe builder with filter explainability and explicit whitelist/blacklist outcomes.
- dashboard/bots. Lifecycle controls with explicit paper/live mode, heartbeat visibility, and emergency controls.
- dashboard/orders. Searchable and filterable order history with rejection reason visibility.
- dashboard/positions. Open and closed positions with risk parameters and PnL context.
- dashboard/backtest. Run management, daily PnL + balance summary view, market-by-market timeline overlays (candles, indicators, entry/exit), and trade-level result inspection.
- dashboard/reports. Performance summaries focused on PnL, drawdown, fees, and funding costs.
- dashboard/logs. High-signal audit trail with severity, source, and actor filtering.
- dashboard/exchanges. Connection health, permission checks, and secure API key UX.
- dashboard/profile. Account and user preferences, including locale selection.
