# Roadmap

## Completed
- Monorepo setup with pnpm.
- Client with Next.js and React.
- Server with Express and Prisma.
- JWT-based authentication.
- Core modules scaffolded: strategies, markets, bots, orders, positions, backtests, logs.
- Live opt-in safety guardrails for bots.

## In Progress
- V1 runtime replacement objective: make new app stable for 24/7 server usage as successor to legacy local-only bot flow.
- Hardening validation and error handling.
- Stabilizing dashboard workflows.
- Backtest and execution runtime wiring.

## Immediate Gaps to Close (Before MVP Freeze)
- Wire server-owned SSE fan-out endpoint from market-stream worker to dashboard clients.
- Complete continuous stream -> signal evaluation loop in runtime worker flow.
- Re-run release checklist after freeze-gap closure and capture final evidence.
- Reach legacy-replacement minimum gate:
  - stable strategy configurator with JSON settings.
  - backtester usable for go/no-go validation.
  - runtime management of manually opened Binance Futures and Binance Spot positions.
  - DCA/SL/TP/TSL lifecycle automation until close.
  - periodic market/position scans with configurable interval and market filters.

## MVP Targets
- Strategy builder for advanced strategies.
- Backtester with full trade list and chart overlays.
- Paper trading with live-like execution (fees, slippage).
- Live trading on Binance Spot and Binance Futures.
- Multi-strategy per account.
- Support for all standard timeframes.
- Multi-user execution model with user-isolated bot operation.
- Order types: market, limit, stop, stop-limit, take-profit, trailing.
- Performance reporting from backtest results.
- Responsive UI for desktop/tablet/mobile.
- EN default + PL language support.
- Redis and BullMQ for queues and caching.
- Admin panel for owner-managed pricing, subscription entitlements, and critical app settings.

## After MVP
- Additional exchange support beyond Binance (adapter-based rollout).
- Expanded billing UX: monthly + annual pricing presentation and fiat/crypto payment methods.
- Strategy export/import with format versioning.
- Hedge mode (long and short on same symbol).
- Advanced risk limits and cooldowns.
- Additional data sources (order book, funding, open interest).
- Native mobile if PWA is insufficient.
- Optional AI advisor module.
