# Module Map

Updated: 2026-04-12

## Backend Modules (Current)
- `admin`. Administrative read/write workflows for users and subscription plans.
- `auth`. Registration, login, JWT/session handling, auth cookies and token lifecycle.
- `backtests`. Backtest run/trade/report flows and timeline data contracts.
- `bots`. Bot CRUD, runtime projections, orchestration contracts, live consent and assistant wiring.
- `engine`. Runtime decision and execution core (signal loop, risk checks, automation, lifecycle).
- `exchange`. CCXT connectors, symbol rules, live adapter abstractions, and fee reconciliation.
- `icons`. Coin/icon lookup and serving API for dashboard symbol visuals.
- `isolation`. Multi-tenant access isolation guards and verification tests.
- `logs`. Audit/event log query endpoints and filtering.
- `market-data`. OHLCV and indicator feed adapter layer.
- `market-stream`. WebSocket ingest, fan-out integration, and stream transport contracts.
- `markets`. Market universe CRUD and market-group resolution helpers.
- `orders`. Order query/commands and order-position relation endpoints.
- `pagination`. Shared query parsing/normalization for paged endpoints.
- `positions`. Position read models, reconciliation status, and takeover state exposure.
- `profile`. User profile, security settings, API keys, and subscription profile reads.
- `reports`. Aggregated performance reporting views and report service contracts.
- `strategies`. Strategy CRUD, indicators metadata, and validation/transformation utilities.
- `subscriptions`. Entitlements and payment gateway orchestration foundation.
- `upload`. Upload endpoints and upload validation.
- `users`. User public representation helpers shared across modules.
- `wallets`. Wallet CRUD and related dashboard/accounting data boundaries.

## Backend Notes
- `market-stream` fan-out to clients is server-owned.
- Runtime execution idempotency and lifecycle parity are implemented through `engine` + `bots` + `exchange` boundaries.
- Assistant behavior currently lives under bot/runtime orchestration contracts (not a separate top-level module directory yet).

## Frontend Areas (Current)
- `public` and `public/auth`. Landing and authentication entrypoints.
- `admin`. Admin dashboard views (`users`, `subscriptions`).
- `dashboard`. Control Center shell, route layout, risk and status framing.
- `dashboard-home`. Home live widgets and runtime summary composition.
- `dashboard/exchanges`. Exchange connections plus operational exchange context.
- `dashboard/orders`. Order-oriented UI components/services used in exchange operational views.
- `dashboard/positions`. Position-oriented UI components/services used in exchange operational views.
- `dashboard/profile`. User/security/subscription settings.
- `dashboard/strategies`. Strategy list/create/edit/detail workflows.
- `dashboard/markets`. Market universe list/create/edit flows.
- `dashboard/bots`. Bot list/create/detail/runtime/assistant workflows.
- `dashboard/backtest`. Backtest list/create/details with summary/markets/trades/raw contracts.
- `dashboard/reports`. Performance reporting views.
- `dashboard/logs`. Audit trail views and filtering.
- `dashboard/wallets`. Wallet list/create/detail/edit flows.
- `icons`. Frontend icon lookup hooks/services for asset visualization.

## Frontend Areas (Planned)
- Richer paper/live runtime controls and state transitions.
- Manual trade ticket UX beyond current API-first operational actions.

## Dashboard IA Order (MVP)
- `dashboard` (Control Center with risk and operations priority).
- `dashboard/exchanges`.
- `dashboard/strategies`.
- `dashboard/markets`.
- `dashboard/bots`.
- `dashboard/backtests`.
- `dashboard/wallets`.
- `dashboard/reports`.
- `dashboard/logs`.
- `dashboard/profile`.

## UX Expectations Per Frontend Module (MVP)
- `dashboard`: safety bar, KPI risk row, positions/orders snapshots, bot status, quick actions, recent audit feed.
- `dashboard/strategies`: list-first workflow with clear preset/source metadata and safe edit/delete controls.
- `dashboard/markets`: universe builder with explainable filters and explicit whitelist/blacklist outcomes.
- `dashboard/bots`: lifecycle controls with explicit paper/live mode, heartbeat visibility, and emergency controls.
- `dashboard/exchanges`: connection health, permission checks, secure API key UX, and nested operational order/position views.
- `dashboard/backtests`: run KPI header, stage timeline, summary charts, per-symbol timeline overlays, pair-side stats, and capital-aware trades table.
- `dashboard/wallets`: account balance views with clear create/edit safety and state feedback.
- `dashboard/reports`: performance summaries focused on PnL, drawdown, fees, and funding costs.
- `dashboard/logs`: high-signal audit trail with severity/source/actor filtering.
- `dashboard/profile`: account settings and user preferences including locale.
