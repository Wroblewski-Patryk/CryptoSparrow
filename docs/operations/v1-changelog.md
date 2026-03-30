# V1 Changelog

## v1.0.0 (Planned)

### Backtester UX + Localization Refresh (2026-03-30)
- Improved backtest run header readability:
  - cleaner metadata strip,
  - duplicate/compressed status cleanup,
  - progress bar shown only during active progress (`0 < progress < 100`),
  - lightweight stage timeline presentation.
- Aligned Markets and Trades visibility model:
  - pair stats now reflect visible timeline window vs total values,
  - execution counters (`DCA`, `closed on last candle`, `liquidations`) are exposed in pair stats card for easier parity verification.
- Improved timeline loading flow in backtest details:
  - progressive loading is staged (`events` first, then `candles/indicators`) to reduce visual jitter and improve perceived responsiveness.
- Localized backtest pages/components to EN/PL:
  - backtest create/list/details pages,
  - run header labels, tabs, KPI labels, pair stats labels, trades table headers, and fallback/error texts.

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
