# Indicator 3-Symbol Parity Evidence (2026-04-08)

Status: PASS
Scope: IND-35 parity checklist for newly added indicator families and candle patterns.

## Test Command

```bash
pnpm --filter api test -- src/modules/backtests/backtestParity3Symbols.test.ts
```

## Result Snapshot

- Test file: `apps/api/src/modules/backtests/backtestParity3Symbols.test.ts`
- Outcome: `1 passed`
- Assertions: `21 passed`
- Runtime: `~0.53s`

## Scenario Set (Side-by-Side)

Deterministic 3-symbol fixture set used by the harness:

- `BTCUSDT`
- `ETHUSDT`
- `SOLUSDT`

Each test compares shared strategy evaluator decisions against replay decision trace actions (`ENTRY/EXIT`) for all three symbols.

## Family Checklist

- Baseline: `EMA`, `RSI`, `MOMENTUM`
- Trend and momentum expansion: `SMA`, `MACD`, `ROC`, `STOCHRSI`, `STOCHASTIC`, `ADX`, `CCI`
- Volatility expansion: `BOLLINGER_BANDS`, `ATR`, `DONCHIAN_CHANNELS`
- Derivatives filters: `FUNDING_RATE`, `FUNDING_RATE_ZSCORE`, `OPEN_INTEREST` family, `ORDER_BOOK` family
- Candle patterns: engulfing, hammer/shooting-star, doji, morning/evening-star, inside/outside-bar

## Conclusion

Parity checklist is green for all listed indicator families and pattern groups on deterministic 3-symbol side-by-side scenarios. No mismatch detected in this run.
