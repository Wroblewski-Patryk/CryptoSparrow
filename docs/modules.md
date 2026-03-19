# Module Map

## Backend Modules (Current)
- auth. Registration, login, JWT handling.
- profile. User profile management and API keys.
- strategies. Strategy CRUD and indicator metadata.
- markets. Market universe CRUD (base, whitelist, blacklist).
- bots. Bot CRUD with LIVE opt-in consent validation.
- orders. Read endpoints for order history and details.
- positions. Read endpoints for position history and details.
- backtests. Backtest run/trade/report read-write basics.
- logs. Audit/event log read endpoints.
- exchange. CCXT connector and retrying live-order adapter services.
- market-data. OHLCV ingest/cache service abstractions.
- upload, middleware, pagination, isolation. Supporting infrastructure.

## Backend Modules (Planned for MVP Completion)
- market-stream. Real-time stream ingestion from exchange WebSockets.
- execution-orchestrator. End-to-end signal -> order -> position lifecycle runtime.
- orders-write. Create/cancel order APIs with risk checks and mode guards.
- positions-live. Live position update loop and reconciliation.
- reports. Finalized performance metrics across backtest/paper/live.

## Frontend Areas (Current)
- public. Landing and public pages.
- public/auth. Login and registration.
- dashboard. Control Center shell with snapshots.
- dashboard/profile. User settings.
- dashboard/strategies. Strategy list and editor.
- dashboard/markets. Market universe management.
- dashboard/bots. Bot management and mode controls.
- dashboard/orders. Read-only order history views.
- dashboard/positions. Read-only position views.
- dashboard/backtest. Backtest pages (MVP in progress).
- dashboard/logs. Audit/log pages.
- dashboard/exchanges. API key connection pages.
- dashboard/reports. Placeholder/partial reporting area.

## Frontend Areas (Planned for MVP Completion)
- dashboard live market bar with streaming ticker/candle status.
- dashboard order-action flows (open/close/cancel with confirmations).
- dashboard richer paper/live runtime controls and state transitions.
- dashboard backtest overlays and full report visualizations.

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
- dashboard/backtest. Run management, chart overlays, and trade-level result inspection.
- dashboard/reports. Performance summaries focused on PnL, drawdown, fees, and funding costs.
- dashboard/logs. High-signal audit trail with severity, source, and actor filtering.
- dashboard/exchanges. Connection health, permission checks, and secure API key UX.
- dashboard/profile. Account and user preferences, including locale selection.
