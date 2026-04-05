# Dashboard Signal Panel IA Contract

Status: canonical (MVP/V1 runtime UI contract)  
Owner: product + frontend  
Last updated: 2026-04-05

## Purpose

This contract defines how the Dashboard signal panel must be presented so operators can read strategy intent first, then inspect currently open positions.

## Placement Contract

The signal panel is a primary runtime section in `Dashboard` home and **must be rendered above the open-positions block**.

Target order in main runtime column:
1. Signal panel (`what bot wants to do now`)
2. Open positions (`what is active now`)
3. Trade history (`what already happened`)

The panel must not be moved below positions/history in default layout.

## Naming Contract

Legacy label: `Live checks` (deprecated).  
Canonical wording must use strategy-signal semantics:
- PL: `Sygnaly strategii`
- EN: `Strategy signals`

Microcopy should explain that values are derived from latest checked market data against active strategy rules.

## Density & Responsive Contract

Signal cards grid density:
- Mobile: `2` cards per row
- Tablet: `3` cards per row
- Desktop: `4` cards per row

This density applies to default viewport layout before overflow controls/rail paging.

## High-Symbol Behavior Contract

For large symbol sets (including very large groups), panel must remain usable and avoid vertical explosion.

Required behavior:
- Keep card shape/height consistent.
- Provide horizontal navigation (rail/slider) so operators can move through symbol sets without remounting whole section.
- Preserve auto-refresh updates in-place (no flicker remount).
- Retain explicit visibility of neutral symbols, not only symbols with active LONG/SHORT signal.

## Data Display Contract (Card-Level)

Each symbol card must always show:
- Symbol name
- Current direction state (`LONG`, `SHORT`, `NEUTRAL`)
- Evaluated condition lines for long/short context (with live indicator values)

Neutral state is not treated as missing data; neutral cards are first-class runtime output.

## Header Summary Contract

The signal section header must expose compact runtime context before cards:
- section title (`Strategy signals` / `Sygnaly strategii`),
- `Markets` count = all markets currently evaluated by active strategy links,
- `Signals` count = markets with directional signal (`LONG` or `SHORT`, neutral excluded),
- `Base currency` = dominant quote/base currency derived from markets used by selected bot (icon + code, e.g. `USDT`).

For large symbol sets, rail navigation controls (`Prev/Next`) stay on the same header row.

## Card Visual Contract

- Each market card uses theme-gradient border accents (same primary/secondary gradient family as brand header).
- Top row keeps compact direction marker (icon + name), without oversized badge treatment.

## Conditions Block Contract

- Long/short condition blocks are rendered as **two columns** (not stacked rows).
- Long/short labels use compact pill style with icon + text.
- Opacity behavior:
  - `LONG` signal: long column `100%`, short column `50%`.
  - `SHORT` signal: short column `100%`, long column `50%`.
  - `NEUTRAL/EXIT` (no directional signal): both columns `50%`.
  - Hovering an inactive column lifts it to `100%` for quick read.

## Implementation Notes

- Translation keys should be used for panel title/subtitle and static labels.
- Runtime polling/refresh should mutate values in-place in existing components.
- Contract does not change backend decision logic; this is IA + rendering contract only.

## Out of Scope

- Chart embedding in dashboard signal panel.
- Strategy editing or runtime execution changes.
- Bot runtime monitor table redesign (`/dashboard/bots`) outside panel naming/placement parity.
