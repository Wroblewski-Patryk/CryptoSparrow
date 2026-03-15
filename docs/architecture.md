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
