# Indicator Expansion Implementation Plan (IND) - 2026-04-07

Status: proposed, ready for tiny-commit execution.
Scope: strategy builder + runtime bot + backtest parity.

## Objective
Deliver a broad, trader-friendly indicator and candle-pattern set that works end-to-end from strategy creator to runtime decisions and backtest timelines, with one shared evaluation contract.

## Why This Plan Is Needed
- Current indicator catalog and runtime/backtest evaluator are not fully aligned.
- Strategy creator exposes entries that are not truly implemented end-to-end.
- Runtime series currently stores close-only candles, which blocks many OHLC/OHLCV indicators and candle patterns.
- We need deterministic parity: same strategy config should produce equivalent decisions in bot runtime and backtest replay.

## Current Repository Fact Check
- Strategy indicator catalog endpoint currently exposes:
  - `EMA`, `RSI`, `BollingerBands`, `BullCandle`
  - source: `apps/api/src/modules/strategies/indicators/indicators.data.ts`
- Shared signal evaluator currently supports:
  - `EMA`, `RSI`, `MOMENTUM`
  - source: `apps/api/src/modules/engine/strategySignalEvaluator.ts`
- Backtest indicator timeline builder currently supports:
  - `EMA`, `RSI`, fallback `MOMENTUM`
  - source: `apps/api/src/modules/backtests/backtests.service.ts`
