# V1 Binance Live + Backtest Alignment Plan (2026-04-06)

Status: active closure plan for V1 trading correctness.

## Goal
- V1 target: user adds Binance API key, bot can safely manage exchange positions according to selected management mode, and backtest behavior stays aligned with runtime decision semantics.

## Fact Check (Current Repository State)
- Confirmed implemented:
  - Binance API key onboarding with `syncExternalPositions` and `manageExternalPositions` flags.
  - Exchange snapshot endpoint and runtime management-mode toggle (`BOT_MANAGED` / `MANUAL_MANAGED`).
  - Live reconciliation loop for `EXCHANGE_SYNC` positions, started in execution worker.
  - Runtime execution path uses live exchange adapter for LIVE orders (outside test env), with fee/fill persistence.
  - Runtime ignores `MANUAL_MANAGED` symbols for bot-driven actions.
- Confirmed gap:
  - deterministic replay regression in `backtestReplayCore`:
    - failing test: trailing-take-profit event (`TTP`) scenario
    - `apps/api/src/modules/backtests/backtestReplayCore.test.ts`
    - current symptom: `eventCounts.TTP = 0` where `>= 1` is expected.

## Risk Summary
- Backtest/runtime parity confidence is currently weakened by the TTP replay regression.
- Live position control appears implemented, but needs one explicit confidence closure pack focused on bot-managed vs manual-managed behavior and lifecycle automation.

## Tiny-Commit Sequence
- [x] `V1B-01 fix(api-backtest-core): restore deterministic TTP event emission in replay core and align TTP field semantics with runtime parser contract`
- [x] `V1B-02 test(api-parity): add explicit regression asserting identical TTP/TSL config interpretation between replay parser and runtime automation parser`
- [x] `V1B-03 test(api-runtime-live): extend runtime/positions e2e coverage for bot-managed lifecycle actions and manual-managed ignore behavior`
- [x] `V1B-04 test(confidence-pack): run full backtest + runtime positions confidence pack (api+web) and capture fresh evidence`
- [ ] `V1B-05 release(v1-exit-gates): refresh RC external-gates/sign-off artifacts and include Binance live-ops verification checklist`

## Confidence Pack (Target)
- API backtest:
  - `src/modules/backtests/backtestReplayCore.test.ts`
  - `src/modules/backtests/backtestFillModel.test.ts`
  - `src/modules/backtests/backtestParity3Symbols.test.ts`
  - `src/modules/backtests/backtests.e2e.test.ts`
- API runtime/positions/live:
  - `src/modules/engine/runtimePositionAutomation.service.test.ts`
  - `src/modules/engine/runtimeCrashRetry.regression.test.ts`
  - `src/modules/positions/livePositionReconciliation.service.test.ts`
  - `src/modules/positions/positions.exchangeSnapshot.e2e.test.ts`
  - `src/modules/positions/positions-live-status.e2e.test.ts`
  - `src/modules/orders/orders.service.test.ts`
  - `src/modules/orders/orders-positions.e2e.test.ts`
  - `src/modules/exchange/liveOrderAdapter.service.test.ts`
- Web runtime/positions:
  - `src/features/positions/components/PositionsBoard.test.tsx`
  - `src/features/bots/components/BotsManagement.test.tsx`
  - `src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`

## Done Criteria
- TTP replay regression is fixed and covered by deterministic tests.
- Backtest parser and runtime parser semantics for TTP/TSL are explicitly locked by regression coverage.
- Runtime/manual-managed/bot-managed position behavior is covered by focused API tests.
- Confidence pack is green.
- RC exit-gates and sign-off artifacts are refreshed with current evidence.
