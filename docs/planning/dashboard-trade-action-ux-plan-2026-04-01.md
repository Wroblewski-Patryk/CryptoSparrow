# Dashboard Trade Action UX Plan (DBACT) - 2026-04-01

Status: implemented (2026-04-01, write-time + read-time-safe path; pending manual smoke only).

## Objective
Improve Dashboard transaction history so every row clearly explains what happened in bot lifecycle:
- position opened,
- DCA added,
- position closed.

This should be visible in Control Center dashboard (not only in Bots runtime details), with clear UX labels and consistent PL/EN copy.
Additionally, history rows must expose meaningful `Fee` and `Realized PnL` values, and use `Margin` (not `Notional`) as primary capital column to stay coherent with open-positions table.

## Scope
- In scope:
  - classify each trade row into lifecycle action,
  - expose action in dashboard data contract,
  - render action badge/label in dashboard transaction table,
  - keep aggregation coherent with Bots runtime table.
- Out of scope:
  - changing trade execution logic,
  - changing PnL formulas,
  - adding new chart widgets.

## Current Pain (From Operator Feedback)
1. Dashboard "Historia transakcji" shows raw trades, but does not tell whether row is OPEN, DCA, or CLOSE.
2. Operator sees that a position is no longer open, but cannot quickly map which history row closed it.
3. Monitoring detail page has richer context, while dashboard summary looks incomplete/non-deterministic.
4. `Fee` and `Realized PnL` columns are often blank, which makes trade quality impossible to assess quickly.
5. Dashboard history uses `Notional` while open-positions uses `Margin`, creating UX inconsistency in capital interpretation.

## Target UX Contract

### Dashboard history row
Add explicit `Action` column with one of:
- `OPEN` -> "Otwarcie pozycji"
- `DCA` -> "DCA"
- `CLOSE` -> "Zamkniecie pozycji"

Capital column contract:
- replace `Notional` display with `Margin` in dashboard history table,
- keep `Notional` optional in detailed/runtime drill-down only (not in compact control-center history).

Financial row completeness:
- `Fee` should always display numeric value (`$0.00` for explicit zero, never blank placeholder).
- `Realized PnL` should always display numeric value (`$0.00` until close event if model requires).

Optional fallback (internal only, hidden for now):
- `UNKNOWN` if data is incomplete (should be very rare and tracked by log metric).

### Badge style
- `OPEN`: success/info style (same visual language as buy/long success chips).
- `DCA`: warning/accent style (neutral add-to-position action).
- `CLOSE`: primary/outline style with clear "position finished" semantics.

### Data consistency
- Dashboard and Bots-monitor should present the same action for the same trade id.
- Action must be stable over time (write-time or deterministic read-time derivation).

## Canonical Classification Rules
Use deterministic classification based on position state transition around a trade fill.

For a trade linked to a position:
1. If position size before fill was `0` and after fill is `> 0` -> `OPEN`.
2. If position size before fill was `> 0` and after fill increased in same direction -> `DCA`.
3. If position size before fill was `> 0` and after fill is `0` -> `CLOSE`.

If a partial reduction appears in future:
- classify as `CLOSE` for dashboard simplicity in MVP,
- keep room for future enum extension (`REDUCE`) without breaking payload contract.

## Technical Strategy

### Preferred approach (stable)
Persist lifecycle action at trade write time in runtime pipeline:
- derive action when order fill is applied,
- save to trade row metadata/column,
- read path becomes cheap and deterministic.

### Fallback approach (no schema change)
Derive action in monitor read service per ordered trade stream and position transitions.
- less ideal for long-term consistency,
- acceptable only if schema migration is blocked.

Recommendation: choose persisted action now to avoid repeated heavy derivation and to keep dashboard/runtime parity.

## Data/API Contract Changes
- Add trade field: `lifecycleAction` enum (`OPEN | DCA | CLOSE`).
- Extend dashboard monitoring DTO:
  - `actionCode` (enum),
  - `actionLabel` (localized client-side from i18n keys).
- Enforce non-null numeric payload mapping for:
  - `fee`,
  - `realizedPnl`.
- Add/confirm `margin` value in history payload so dashboard can render margin-first view without client-side guesses.
- Ensure aggregate endpoints return this field for both:
  - dashboard control-center history,
  - bots runtime history table.

