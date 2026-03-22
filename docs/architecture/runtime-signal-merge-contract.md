# Runtime Signal Merge Contract (V1)

Status: canonical, locked for Phase 12 (`MBA-03`) on 2026-03-23.

## Purpose
Define deterministic action resolution when multiple strategies attached to one bot market-group emit conflicting signals for the same symbol and evaluation window.

## Scope
- Applies to runtime modes: `BACKTEST`, `PAPER`, `LIVE`.
- Resolution unit: `(botId, botMarketGroupId, symbol, intervalWindow)`.
- Strategy output domain: `LONG | SHORT | EXIT | NO_TRADE`.

## Preconditions
- Runtime evaluates only enabled entities:
  - enabled bot
  - enabled bot market-group
  - enabled market-group strategy links
- Signal timestamps are normalized to one interval window.
- All signals in one resolution unit are evaluated in one merge pass.

## Hard Guardrails (executed before merge)
1. Kill switch active -> forced `NO_TRADE`.
2. Symbol is externally/manual managed and not delegated to bot -> forced `NO_TRADE`.
3. No-flip rule:
   - if open `LONG`, ignore all `SHORT` opens until close.
   - if open `SHORT`, ignore all `LONG` opens until close.
4. Global/bot/group risk caps breached -> forced `NO_TRADE` or forced `EXIT` (if required by risk policy).

## Deterministic Merge Order
1. `EXIT` priority:
   - if any enabled strategy emits `EXIT`, choose `EXIT`.
   - tie-break for `EXIT` metadata uses highest `priority`, then lowest `strategyLinkId`.
2. Directional vote:
   - compute weighted score for `LONG` and `SHORT`:
     - `directionScore = sum(link.weight)` over strategies voting this direction.
   - if one direction score is greater and passes `minDirectionalScore`, choose that direction.
3. Tie / weak consensus:
   - if scores are equal or winner is below threshold -> `NO_TRADE`.

## Tie-Break Rules
Order is always deterministic:
1. Higher `priority` wins.
2. If same priority, higher `weight` wins.
3. If still tied, lower lexical `strategyId` wins.
4. If still tied, lower lexical `marketGroupStrategyLinkId` wins.

## Safety Overrides
- `EXIT` can close existing position even when directional vote indicates opposite action.
- `NO_TRADE` is valid and preferred when certainty is insufficient.
- Runtime must never "guess" by random selection.

## Audit Requirements
For each resolution unit store merge trace:
- bot/group/symbol/window identifiers
- participating strategy outputs
- applied guardrails
- directional scores and threshold
- final action and tie-break path

## Backtest/Paper/Live Parity Rule
- Same merge algorithm and tie-break sequence in all three modes.
- Only execution adapter differs (simulation vs real exchange side effects).

## Config Defaults (V1)
- `minDirectionalScore`: `1.0`
- default `weight`: `1.0`
- default `priority`: `100`
- if no explicit config found for a link, runtime applies defaults above.
