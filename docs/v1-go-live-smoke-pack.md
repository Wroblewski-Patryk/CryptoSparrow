# V1 Go-Live Smoke Pack (Live-Safe)

## Purpose
Run a focused pre-release smoke suite for the most critical V1 paths.

## Prerequisites
- Docker services running (`postgres`, `redis`).
- Project dependencies installed (`pnpm install`).
- Server/client env files configured.

## Commands
- Full smoke pack:
  - `pnpm test:go-live:smoke`
- Server smoke only:
  - `pnpm test:go-live:server`
- Client smoke only:
  - `pnpm test:go-live:client`

## Included Coverage

### Server (`test:go-live:server`)
- `auth.e2e.test.ts` (core auth/session flow)
- `strategies.e2e.test.ts` (strategy CRUD + import/export contract)
- `backtests.e2e.test.ts` (backtest run/report critical path)
- `preTrade.e2e.test.ts` (paper/live guardrails and risk gate)

### Client (`test:go-live:client`)
- Bots management LIVE confirmation behavior
- Logs decision-trace explorer behavior
- Dashboard header navigation accessibility smoke

## Release Gate Rule
- RC cannot be promoted if this smoke pack is red.
- P0/P1 defects found during this pack must be resolved and retested.