## UI Changes (Dashboard)
- Table updates in dashboard history widget:
  - add `Action` column after `Side`,
  - replace `Notional` column with `Margin`,
  - render compact badge with icon + localized label,
  - render `Fee` and `Realized PnL` as always-filled currency values (no `-` placeholders),
  - keep column density readable on md/xl breakpoints.
- No additional heavy cards; keep current layout lightweight.

## i18n Contract
Add translation keys in both locales:
- `dashboard.tradeAction.open`
- `dashboard.tradeAction.dca`
- `dashboard.tradeAction.close`

And optional helper keys:
- `dashboard.tradeAction.column`

## Validation and Observability
- Add runtime guard log if action cannot be derived (`UNKNOWN` candidate) with trade/order/position ids.
- Add lightweight counter metric:
  - `runtime_trade_action_unknown_total`.

Expected value after rollout: `0`.

## Tiny-Commit Sequence (Proposed)
- [x] `DBACT-01 docs(contract): lock dashboard trade-action semantics (OPEN/DCA/CLOSE) and parity rules`
- [x] `DBACT-02 feat(db): add trade lifecycleAction enum/column with backward-safe default`
- [x] `DBACT-03 feat(runtime): classify and persist lifecycleAction during fill processing`
- [x] `DBACT-04 feat(api-monitor): expose lifecycleAction in dashboard/bots trade-history payloads`
- [x] `DBACT-05 feat(api-runtime): make fee/realizedPnl non-null in history payload and expose margin value for dashboard history`
- [x] `DBACT-06 feat(web-dashboard): add Action column, switch capital display from Notional to Margin, and render Fee/Realized as numeric values`
- [x] `DBACT-07 feat(web-bots): align bots runtime history action + margin/fee/pnl rendering with dashboard contract`
- [x] `DBACT-08 test(api): add monitor contract tests for OPEN/DCA/CLOSE mapping and non-null fee/realized/margin fields`
- [x] `DBACT-09 test(web): add component tests for action badges, margin column, and non-placeholder financial values`
- [ ] `DBACT-10 qa(smoke): manual verification on real paper-session timeline (open -> dca -> close) including fee/pnl/margin coherence`

## Implementation Notes (2026-04-01)
- API read-model updated in `apps/api/src/modules/bots/bots.service.ts`:
  - added deterministic lifecycle classification (`OPEN/DCA/CLOSE/UNKNOWN`) on trade-history payload,
  - now prefers persisted `lifecycleAction` from DB and falls back to deterministic read-time derivation for backward safety.
- Runtime write paths updated:
  - `apps/api/src/modules/engine/executionOrchestrator.service.ts` persists `OPEN` on entry fill and `CLOSE` on exit fill.
  - `apps/api/src/modules/engine/runtimePositionAutomation.service.ts` persists `DCA` on DCA fill.
- DB schema/migration updated:
  - `TradeLifecycleAction` enum + `Trade.lifecycleAction` column added with default `UNKNOWN`,
  - migration: `apps/api/prisma/migrations/20260401191000_add_trade_lifecycle_action/migration.sql`.
- added `margin` in payload (`notional / leverage` with safe fallback),
- normalized `fee` and `realizedPnl` to non-null numeric values.
- Dashboard history widget updated in `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`:
  - added `Action` badge column,
  - switched capital column from `Notional` to `Margin`,
  - fee/realized always rendered as currency numbers.
- Bots runtime history table updated in `apps/web/src/features/bots/components/BotsManagement.tsx`:
  - aligned columns and badges to dashboard contract (`Action + Margin`),
  - percent helpers now use margin-first denominator.
- Regression tests:
  - web: `HomeLiveWidgets.test.tsx`, `BotsManagement.test.tsx`,
  - api: `bots.e2e.test.ts` (history payload assertions + lifecycle action contract).

## Done Criteria
- Dashboard history row always shows meaningful action (`OPEN/DCA/CLOSE`) for bot-generated trades.
- Action is consistent between dashboard and bots module.
- `Fee` and `Realized PnL` are always shown as numeric currency values (not blank placeholders).
- Dashboard history uses `Margin` as primary capital column, coherent with open-positions table.
- No regressions in existing trade/PnL fields.
- PL/EN translations complete for new labels.
