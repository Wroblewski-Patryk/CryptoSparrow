# Dynamic Stop Display Contract (Dashboard + Bots Runtime)

Status: Canonical (BOPS-47)
Last updated: 2026-04-03
Scope: Runtime monitoring views in `Dashboard` and `Bots` modules.

## Goal

Lock one deterministic contract for displaying dynamic stop values in open-position tables:

- `TTP` (dynamic stop from Trailing Take Profit flow)
- `TSL` (dynamic stop from Trailing Stop Loss flow)

The same payload semantics must be used by:

- API: `GET /dashboard/bots/:botId/runtime-sessions/:sessionId/positions`
- Web: Dashboard home runtime widget and Bots runtime monitor tables

## API Fields

Runtime position payload exposes:

- `dynamicTtpStopLoss: number | null`
- `dynamicTslStopLoss: number | null`

And table-visibility hint:

- `showDynamicStopColumns: boolean`

## Visibility Rules

1. Table headers are `TTP` and `TSL`.
2. Columns are rendered only when `showDynamicStopColumns === true`.
3. Cell fallback for missing value is `"-"`.
4. If strategy close mode is not advanced, both fields are expected to stay `null`.

## TTP Derivation (Canonical)

`dynamicTtpStopLoss` is derived from runtime take-profit trail state:

- source state: `trailingTakeProfitHighPercent`, `trailingTakeProfitStepPercent`, `averageEntryPrice`
- trigger percent: `trailingTakeProfitHighPercent - trailingTakeProfitStepPercent`
- price conversion uses side-aware leveraged move conversion from entry

Equivalent directional conversion:

- LONG: `entry * (1 + triggerPercent / leverage)`
- SHORT: `entry * (1 - triggerPercent / leverage)`

If state is not armed/available -> `null`.

## TSL Derivation (Canonical Target)

`dynamicTslStopLoss` must be derived in this priority order:

1. Primary (target):
   - strategy `close.tsl` percent + runtime `trailingAnchorPrice` (active trailing anchor)
   - side-aware anchor conversion:
     - LONG: `anchor * (1 - tslPercent / leverage)`
     - SHORT: `anchor * (1 + tslPercent / leverage)`
2. Fallback (legacy compatibility):
   - runtime `trailingLossLimitPercent` + `averageEntryPrice` (or entry price)
   - same leveraged move conversion semantics as existing implementation

If neither source is available -> `null`.

## Lifecycle Semantics

- Before trailing arm: `TTP = null`, `TSL = null`
- After TTP arm only: `TTP != null`, `TSL` depends on TSL arm state
- After TSL arm: `TSL != null`

UI should never infer stop values locally; it only renders API payload.

## Non-Goals

- No chart overlays in this contract (table display only)
- No strategy-edit behavior changes
- No exchange-side order-sync changes

## Regression Requirements

Keep regression coverage for:

- pre-arm state (`TTP/TSL -> "-"`)
- armed state (`TTP/TSL -> numeric`)
- fallback path for legacy sessions using `trailingLossLimitPercent`
- header parity (`TTP`, `TSL`) in both Dashboard and Bots views
