# API Deep-Dive: Market-Data Module

## Metadata
- Module name: `market-data`
- Layer: `api`
- Source path: `apps/api/src/modules/market-data`
- Owner: backend/trading-runtime
- Last updated: 2026-04-12
- Related planning task: `DCP-05`

## 1. Purpose and Scope
- Provides normalized market data ingestion and indicator calculation adapters for runtime/backtest use cases.
- Owns short-lived OHLCV caching strategy (memory + optional Redis).
- Exposes optional derivatives snapshots via provider abstractions (order book, funding, open interest).

Out of scope:
- Streaming transport fan-out (market-stream module).
- Exchange execution and order lifecycle.

## 2. Boundaries and Dependencies
- No direct route mount.
- Consumed by engine and backtests for series hydration.
- Depends on:
  - pluggable provider interface (`MarketDataProvider`).
  - Redis client (optional cache layer, graceful fallback).
  - indicator adapter contracts.

## 3. Data and Contract Surface
- Core contracts:
  - `OhlcvRequest`, `OhlcvCandle`.
  - `OrderBookRequest`/`OrderBookSnapshot`.
  - `MarketSnapshotRequest` for funding/open-interest.
- Indicator contracts:
  - `IndicatorRequest` (`SMA`/`EMA`/`RSI`) and pointwise outputs.
- Caching invariants:
  - deterministic cache key by exchange/marketType/symbol/timeframe/limit.
  - TTL- and max-entry-based eviction for in-memory cache.

## 4. Runtime Flows
- Ingest flow:
  1. Validate request payload.
  2. Attempt memory/Redis cache hit.
  3. Fetch fresh series from provider if needed.
  4. Persist to memory and optional Redis.
- Indicator flow:
  - parse indicator request and compute aligned values per candle timestamp.

## 5. API and UI Integration
- No direct API endpoints.
- Indirectly powers:
  - runtime signal evaluation (engine).
  - backtest replay and timeline enrichment.
  - dashboard symbol/risk analytics read models.

## 6. Security and Risk Guardrails
- Provider unavailability errors are explicit (`*_PROVIDER_UNAVAILABLE`).
- Redis/cache failures are non-blocking and degrade gracefully to provider fetch.
- Request schemas enforce supported ranges/types before heavy compute.

## 7. Observability and Operations
- Cache strategy is bounded (TTL + max entries).
- Redis usage is optional and disabled/fallback-safe in test and outage scenarios.

## 8. Test Coverage and Evidence
- Primary tests:
  - `marketData.service.test.ts`
  - `indicatorAdapter.service.test.ts`
- Suggested validation command:
```powershell
pnpm --filter api test -- src/modules/market-data/marketData.service.test.ts src/modules/market-data/indicatorAdapter.service.test.ts
```

## 9. Open Issues and Follow-Ups
- Extend indicator adapter set as strategy catalog evolves.
- Evaluate cache telemetry instrumentation if runtime load increases.
