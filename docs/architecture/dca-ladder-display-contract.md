# Dashboard/Bots DCA Ladder Display Contract

Date: 2026-04-03  
Task: `BOPS-43 docs(contract)`

## Goal
Define one canonical contract for rendering DCA in:
- Dashboard (`HomeLiveWidgets`)
- Bots runtime (`BotsManagement`)

The UI must show both:
1. **count of executed DCA adds**, and
2. **which configured DCA levels were executed** (e.g. `1: -15%, 2: -30%`).

## Source of Truth
Runtime execution state + strategy DCA configuration used by runtime for the same position lifecycle.

No UI-side inference from prices/candles.

## Strategy Configuration Modes

### Basic mode (`dcaMode = basic`)
- `dcaTimes` defines maximum number of adds.
- first level percent (from primary/basic DCA percent) is repeated for each step.

Display plan levels:
- planned ladder length = `dcaTimes`
- each planned level percent = same basic DCA percent.

### Advanced mode (`dcaMode = advanced`)
- `dcaLevels[]` defines explicit level sequence.
- each level contains at least:
  - `percent`
  - `multiplier` (sizing, not required in compact ladder string)

Display plan levels:
- planned ladder length = `dcaLevels.length`
- planned level percent = `dcaLevels[i].percent`.

## Runtime Payload Contract (for BOPS-44/BOPS-45)
For each open position row returned to Dashboard/Bots tables, API payload must expose:
- `dcaCount` (already present): number of executed DCA adds.
- `dcaPlannedLevels: number[]`:
  - ordered list of configured DCA percents (normalized for basic/advanced).
- `dcaExecutedLevels: number[]`:
  - ordered list of executed DCA percents (length = `dcaCount`, prefix of planned ladder unless legacy/fallback case).

Legacy safety:
- if only `dcaCount` is available, UI falls back to count-only badge and must not invent fake level values.

## UI Rendering Rules
1. DCA cell keeps compact count marker (`dcaCount`).
2. If `dcaExecutedLevels.length > 0`, show compact ladder text:
   - format: `1: -15%, 2: -30%`
   - index is 1-based execution order.
3. If no DCA executed:
   - show neutral state (`0` / `-`) without warning color noise.
4. Same formatting in Dashboard and Bots (no divergence).

## Formatting Contract
- Percent values in ladder should be human-readable compact format:
  - preserve sign,
  - max 2 decimal places,
  - locale-safe rendering through existing formatting helpers.

## Non-Goals
- No change to execution logic/order.
- No multiplier visualization in compact table cell (can be extended later in tooltip/details).
- No chart-layer changes in this task family.

## Regression Expectations (for BOPS-46)
Tests must cover:
1. Basic mode repeated ladder mapping.
2. Advanced mode explicit ladder mapping.
3. Count-only legacy fallback when ladder arrays absent.
4. Consistent rendering in both Dashboard and Bots tables.
