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