# Roadmap

## Completed
- Monorepo setup with pnpm.
- Client with Next.js and React.
- Server with Express and Prisma.
- JWT-based authentication.
- Core modules scaffolded: strategies, markets, bots, orders, positions, backtests, logs.
- Live opt-in safety guardrails for bots.
- Server-owned SSE fan-out endpoint for market stream (`/dashboard/market-stream/events`).
- Continuous runtime stream -> signal -> execution loop in worker flow.
- Runtime management of manual Binance Spot/Futures positions with SL/TP/trailing/DCA automation.
- Periodic market/position scan loop with configurable interval and filter controls.
- Runtime replacement gate validated with e2e evidence and release-checklist refresh.

## In Progress
- V1 production exit evidence workpack (SLO window, incident drill evidence, load/perf publication, final launch sign-offs).

## Immediate Evidence Gaps (Pre-Launch)
- Capture backup snapshot + restore validation in target release environment.
- Review queue-lag baseline from production-like telemetry window.
- Confirm incident contacts/escalation chain for release shift.
- Collect formal Engineering/Product/Operations sign-offs with RC owner assignment.
- Publish production observation evidence for open V1 exit workpack items.

Evidence links:
- `docs/operations/v1-release-candidate-checklist.md`
- `docs/operations/v1-rc-external-gates-runbook.md`
- `docs/operations/v1-rc-signoff-record.md`
- `docs/planning/v1-live-release-plan.md`

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

## After MVP
- Admin panel for owner-managed pricing, subscription entitlements, and critical app settings.
- Additional exchange support beyond Binance (adapter-based rollout).
- Expanded billing UX: monthly + annual pricing presentation and fiat/crypto payment methods.
- Strategy export/import with format versioning.
- Hedge mode (long and short on same symbol).
- Advanced risk limits and cooldowns.
- Additional data sources (order book, funding, open interest).
- Native mobile if PWA is insufficient.
- Optional AI advisor module.
