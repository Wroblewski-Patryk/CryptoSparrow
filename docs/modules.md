# Module Map

## Backend Modules (Current)
- auth. Registration, login, JWT handling.
- profile. User profile management.
- strategies. CRUD for strategies and configuration.
- indicators. Indicator metadata endpoints.
- upload. File upload services.
- middleware. Auth and error handling.

## Backend Modules (Planned for MVP)
- markets. Universe selection, symbol groups, whitelists and blacklists.
- bots. Lifecycle of live and paper bots.
- market-data. OHLCV ingestion and caching.
- signals. Signal generation and storage.
- orders. Order placement and simulation.
- positions. Position tracking and risk management.
- backtests. Historical simulation and reports.
- reports. Performance metrics from backtests.
- logs. System and trading audit logs.

## Frontend Areas (Current)
- public. Landing and public pages.
- public/auth. Login and registration.
- dashboard. User panel.
- dashboard/profile. User settings.
- dashboard/strategies. Strategy list and editor.
- dashboard/backtest. Placeholder for future backtesting.

## Frontend Areas (Planned for MVP)
- dashboard/markets. Symbol universe configuration (groups, whitelist, blacklist).
- dashboard/builder. Advanced strategy builder with presets.
- dashboard/bots. Bot management and live status.
- dashboard/positions. Open and closed positions.
- dashboard/orders. Order history and details.
- dashboard/backtest. Full backtest UX and reports.
- dashboard/reports. Performance summaries.
- dashboard/logs. Audit trail and explanations.
- dashboard/exchanges. API key connections and permissions.

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
