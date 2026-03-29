# Position Lifecycle Parity Remediation Plan (2026-03-29)

Status: planned (post-audit), not yet implemented.

## Goal

Make position lifecycle behavior deterministic and equivalent across:
- `BACKTEST`
- `PAPER`
- `LIVE`

using one lifecycle contract (same decision order, same close reasons, same event stream).

---

## Confirmed Divergence Points (Code Audit)

1. Strategy `EXIT` can still close positions directly in backtest/replay (bypassing lifecycle close order).
- `apps/api/src/modules/backtests/backtests.service.ts:1205`
- `apps/api/src/modules/backtests/backtestReplayCore.ts:673`

2. Runtime signal loop can still emit and execute direct `EXIT` close path.
- `apps/api/src/modules/engine/runtimeSignalLoop.service.ts:483`
- `apps/api/src/modules/engine/runtimeSignalLoop.service.ts:730`

3. Runtime position automation closes with env mode (`RUNTIME_AUTOMATION_MODE`) instead of bot/position mode.
- `apps/api/src/modules/engine/runtimePositionAutomation.service.ts:370`

4. Runtime automation does not pass DCA affordability (`dcaFundsExhausted`) into lifecycle evaluation.
- `apps/api/src/modules/engine/runtimePositionAutomation.service.ts:344`
- `apps/api/src/modules/engine/positionManagement.types.ts:48`

5. Runtime DCA currently mutates DB position values directly, without add-order execution parity.
- `apps/api/src/modules/engine/runtimePositionAutomation.service.ts:357`

6. Runtime automation fetches all open positions by symbol, without management-mode filtering, risking unintended handling of manual positions.
- `apps/api/src/modules/engine/runtimePositionAutomation.service.ts:69`

7. PAPER order sizing reference balance is static (`paperStartBalance`), while backtest uses evolving equity/margin context.
- `apps/api/src/modules/engine/runtimeSignalLoop.service.ts:322`
- `apps/api/src/modules/backtests/backtests.service.ts:922`

8. Two backtest paths remain active (`simulateInterleavedPortfolio` and `simulateTradesForSymbolReplay`) with separate parity surface and maintenance risk.
- `apps/api/src/modules/backtests/backtests.service.ts:863`
- `apps/api/src/modules/backtests/backtestReplayCore.ts:365`

---

## Target Contract (Implementation End-State)

1. Open signals come from strategy evaluation.
2. Open position management is lifecycle-only:
   - `DCA -> (basic: TP->SL | advanced: TTP->TSL) -> liquidation/floor`
3. Strategy `EXIT` does not directly close open positions in parity mode (it can remain trace metadata).
4. DCA affordability is evaluated consistently in all modes before allowing protection closes.
5. DCA side effects are execution effects (paper/live order adapter or deterministic simulation adapter), not state-only mutation.
6. One shared lifecycle event contract drives chart markers and counters.

---

## Tiny-Commit Execution Plan

### POS-36
`fix(contract): remove strategy-exit close bypass from backtest/replay and runtime close flow`
- Remove `shouldSignalExit` close branches from backtest/replay close decision.
- Keep strategy `EXIT` in decision trace only.
- Ensure close reasons come from lifecycle engine (`TP/TTP/SL/TRAILING/LIQUIDATION`).

### POS-37
`fix(runtime): align runtime automation mode/context with bot/position and manual-management guard`
- Pass real bot/position mode to close execution (no env-only mode override).
- Filter automation to `BOT_MANAGED` positions only (unless explicit delegated policy says otherwise).
- Preserve no-flip and one-position-per-symbol invariant.

### POS-38
`feat(runtime-capital): introduce shared capital context for paper/live lifecycle`
- Add runtime capital resolver for:
  - free margin / usable funds,
  - reference equity (dynamic, not static paper start balance),
  - next-DCA affordability.
- Feed `dcaFundsExhausted` into runtime lifecycle input exactly like backtest.

### POS-39
`refactor(runtime-dca): execute DCA through execution adapter parity path`
- Replace direct `updatePositionAfterDca` mutation-only behavior with add-order side effects:
  - paper: simulated order/fill and position averaging
  - live: exchange order adapter path
- Persist trade/order events for DCA actions to keep report parity.

### POS-40
`refactor(backtest): unify on one backtest lifecycle adapter and retire duplicate close semantics`
- Keep one authoritative multi-symbol interleaved engine for run/report/timeline.
- Make replay helper consume same close semantics and event mapping.
- Remove duplicated divergence-prone close gating.

### POS-41
`test(parity): add golden parity fixtures (backtest/paper/live)`
- Fixtures asserting equality for:
  - entry count,
  - dca count,
  - close reason sequence,
  - per-symbol no-overlap intervals,
  - affordability-gated close behavior.

### POS-42
`qa(manual): publish operator verification script for Binance side-by-side`
- 3 symbols, same strategy, same interval.
- Compare expected lifecycle events and close reasons.
- Include failure triage checklist (`config`, `funding`, `mode`, `affordability`).

---

## Acceptance Criteria

- For same input candles/strategy/capital context, lifecycle decisions and reasons match across modes.
- No direct strategy `EXIT` close in parity mode.
- No direct runtime DCA state mutation without execution event.
- Manual unmanaged positions are not modified by automation.
- Backtest chart markers are lifecycle-event driven and consistent with counters.