- Runtime final-candle evaluator currently stores candle series as:
  - `openTime`, `close` only
  - source: `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
- Data sources already available in platform:
  - OHLCV + funding rate + open interest + order book snapshots
  - source: `apps/api/src/modules/market-data/marketData.types.ts`

## Target Indicator Taxonomy (Builder Groups)
Replace current broad groups with explicit trader-facing groups:

1. `Trend`
- EMA, SMA, WMA
- MACD
- ADX (+DI/-DI)

2. `Momentum / Oscillator`
- RSI
- StochRSI
- Stochastic
- ROC
- CCI
- MOMENTUM

3. `Volatility`
- Bollinger Bands
- ATR
- Donchian Channels

4. `Volume`
- OBV
- MFI
- VWAP (session-aware where applicable)

5. `Price Action`
- Breakout helpers (inside/outside range, channel breaks)

6. `Candle Patterns`
- Bullish/Bearish Engulfing
- Hammer / Shooting Star
- Doji
- Morning Star / Evening Star
- Inside Bar / Outside Bar

7. `Derivatives (Futures-only Filters)`
- Funding rate threshold / z-score
- Open interest delta / trend
- Order book imbalance / spread filters

## Data Dependency Classes
1. `Close-only`:
- EMA, SMA, RSI, ROC, MOMENTUM, MACD

2. `OHLC-required`:
- ATR, ADX, Stochastic, CCI, candle patterns, Donchian

3. `OHLCV-required`:
- OBV, MFI, VWAP

4. `Derivatives snapshot required`:
- funding/open-interest/order-book filters

## Core Delivery Rules
1. One indicator registry is canonical for:
- builder metadata,
- runtime evaluation,
- backtest timeline rendering.

2. No placeholder indicators in default creator list:
- if not implemented end-to-end, it is hidden or flagged as unavailable.

3. Runtime/backtest parity is mandatory:
- every new indicator/pattern ships with parity tests.

4. Every task remains tiny:
- one logical change per commit, targeted tests per task.

## Operator Contract Updates
1. Expand rule operators in strategy creator and parser:
- `>`, `>=`, `<`, `<=`, `==`, `!=`
- `CROSS_ABOVE`, `CROSS_BELOW`
- `IN_RANGE`, `OUT_OF_RANGE`

2. Keep deterministic parser normalization for bot and backtest:
- one accepted shape for operands and params.

## Commit Queue (Tiny-Commit Execution)

### Phase A - Contract and Baseline Alignment
- [x] `IND-01 docs(contract): publish canonical indicator registry + parity contract for builder/runtime/backtest`
- [ ] `IND-02 fix(api-indicators): remove/flag unsupported placeholders from default indicator catalog until implemented`
- [ ] `IND-03 refactor(engine-indicators): extract shared indicator compute/evaluate module used by runtime + backtest`
- [ ] `IND-04 test(parity-baseline): lock parity for existing EMA/RSI/MOMENTUM behavior across runtime/backtest`

### Phase B - Runtime Candle Model Upgrade (OHLCV Ready)
- [ ] `IND-05 refactor(runtime-series): upgrade runtime candle buffer from close-only to OHLCV candle objects`
- [ ] `IND-06 refactor(runtime-warmup): fetch/store OHLCV warmup candles and keep final-candle decision indexing deterministic`
- [ ] `IND-07 test(runtime-series): add regression coverage for OHLCV buffer updates, dedupe, and interval matching`

### Phase C - Rule Operator and Config Contract
- [ ] `IND-08 feat(builder-operators): expose full operator set (including cross and range operators) in strategy form`
- [ ] `IND-09 feat(config-parser): normalize operand contract (series/constant/band) for runtime + backtest`
- [ ] `IND-10 test(config-contract): parser/evaluator regressions for new operators and invalid configs`

### Phase D - Core Close-Based Indicator Expansion
- [ ] `IND-11 feat(indicator): add SMA end-to-end (catalog + evaluator + backtest timeline + tests)`
- [ ] `IND-12 feat(indicator): add MACD end-to-end (line/signal/histogram + tests)`
- [ ] `IND-13 feat(indicator): add ROC end-to-end (+ tests)`
- [ ] `IND-14 feat(indicator): add StochRSI end-to-end (+ tests)`

### Phase E - OHLC Indicator Expansion
- [ ] `IND-15 feat(indicator): implement true Bollinger Bands end-to-end (upper/mid/lower, bandwidth, percentB)`
- [ ] `IND-16 feat(indicator): add ATR end-to-end`
- [ ] `IND-17 feat(indicator): add ADX + DI+/DI- end-to-end`
- [ ] `IND-18 feat(indicator): add Stochastic (%K/%D) end-to-end`
- [ ] `IND-19 feat(indicator): add CCI end-to-end`
- [ ] `IND-20 feat(indicator): add Donchian Channels end-to-end`

### Phase F - Candle Pattern Engine
- [ ] `IND-21 feat(pattern-engine): add shared OHLC candle-pattern evaluation engine (boolean series contract)`
- [ ] `IND-22 feat(patterns): add Bullish/Bearish Engulfing end-to-end`
- [ ] `IND-23 feat(patterns): add Hammer/Shooting Star end-to-end`
- [ ] `IND-24 feat(patterns): add Doji with threshold params end-to-end`
- [ ] `IND-25 feat(patterns): add Morning Star / Evening Star end-to-end`
- [ ] `IND-26 feat(patterns): add Inside Bar / Outside Bar end-to-end`
- [ ] `IND-27 test(pattern-parity): deterministic fixtures for all patterns in runtime + backtest parity suite`

### Phase G - Futures Derivatives Filters
- [ ] `IND-28 feat(futures-filter): add funding-rate filters (absolute + z-score) for futures strategies`
- [ ] `IND-29 feat(futures-filter): add open-interest filters (delta/MA/z-score) for futures strategies`
- [ ] `IND-30 feat(futures-filter): add order-book filters (imbalance/spread/depth ratio) for futures strategies`
- [ ] `IND-31 test(futures-filters): add fail-closed fallback tests when derivatives snapshots are missing`

### Phase H - UI Grouping, Presets, and QA Closure
- [ ] `IND-32 feat(web-groups): apply new indicator taxonomy groups in strategy creator with EN/PL labels`
- [ ] `IND-33 feat(backtest-ui): support multi-line overlays and boolean pattern markers in timeline rendering`
- [ ] `IND-34 feat(presets): add trader archetype presets (scalp/day trend/swing/mean reversion/breakout/perp bias)`
- [ ] `IND-35 qa(parity): execute 3-symbol side-by-side parity checklist for new indicator families and attach evidence`
- [ ] `IND-36 docs(runbook): publish implementation runbook for adding next indicator safely (registry + tests + parity steps)`

## Execution Protocol (for `pracuj dalej` / `start` Flow)
1. Always execute exactly one unchecked `IND-*` task as a tiny commit.
2. Run targeted tests for touched area in each task.
3. Update:
- `docs/planning/mvp-next-commits.md` (`NOW/NEXT/DONE`)
- `docs/planning/mvp-execution-plan.md` (checkbox + progress log line)
4. Do not start the next task in the same execution cycle.

## Done Criteria
- Strategy creator only exposes indicators/patterns that are implemented end-to-end.
- Runtime bot and backtest share one indicator evaluation contract.
- Runtime candle model supports OHLCV-based indicators/patterns.
- Candlestick pattern group is fully available in creator and parity-tested.
- Futures-only filters are available with fail-closed behavior.
- New presets cover major trader archetypes without breaking existing contracts.
