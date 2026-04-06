# V1B Confidence Pack Evidence (2026-04-06)

Scope: `V1B-04 test(confidence-pack)` from V1 closure queue.

## API Backtest Pack
Command:

```bash
pnpm --filter api test -- src/modules/backtests/backtestReplayCore.test.ts src/modules/backtests/backtestFillModel.test.ts src/modules/backtests/backtestParity3Symbols.test.ts src/modules/backtests/backtests.e2e.test.ts --testTimeout=30000
```

Result:
- PASS (4 files, 34 tests)
- Notes:
  - one transient `404` on report wait was observed in an earlier run; immediate rerun passed without code changes.

## API Runtime/Positions/Live Pack
Command:

```bash
pnpm --filter api test -- src/modules/engine/runtimePositionAutomation.service.test.ts src/modules/engine/runtimeCrashRetry.regression.test.ts src/modules/positions/livePositionReconciliation.service.test.ts src/modules/positions/positions.exchangeSnapshot.e2e.test.ts src/modules/positions/positions-live-status.e2e.test.ts src/modules/orders/orders.service.test.ts src/modules/orders/orders-positions.e2e.test.ts src/modules/exchange/liveOrderAdapter.service.test.ts --testTimeout=30000
```

Result:
- PASS (8 files, 41 tests)

## Web Runtime/Positions Pack
Command:

```bash
pnpm --filter web test -- src/features/positions/components/PositionsBoard.test.tsx src/features/bots/components/BotsManagement.test.tsx src/features/dashboard-home/components/HomeLiveWidgets.test.tsx
```

Result:
- PASS (3 files, 20 tests)

## Operational Note
- E2E suites touching shared DB cleanup should be executed sequentially (not parallelized) to avoid cross-suite interference in CI/local verification.
