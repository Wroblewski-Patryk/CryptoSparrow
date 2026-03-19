# Roadmap

## Completed
- Monorepo setup with pnpm.
- Client with Next.js and React.
- Server with Express and Prisma.
- JWT-based authentication.
- Core modules scaffolded: strategies, markets, bots, orders, positions, backtests, logs.
- Live opt-in safety guardrails for bots.

## In Progress
- Hardening validation and error handling.
- Stabilizing dashboard workflows.
- Backtest and execution runtime wiring.

## Immediate Gaps to Close (Before MVP Freeze)
- Implement end-to-end exchange WebSocket market stream ingestion.
- Surface live ticker/candle status in dashboard control center.
- Add write-side order actions (open/cancel/close) with risk-first confirmations.
- Wire exchange adapter into execution orchestration for paper/live paths.
- Finalize backtest reports and overlays.

## MVP Targets
- Strategy builder for advanced strategies.
- Backtester with full trade list and chart overlays.
- Paper trading with live-like execution (fees, slippage).
- Live trading on Futures.
- Multi-strategy per account.
- Support for all standard timeframes.
- Local-only execution mode for a single owner.
- Order types: market, limit, stop, stop-limit, take-profit, trailing.
- Performance reporting from backtest results.
- Responsive UI for desktop/tablet/mobile.
- EN default + PL language support.
- Redis and BullMQ for queues and caching.

## After MVP
- Spot trading support.
- Strategy export/import with format versioning.
- Hedge mode (long and short on same symbol).
- Advanced risk limits and cooldowns.
- Additional data sources (order book, funding, open interest).
- Native mobile if PWA is insufficient.
- Optional AI advisor module.
