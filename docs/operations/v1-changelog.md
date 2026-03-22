# V1 Changelog

## v1.0.0 (Planned)

### MVP Freeze-Gap Closure (2026-03-19)
- Added Binance market-stream ingest worker with normalized ticker/candle payload handling.
- Locked MVP stream transport contract to SSE fan-out semantics.
- Added dashboard live market bar (price, 24h delta, candle freshness, stream health state).
- Added write-side order endpoints (`open`/`cancel`/`close`) with risk acknowledgment guards.
- Wired runtime execution orchestrator (`LONG`/`SHORT`/`EXIT`) for order/position lifecycle.
- Added runtime smoke e2e for stream-normalized signal -> order -> position flow.
- Finalized backtest overlay/report visuals with daily PnL bars + balance line in summary and market-by-market timeline overlays.
- Added backtest timeline API (`/dashboard/backtests/runs/:id/timeline`) for chunked candles/events/indicators loading.
- Improved backtest market overlays with position-range highlighting (profit/loss tint), RSI threshold lines, and synchronized playback cursor across panels.

### Reliability and Operations
- Structured logging across API, workers, and exchange layers.
- Extended metrics and runtime alerts (`/metrics`, `/alerts`).
- Health/readiness endpoints for API and workers.
- Split worker entrypoints for market-data/backtest/execution.

### Security and Risk
- JWT rotation-window hardening.
- API-key lifecycle controls (rotate/revoke) with ownership checks.
- Ownership enforcement audit baseline.
- Risk-first LIVE confirmations in dashboard bot controls.

### Product and UX
- Strategy import/export with format version `strategy.v1`.
- Audit log decision-trace explorer in dashboard.
- Localization QA baseline (EN/PL parity + formatting tests).
- Optional isometric dashboard visual mode.
- Accessibility pass for core dashboard workflows.

### Performance
- Redis-backed market cache fallback strategy.
- Queue tuning profiles with env overrides.
- Pagination and DB index tuning for heavy list/filter endpoints.
- Baseline/stress load runner for API/worker throughput checks.
