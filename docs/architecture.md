# Architecture

## Current Architecture
- Monorepo with `apps/server` and `apps/client`.
- Server is an Express API with Prisma + PostgreSQL.
- Client is a Next.js App Router frontend.

## Target Architecture (Incremental)
1. User configures a strategy in the UI.
2. Strategy is stored as JSON + risk parameters.
3. Market data pipeline computes indicators.
4. Signal engine evaluates conditions and emits signals.
5. Execution layer places orders and manages positions.
6. Logs record every decision for audit and debugging.

## Execution Modes
- Backtest. Historical simulation using the same logic as live.
- Paper. Live data, simulated execution with fees and slippage.
- Live. Real execution through exchange API.
- Local-only. Optional self-hosted execution for a single owner.

## Platform Strategy
- Web app is primary (desktop, tablet, mobile responsive).
- PWA is preferred for mobile in MVP.
- Native mobile can be evaluated later if needed.
- MVP target is feature parity across responsive web and PWA views.

## Internationalization (i18n)
- Default language: EN.
- MVP adds PL support.
- More languages after MVP.
- One active locale per session.
- UI texts are translated; user-generated content is not translated.

## Key Boundaries
- Client: UX, configuration, dashboards.
- API: validation, persistence, business rules.
- Engine: trading pipeline, queues, and execution.

## Current Runtime Reality (As of 2026-03-19)
- Dashboard widgets are populated via REST reads (orders/positions snapshots).
- Dashboard includes live market bar UI wired for SSE consumption and stream-health signaling.
- Exchange connector and live-order adapter exist at service level.
- Binance Futures/Spot WebSocket ingest worker exists with normalized events.
- Full server-owned SSE fan-out and stream-to-signal runtime automation are still staged.

## Market Data Transport Strategy
- MVP target: exchange prices and live candles via WebSocket streams.
- REST should be fallback and historical fetch path, not primary live ticker source.
- Client should consume server-owned stream fan-out (SSE or WebSocket gateway), not direct exchange sockets from browser.

## Scalability Approach
- Modular monolith: clear module boundaries inside one codebase.
- Multi-tenant from day one (many users on one cluster).
- Background workers separated from API when load grows.

## Recommended Process Separation (When Needed)
- API server.
- Market data workers.
- Backtest workers.
- Order execution workers.

## Planned Scaling
- Queue-based workers for market processing and position checks.
- Stateless API servers with shared database and cache.
- Rate limiting per user and per exchange API key.

## Data Retention and Caching
- OHLCV stored in full resolution for 90 days.
- Longer-term aggregates stored at 1D resolution for at least 1 year.
- Redis used for caching and queues in MVP.

## Process Model (MVP)
- Start as a single service.
- Add separate worker processes for market data and backtests when load increases.

## Runtime and Availability
- Backend is expected to run 24/7 for paper/live bot execution.
- Deployments should minimize downtime and preserve running bot state.
