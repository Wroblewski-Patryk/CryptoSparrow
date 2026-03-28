# Strategy Evaluation Parity Contract (V1)

Status: canonical, locked for cross-mode parity closure on 2026-03-28.

## Purpose
Define one deterministic strategy-evaluation contract shared by `BACKTEST`, `PAPER`, and `LIVE`.

## Scope
- Evaluation unit: `(symbol, timeframe, closed candle index)`.
- Input source of truth:
  - runtime modes (`PAPER`, `LIVE`): stream-maintained candle series,
  - backtest: historical candle series loaded from exchange/cache.
- Signal domain: `LONG | SHORT | EXIT | NO_TRADE`.

## Canonical Strategy Input
- Strategy evaluation reads the same shape in all modes:
  - `open.direction` (`both|long|short`) or `openConditions.direction`,
  - `open.indicatorsLong|indicatorsShort` or `openConditions.indicatorsLong|indicatorsShort`.
- Supported indicator rule operators:
  - `>`, `>=`, `<`, `<=`, `==`, `!=`.
- Supported indicator families in V1 parity contract:
  - `EMA` (`fast`,`slow`),
  - `RSI` (`period`/`length`),
  - `MOMENTUM` (`period`/`length`).

## Evaluation Rules
1. Parse strategy rules from canonical input.
2. If strategy mode is active and no valid indicator rules are produced:
   - return `NO_TRADE` (do not fallback to heuristic percent-threshold logic).
3. Evaluate long and short rule sets at the same candle index.
4. Resolve raw direction:
   - `LONG` when long set matches and short does not,
   - `SHORT` when short set matches and long does not,
   - `EXIT` when neither side matches,
   - `NO_TRADE` when both sides match or input is insufficient.

## Mode Parity Requirements
- Strategy evaluator implementation must be shared and imported by both:
  - runtime signal loop path,
  - backtest replay path.
- Backtest must not keep mode-specific "shortcut" evaluators when strategy payload is present.
- Differences between modes are allowed only in execution adapters (fills, latency, exchange side effects), never in signal semantics.

## Data and Candle Semantics
- Only closed candles are eligible for deterministic signal evaluation.
- Candle ordering must be ascending by open time.
- Indicator series cache keys must be deterministic (`indicator + params`) and reusable in one evaluation pass.

## Diagnostics and Testing
- Every parity change must include:
  - targeted evaluator tests,
  - backtest replay tests,
  - runtime signal loop tests,
  - parity regression (`paper/live decision equivalence` at minimum).
- Required mismatch diagnostics payload (for reports/logs):
  - `mode`, `symbol`, `timeframe`, `candleIndex`, `strategyId`,
  - expected vs actual direction,
  - rule evaluation summary and mismatch reason.
