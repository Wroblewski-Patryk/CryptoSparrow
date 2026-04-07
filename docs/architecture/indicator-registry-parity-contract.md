# Indicator Registry + Parity Contract (V1)

Status: canonical, locked for Phase 39 `IND-01` on 2026-04-07.

## Purpose
Define one canonical indicator registry and one parity contract for strategy builder, runtime bot evaluation, and backtest timeline/evaluator paths.

## Problem Statement
- Strategy builder can expose indicator names that are not fully implemented end-to-end.
- Runtime and backtest currently have partial indicator overlap.
- Runtime signal loop currently stores close-only candle series, which blocks OHLC/OHLCV-driven indicators and candle patterns.

This contract removes that drift.

## Scope
- Covers strategy indicators and candle-pattern rules used in:
  - strategy creator (`/dashboard/strategies`),
  - runtime signal loop (paper/live),
  - backtest replay and timeline overlays.
- Covers rule evaluation semantics and required data inputs.
- Does not change order execution adapter semantics (fills/slippage/live venue behavior).

## Canonical Source of Truth
1. One canonical indicator registry must drive:
- builder indicator metadata,
- runtime evaluator availability,
- backtest evaluator and timeline overlay availability.

2. No default placeholder indicators:
- if indicator is not implemented end-to-end, it must be hidden or explicitly marked unavailable in UI and must not be treated as active strategy logic.

## Canonical Registry Shape
Each indicator/pattern definition must expose at least:
- `key`: stable identifier (for config and cache keys),
- `name`: display name,
- `group`: taxonomy group,
- `type`: `indicator | pattern | derivatives_filter`,
- `dataRequirement`: `CLOSE | OHLC | OHLCV | DERIVATIVES`,
- `params`: validated parameter schema (`name/default/min/max`),
- `outputs`: output channels (single value, band, tuple, boolean pattern),
- `defaultPanel`: `price | oscillator | hidden_filter`,
- `supportedModes`: `BACKTEST/PAPER/LIVE`,
- `operators`: allowed operator set for the output type.

## Canonical Taxonomy Groups
Builder and API metadata must use explicit groups:
1. `Trend`
2. `Momentum/Oscillator`
3. `Volatility`
4. `Volume`
5. `Price Action`
6. `Candle Patterns`
7. `Derivatives (Futures-only)`

## Indicator Families Covered by This Expansion Track
### Close-based
- EMA, SMA, WMA
- RSI, ROC, MOMENTUM
- MACD, StochRSI

### OHLC-based
- Bollinger Bands (true upper/mid/lower output)
- ATR
- ADX (+DI/-DI)
- Stochastic (%K/%D)
- CCI
- Donchian

### OHLCV-based
- OBV
- MFI
- VWAP

### Candle Patterns
- Bullish/Bearish Engulfing
- Hammer/Shooting Star
- Doji
- Morning Star/Evening Star
- Inside Bar/Outside Bar

### Futures derivatives filters
- Funding rate filters
- Open interest filters
- Order-book imbalance/spread filters

## Runtime/Backtest Parity Rules
1. Shared evaluator semantics:
- identical rule parsing and operator behavior in runtime and backtest.

2. Shared indicator computation contract:
- same parameter normalization,
- same warmup handling,
- same null/insufficient-data behavior.

3. Same evaluation unit:
- `(symbol, interval, closed candle index)`.

4. Same no-data behavior:
- if required input data for a rule is unavailable, rule evaluates deterministically to `false` (fail-closed for that condition), never to optimistic `true`.

5. Same mode boundaries:
- backtest, paper, and live may differ only in market-data source freshness and execution adapters.
- signal direction semantics must remain equal for equivalent candle/input snapshots.

## Candle Data Contract
### Required runtime storage contract (post-upgrade)
Runtime signal series must support OHLCV candle payload:
- `openTime`, `closeTime`,
- `open`, `high`, `low`, `close`, `volume`.

Close-only storage is insufficient for Phase 39 parity goals and is not valid for new OHLC/OHLCV indicators and candle patterns.

## Operator Contract
Supported comparison operators for numeric outputs:
- `>`, `>=`, `<`, `<=`, `==`, `!=`.

Supported event operators where indicator supports directional crossings:
- `CROSS_ABOVE`,
- `CROSS_BELOW`.

Supported band/range operators where indicator outputs band values:
- `IN_RANGE`,
- `OUT_OF_RANGE`.

Unsupported operators must fail validation at strategy-config parse stage.

## Timeline Overlay Contract (Backtest UI)
- Every enabled strategy indicator/pattern included in run context must map to deterministic timeline series metadata:
  - `key`, `name`, `panel`, `points`.
- Multi-output indicators (for example Bollinger, MACD) must expose stable channel keys.
- Candle patterns must expose boolean marker points aligned to candle indices.

## Diagnostics Contract
Parity diagnostics must include:
- `symbol`,
- `trigger` (`STRATEGY | THRESHOLD | FINAL_CANDLE`),
- `mismatchReason` when present,
- indicator/rule summary sufficient to explain why a strategy side matched or failed.

## Safety and Rollout Rules
1. Each new indicator/pattern ships with:
- parser validation tests,
- runtime evaluator tests,
- backtest evaluator tests,
- runtime-vs-backtest parity tests.

2. No mixed rollout:
- indicator cannot be exposed in default builder list before evaluator + parity coverage is green.

3. Futures derivatives filters:
- must be fail-closed when data source is missing/unavailable.

## Non-Goals
- No change to position lifecycle priority contract.
- No change to live fee reconciliation contract.
- No change to order execution idempotency contract.

## Related Contracts
- `docs/architecture/strategy-evaluation-parity-contract.md`
- `docs/architecture/position-lifecycle-parity-matrix.md`
- `docs/architecture/runtime-execution-idempotency-contract.md`
