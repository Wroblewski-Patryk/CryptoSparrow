# V1 Local Cutover Dry-Run Report (2026-03-21)

## Goal
Validate local replacement flow from legacy-style runtime assumptions to current CryptoSparrow runtime using realistic strategy/backtest/live-guardrail scenario coverage.

## Environment
- Infra: Docker `postgres` + `redis` via `pnpm go-live:infra:up`
- Runtime mode: local development verification

## Server Dry-Run Suite
- Command:
  - `pnpm --filter server test -- src/modules/engine/runtime-flow.e2e.test.ts src/modules/backtests/backtests.e2e.test.ts src/modules/engine/preTrade.e2e.test.ts src/modules/bots/bots.e2e.test.ts`
- Result:
  - files: `4`
  - tests: `14`
  - status: `PASS`

## Client Dry-Run Validation
- Command:
  - `pnpm --filter client exec vitest run src/features/bots/components/BotsManagement.test.tsx src/features/logs/components/AuditTrailView.test.tsx`
- Result:
  - files: `2`
  - tests: `7`
  - status: `PASS`

## Scenario Coverage Summary
- strategy and backtest path readiness: covered (`backtests.e2e`)
- bot runtime configuration and ownership controls: covered (`bots.e2e`)
- live guardrails and pre-trade controls: covered (`preTrade.e2e`)
- runtime signal -> order -> position lifecycle with EXIT close path: covered (`runtime-flow.e2e`)
- UI-side bot/log operational views: covered (client suites above)

## Outcome
- Local replacement dry-run passed.
- No blocking regressions detected in selected realistic cutover-critical path suite.
