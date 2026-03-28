# Backtest Markets Chart Parity Checklist (Operator)

Status: active parity checklist for `POS-35` (2026-03-29).

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
4. Verify UI legend counters match timeline events for this rendered range.
5. Verify each shaded trade interval is non-overlapping and chronologically ordered.
6. Verify `positionStats` exists in timeline payload:
   - `closedOnFinalCandleCount`,
   - `liquidationsCount`,
   - `tradeCount`.
7. Confirm stats card values stay coherent:
   - `tradeCount >= closedOnFinalCandleCount`,
   - `liquidationsCount <= tradeCount`.

## Pass Criteria
- No mismatch between API event counters and event list.
- No overlapping trade background intervals on chart.
- Position stats present and internally coherent.
- Symbol card parity status remains `PROCESSED` for validated symbol.

