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

## Manual Verification Standard
- Frontend changes require manual UI verification in addition to automated tests.
- Backend changes require manual API verification in addition to automated tests.
- Delivery summary for each task must include:
  - automated tests run and result,
  - manual checks run (UI/API) and result.

## Planned Tests
- Regression tests for auth flows.
- Contract tests for strategy endpoints.
- Contract tests for markets, bots, and backtests endpoints.
- Deterministic simulator tests for fees, slippage, and funding.
- i18n tests for EN/PL key coverage and fallback behavior.
- Responsive tests for desktop/tablet/mobile core dashboards.
- UX manual checklist for control-center 10-second operator clarity:
  - `docs/control-center-10s-checklist.md`
- Load tests for API and worker monitoring endpoints:
  - baseline: `pnpm --filter server test:load:baseline`
  - stress: `pnpm --filter server test:load:stress`
  - defaults target: `/health`, `/ready`, `/metrics`, `/workers/health`
  - configurable with env: `LOAD_TEST_TARGET_URL`, `LOAD_TEST_DURATION_MS`, `LOAD_TEST_CONCURRENCY`, `LOAD_TEST_PATHS`
