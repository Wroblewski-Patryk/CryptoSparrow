# Venue Context Source-of-Truth Contract

Status: accepted (2026-04-06)

## Purpose
- Guarantee one canonical venue context across creators, runtime, market data, and execution.
- Prevent hidden drift where signals/pricing come from one venue context and orders execute on another.
- Make mismatch behavior deterministic and fail-closed.

## Canonical Context Shape
`VenueContext` is defined as:
- `exchange`: venue identifier (`BINANCE` in current production scope; extensible enum),
- `marketType`: `SPOT | FUTURES`,
- `baseCurrency`: catalog base currency (for example `USDT`).

## Canonical Source-of-Truth Ownership
1. `MarketUniverse` is the only canonical owner of `VenueContext`.
2. `SymbolGroup` inherits context from its parent `MarketUniverse` and cannot override it.
3. `BacktestRun` stores immutable context snapshot from selected universe at run creation.
4. `Bot` context is derived from selected group universe and cannot drift from it.
5. Live execution account binding must be compatible with bot context (`exchange` plus required scope).

## Creator Contract
### Backtest creator
- `Market group` remains the primary selector.
- Creator must display bound `exchange`, `marketType`, and `baseCurrency` as explicit context.
- Optional context filters may narrow visible groups, but filters never become source-of-truth.

### Bot creator
- Same explicit context rendering as backtest creator.
- For `LIVE` mode, creator must surface API key compatibility against derived bot context.
- Context mismatch blocks create/activate (fail-closed, no silent fallback to `BINANCE`).

## Runtime and Execution Contract
1. Runtime signal processing accepts stream events only when `exchange + marketType` matches bot context.
2. Paper pricing path follows the same bot context used by creator and backtest paths.
3. Live execution must resolve account/key using bot context and fail when incompatible.
4. Replayed/retried execution commands must preserve original context (no context mutation on retry).

## API and Validation Contract
- Required mismatch failures:
  - `MARKET_UNIVERSE_CONTEXT_INVALID`
  - `BACKTEST_CONTEXT_MISMATCH`
  - `BOT_MARKET_GROUP_EXCHANGE_MISMATCH`
  - `BOT_LIVE_API_KEY_EXCHANGE_MISMATCH`
  - `BOT_LIVE_API_KEY_SCOPE_MISMATCH`
  - `STREAM_EVENT_CONTEXT_MISMATCH`
- API compatibility window may default missing legacy `exchange` input to `BINANCE`, but never for explicit non-Binance payloads.

## Observability Contract
- Bot runtime and backtest metadata must expose `exchange`, `marketType`, `baseCurrency` for operator diagnostics.
- Mismatch failures must be visible in structured logs and testable with contract-level assertions.

## Non-goals
- No second-exchange adapter delivery in this contract.
- No strategy/risk formula changes.
