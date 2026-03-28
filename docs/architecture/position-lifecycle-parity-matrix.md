# Position Lifecycle Parity Matrix (Legacy CryptoBot -> CryptoSparrow)

Status: canonical parity-audit matrix for `POS-31`, locked on 2026-03-28.

## Purpose
Define one explicit source of truth for position lifecycle semantics that must be identical across:
- `BACKTEST`,
- `PAPER`,
- `LIVE`.

This matrix maps legacy behavior from:
- `server/modules/positions/positions.service.js`
- `server/modules/positions/dca.service.js`
- `server/modules/positions/tp.service.js`
- `server/modules/positions/ttp.service.js`
- `server/modules/positions/sl.service.js`
- `server/modules/positions/tsl.service.js`

## Global Invariants
- Per symbol, only one active position direction is allowed at a time (`LONG` or `SHORT`), no flip while open.
- Position lifecycle checks are evaluated in strict order on each position-management cycle.
- State buckets (`DCA`, `TTP`, `TSL`) are symbol-scoped and must be reset on open/close as defined below.
- Profit trigger source is percent PnL over position margin (`profitPercent = profit / margin * 100`).

## Canonical Evaluation Order (Per Position, Per Cycle)
1. `DCA`
2. `TP`
3. `TTP`
4. `SL`
5. `TSL`

Order is hard contract. Later checks must see state mutated by earlier checks from the same cycle.

## Trigger Matrix

| Step | Activation Gate | Trigger Condition | Side Effect | Reset Rules |
|---|---|---|---|---|
| `DCA` | `dca.enabled=true`; `dcaCount < dca.times` | `profitPercent < dca.percents[dcaCount]` | Add order in position direction; increment `dcaCount` by 1 when order succeeds | `clearDCA(symbol)` on open/close |
| `TP` | `tp.enabled=true` | `profitPercent >= tp.percent` | Close position immediately (`TP_CLOSE`) | On close: clear DCA/TTP/TSL |
| `TTP` | `ttp.enabled=true` | Dynamic start/step selected from `starts[]/steps[]`; activate when `profitPercent >= selectedStart`; close when retrace `profitPercent <= highProfit - step` | Track `highProfit` and adaptive step; close on retrace (`TTP_CLOSE`) | Clear tracker when profit drops below activation window or on close |
| `SL` | `sl.enabled=true` AND `dcaCount == dca.times` | Long: `lastPrice <= entry*(1-sl%)`; Short: `lastPrice >= entry*(1+sl%)` | Close position (`SL_CLOSE`) | On close: clear DCA/TTP/TSL |
| `TSL` | `tsl.enabled=true` AND `dcaCount == dca.times` | Activate when `profitPercent <= tsl.start`; trail `maxLoss`; close when `profitPercent < maxLoss` | Move dynamic loss floor with rebound; close on fallback (`TSL_CLOSE`) | Clear on close; clear if preempted by active TTP |

## Legacy Semantics Notes (Exact Behavior to Preserve)
- `DCA` uses indexed thresholds (`dca.percents[dcaCount]`) and multiplier sizing.
- `DCA` fails fast on insufficient wallet funds; no counter increment when order fails.
- `TP` is absolute percent take-profit; when hit it closes without waiting for TTP/SL/TSL.
- `TTP` is dynamic:
  - start and step are selected by current profit regime from arrays,
  - high watermark updates as profit grows,
  - close happens on retrace from high watermark by active step.
- `SL` is intentionally deferred until max DCA usage is reached (`dcaCount == maxDca`).
- `TSL` is also deferred until max DCA usage is reached.
- `TSL` and `TTP` interaction:
  - if `TTP` is active for symbol, legacy flow clears `TSL` tracker to avoid dual trailing conflict.

## Open/Close State Contract
- On position open:
  - `clearDCA(symbol)`
  - `clearTSL(symbol)`
  - `clearTTP(symbol)`
- On position close (any reason):
  - `clearDCA(symbol)`
  - `clearTSL(symbol)`
  - `clearTTP(symbol)`

## Runtime/Backtest Contract Implications
- `BACKTEST`, `PAPER`, and `LIVE` must execute one shared lifecycle engine with this exact order and trigger semantics.
- Reporting/chart layers must render events emitted by this engine (no alternate UI-only lifecycle synthesis).
- Event counts shown in UI must be derived from lifecycle events, not inferred from candles.

## Verification Checklist for Next Tasks
- `POS-32`: one-position-per-symbol + no-overlap render contract.
- `POS-33`: DCA/TTP/TSL exact sequencing parity (basic/advanced mode gates).
- `POS-34`: shared lifecycle engine for all modes.
- `POS-35`: deterministic parity fixtures and chart-event assertions.
