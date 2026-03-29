# Binance Side-by-Side Parity Checklist (3 Symbols)

Date: `2026-03-28`
Owner: `QA / Operator`
Scope: verify that `BACKTEST` behavior is consistent with strategy intent and is comparable to Binance chart conditions for the same symbols, interval, and indicators.

Related protocol (close-reason focused): `docs/operations/binance-lifecycle-reason-parity-protocol.md`.

## Goal
- Run one deterministic parity pass for exactly 3 symbols.
- Confirm strategy-trigger context on Binance charts.
- Validate backtest diagnostics (`parityDiagnostics`) are coherent and explainable.

## Preconditions
- App stack running locally (`api`, `web`, db/redis if required).
- Valid Binance market data access.
- Existing strategy with explicit indicator params (example: `EMA(9)`, `EMA(21)`, `RSI(14)`).
- Existing market group containing exactly 3 symbols (for example: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`).

## Test Profile (Freeze Before Run)
- Mode: `BACKTEST`
- Market type: `SPOT` or `FUTURES` (do not mix in one run)
- Symbols: exactly 3
- Strategy interval: one fixed interval only (for example `5m`)
- Date window: one fixed window only
- Fees/slippage/funding setup: fixed for the full run

Record these values before starting. Any change means a new run.

## Step-by-Step Procedure
1. In CryptoSparrow, open strategy and confirm indicators/thresholds are exactly as planned.
2. Open Binance charts for the same 3 symbols.
3. On each Binance chart set the same interval and matching indicators/periods.
4. In CryptoSparrow launch a backtest for the market group and the same strategy.
5. Wait for report completion and open:
   - `Summary`
   - `Markets`
   - `Raw`
6. For each symbol compare:
   - trend and key turning points in the tested range
   - indicator behavior around entry/exit zones
   - whether entries/exits shown by backtest are plausible vs chart context
7. Check report metrics payload:
   - `metrics.parityDiagnostics[]`
   - `metrics.historicalInputs.symbolCoverage[]`
8. For each symbol in `parityDiagnostics` record:
   - `strategyRulesActive`
   - `entryEvents`, `closeEvents`, `liquidationEvents`
   - `mismatchCount`
   - first 3 `mismatchSamples` (`timestamp`, `side`, `trigger`, `mismatchReason`)

## PASS / FAIL Criteria
- PASS:
  - All 3 symbols were processed.
  - `strategyRulesActive=true` for strategy-based run.
  - No unexplained mismatch spikes (`mismatchCount` justified by no-flip/no-position logic).
  - Indicator context on Binance does not contradict backtest actions in obvious way.
- FAIL:
  - Missing symbol in diagnostics or coverage.
  - Inconsistent interval/indicator setup between Binance and app.
  - Repeated unexplained mismatch reasons not aligned with runtime policy.
  - Backtest actions clearly detached from visible indicator context.

## Mismatch Reason Quick Interpretation
- `no_open_position`: exit signal appeared while no open position existed.
- `already_open_same_side`: repeated same-side signal while position already open.
- `no_flip_with_open_position`: opposite-side signal ignored due to no-flip rule.
- `manual_managed_symbol`: symbol locked as manual-managed (not bot-managed).

## Evidence Package (Store per run)
- Backtest run id
- Strategy id
- Market group id
- 3 Binance screenshots (same interval, indicators visible)
- 3 CryptoSparrow market charts from report
- Extracted `parityDiagnostics` JSON fragment
- Final verdict: `PASS` or `FAIL` with short reason
