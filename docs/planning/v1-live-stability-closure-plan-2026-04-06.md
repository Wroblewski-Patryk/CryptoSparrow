# V1 Live Stability Closure Plan (2026-04-06)

Status: active planning baseline for final V1 closure.

## Context
- Post-change validation showed one reproducible backtest replay regression:
  - `apps/api/src/modules/backtests/backtestReplayCore.test.ts`
  - failing scenario: `emits trailing-take-profit event when arm and pullback thresholds are hit`
  - symptom: `eventCounts.TTP = 0` in expected TTP scenario.
- Runtime/live positions confidence pack remains green in focused suites.
- Remaining formal V1 exit gate still requires production evidence/sign-offs.

## Objective
- Finish V1 with production-ready confidence for:
  - backtest parity correctness,
  - bot runtime position handling (paper/live),
  - production exit evidence package and formal sign-off.

## Execution Rules
- Keep tiny-commit mode: one logical step per commit.
- Prioritize `fix/test/chore` before any new feature.
- No scope expansion to V2/agent rollout until this closure plan is complete.

## Tiny-Commit Sequence
- [ ] `V1C-01 fix(api-backtest-core): restore deterministic TTP event emission in replay core and keep advanced close semantics stable`
- [ ] `V1C-02 test(api-backtest): run full backtest parity/replay/e2e confidence pack and capture evidence`
- [ ] `V1C-03 test(api+web-runtime): run runtime positions/live execution confidence pack (API + UI) and capture evidence`
- [ ] `V1C-04 ops(v1-exit-gates): collect production SLO observation artifacts + queue-lag telemetry review + target backup/restore evidence`
- [ ] `V1C-05 release(v1-signoff): refresh RC external-gates status/checklist and finalize formal sign-offs`

## Verification Pack (Target)
- Backtest/API:
  - `backtestReplayCore.test.ts`
  - `backtestFillModel.test.ts`
  - `backtestParity3Symbols.test.ts`
  - `backtests.e2e.test.ts`
- Runtime/positions/API:
  - `runtimePositionAutomation.service.test.ts`
  - `runtimeCrashRetry.regression.test.ts`
  - `livePositionReconciliation.service.test.ts`
  - `positions.exchangeSnapshot.e2e.test.ts`
  - `positions-live-status.e2e.test.ts`
  - `orders.service.test.ts`
  - `orders-positions.e2e.test.ts`
  - `liveOrderAdapter.service.test.ts`
- Runtime/positions/UI:
  - `HomeLiveWidgets.test.tsx`
  - `BotsManagement.test.tsx`
  - `PositionsBoard.test.tsx`

## Done Criteria
- TTP replay regression fixed and covered with deterministic tests.
- Backtest and runtime/positions confidence packs green.
- V1 external gates updated with fresh production evidence.
- Formal release sign-off artifacts updated and complete.
