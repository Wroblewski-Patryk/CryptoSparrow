# V1 Changelog

## v1.0.0 (Planned)

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
