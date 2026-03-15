# Product Vision (Technical Spec)

## Mission
Build a safe, transparent, and configurable platform for automated crypto trading.

## Audience
Primary target is advanced users who already understand trading concepts and can configure strategies responsibly.

## Core Principles
- Transparency: actions and decisions are traceable.
- Safety: sensitive data is protected and minimized.
- Control: users decide how automation affects real trades.
- Modularity: strategies are reusable building blocks.

## Current Scope (Implemented)
- User authentication and profile basics.
- Strategy CRUD and indicator metadata.
- Web dashboard structure and auth screens.
- API structure with validation.

## MVP Scope (Target for First Release)
- Strategy builder capable of expressing advanced strategies (indicators, logical conditions, risk rules).
- Strategy presets (trend, mean reversion, breakout).
- Multi-timeframe strategies.
- Multiple entry and exit conditions per strategy.
- Backtester with full trade list and chart overlays for entries and exits.
- Paper trading that mirrors live execution (fees, slippage, order types).
- Live trading on Futures for a connected exchange via API.
- Multi-strategy per account.
- Support for all standard exchange timeframes.
- Local-only bot mode for a single owner (self-hosted execution).
- Order types: market, limit, stop, stop-limit, take-profit, trailing.
- Performance reports from backtest data (profit, loss, drawdown, fees, funding).
- Risk controls: max open positions, TP/SL per strategy, trailing, DCA.
- Responsive UI for desktop, tablet, and mobile.
- Internationalization: EN default + PL in MVP.

## MVP Strategy Schema (Frozen)
- Strategy payload uses sections: `entry`, `exit`, `risk`, `filters`, `timeframes`.
- Schema version is fixed as `1.0` for MVP.
- `entry` and `exit` use top-level `logic` (`AND`/`OR`) with flat `rules` arrays.
- `risk` includes: position sizing, leverage, TP/SL, trailing, DCA, max open positions.
- `filters` includes: symbol mode, whitelist/blacklist, stable-pair exclusion, min 24h volume.
- `timeframes` is an explicit list used by strategy rules.
- Deep nested rule trees are explicitly out of MVP and can be added after MVP.

## MVP Preset Storage (Resolved)
- Presets are code-defined templates managed in repository source.
- MVP keeps presets read-only (no preset create/edit/delete by users).
- API exposes predefined presets for builder selection.
- DB-backed preset storage is deferred until post-MVP sharing/versioning needs.

## Planned Scope (After MVP)
- Spot trading support.
- Strategy export/import as JSON with versioned format.
- Hedge mode (long and short on same symbol).
- Advanced risk limits (max daily loss, drawdown, consecutive losses).
- Cooldown after losses.
- Additional data sources (order book, funding, open interest).
- Advanced time-based conditions.
- Optional AI advisor layer.
- Native mobile app if PWA is insufficient.

## Non-Goals
- Financial advice or guaranteed profit.
- Black-box automation without user control.

## UX Goals (Design Direction)
- Clean, serious UI. Focus on readability and safety.
- Clear separation of backtest, paper, and live modes.
- Every risky action must be explicit and reversible.
