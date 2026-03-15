# Trading Logic

## Current State
The system does not execute trades yet. Strategies are stored and managed, and indicator metadata is exposed via API.

## Strategy Builder Requirements (MVP)
- Rule-based builder (list of conditions).
- Visual editor (drag-and-drop) for composing rules.
- Indicators: must support a wide set of standard indicators.
- Logic: AND/OR groups and comparisons.
- Multi-timeframe: strategy can reference multiple timeframes.
- Multiple entry and exit rules.
- Risk controls: TP, SL, trailing, leverage, position sizing rules.
- Strategy presets (trend, mean reversion, breakout, etc.).
- Export-ready JSON structure (versioning planned after MVP).

## Strategy Builder (Planned)
- Node-based builder (graph style) as an advanced mode.
- Nested condition groups beyond simple AND/OR lists.

## Order Types (MVP)
- Market
- Limit
- Stop
- Stop-limit
- Take-profit
- Trailing

## Position Sizing (MVP)
- Fixed amount.
- Percentage of balance.
- Risk-based sizing (per trade).

## Leverage Strategy (Recommendation)
- Set leverage per strategy (default) for clarity and safety.
- Allow per-position override later if needed.

## Market Universe and Symbols
- Bots operate on a market universe built from a base currency (for example USDT).
- The universe can be filtered by rules (for example volume thresholds).
- Users can create named symbol groups from the filtered universe.
- Users can whitelist or blacklist symbols.
- Market groups can be built from all symbols, explicit whitelist, or filtered rules.
- Stable-to-stable pairs (for example USDT/USDC) should be auto-excluded by default.
- Manual overrides must always be possible for exclusions and inclusions.
- Each bot can trade multiple symbols and multiple strategies mapped to symbol groups.

## Position Rules
- At most one open position per symbol at a time.
- Total concurrent positions are capped by a user-defined max.
- Each position belongs to a specific strategy.

## Risk Management (MVP)
- Max open positions (per user or per bot).
- TP and SL defined by the strategy that opens the position.
- Trailing stop: percentage or fixed levels.
- DCA: add to position on positive or negative conditions.

## Risk Management (Planned)
- Max daily loss, max drawdown, max consecutive losses.
- Cooldown after loss.
- Trailing based on volatility or ATR.

## Data Sources
- MVP: OHLCV only.
- Planned: order book, funding, open interest.

## Target Flow
1. Fetch market data and build OHLCV candles.
2. Compute indicators per strategy interval.
3. Evaluate strategy rules and produce signals.
4. Run pre-trade analysis before opening a position.
5. Execute orders with configured risk parameters.
6. Track and update positions with TP, SL, trailing, and DCA logic.
7. Log all decisions and outcomes for audit.

## Execution Modes
- Backtest. Historical simulation with trade list and chart overlays.
- Paper. Live data and simulated execution with fees and slippage.
- Live. Real exchange execution via API.
- Local-only. Self-hosted execution for a single owner.

## Re-entry Rules
- New positions open only after a fresh signal and analysis pass.

## Backtesting Rules (MVP)
- Must include fees, slippage, and funding.
- Must calculate profit, loss, drawdown, and trade-level PnL.
- Must produce a summary report from the same data that powers live stats.
