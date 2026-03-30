# Backtest Markets Chart Parity Checklist (Operator)

Status: active parity checklist (updated 2026-03-30 after Markets UI cleanup/localization pass).

## Goal
Validate that Markets chart visualization reflects backend lifecycle events and does not invent or hide position actions.

## Preconditions
- Backtest run status: `COMPLETED` or `FAILED` with at least one `PROCESSED` symbol.
- Open run details page: `/dashboard/backtests/{runId}`.
- Markets tab visible.

## Steps
1. Pick one symbol with `Parity: PROCESSED`.
2. Fetch timeline API for the same symbol with full chunk (`chunkSize=10000`).
3. Compare `parityDiagnostics.eventCounts` with counts derived from `events[]`:
   - `ENTRY`,
   - `DCA`,
   - close-family sum: `EXIT + TP + TTP + SL + TRAILING + LIQUIDATION`.
4. Verify each shaded trade interval on price panel is non-overlapping and chronologically ordered.
5. Verify `positionStats` exists in timeline payload:
   - `closedOnFinalCandleCount`,
   - `liquidationsCount`,
   - `tradeCount`.
6. Confirm pair stats card values stay coherent:
   - `Trades` visible range / total is consistent with selected timeline window,
   - `DCA` count in `Execution` section matches visible lifecycle markers on chart,
   - `tradeCount >= closedOnFinalCandleCount`,
   - `liquidationsCount <= tradeCount`.
7. Verify chart UX consistency:
   - right-side Y-axis is rendered outside the plotted area (no clipping of candles),
   - bottom X-axis is shared for all chart panels in symbol card,
   - if symbol parity is `FAILED`, card shows inline parity error without unnecessary timeline loading attempts.

## Pass Criteria
- No mismatch between API event counters and timeline event list.
- No overlapping trade background intervals on chart.
- Position stats present and internally coherent.
- Symbol card parity status remains `PROCESSED` for validated symbol.
