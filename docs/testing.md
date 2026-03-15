# Testing Strategy

## Critical Areas
- Authorization and data isolation.
- Strategy validation and error handling.
- Upload safety and file handling.
- API contract stability between client and server.
- Trading engine correctness across backtest, paper, and live paths.

## Tooling
- Vitest for unit and integration tests.
- Supertest for API endpoints.
- Testing Library for UI behavior.

## Planned Tests
- Regression tests for auth flows.
- Contract tests for strategy endpoints.
- Contract tests for markets, bots, and backtests endpoints.
- Deterministic simulator tests for fees, slippage, and funding.
- i18n tests for EN/PL key coverage and fallback behavior.
- Responsive tests for desktop/tablet/mobile core dashboards.
- Performance tests after trading engine rollout.
