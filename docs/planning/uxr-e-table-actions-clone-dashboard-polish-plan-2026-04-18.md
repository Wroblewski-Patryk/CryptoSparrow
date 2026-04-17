# UXR-E Table Actions + Clone + Dashboard Polish Plan (2026-04-18)

Status: queued-after-current-phase  
Execution mode: tiny-commit only (exactly one task per commit)  
Primary audience: implementation agent

## Start Gate
- Do not start this wave before active `L10NQ-D` queue is finished.
- When `L10NQ-D` is closed, execute `UXR-E-01..UXR-E-12` in order.

## Source Request (condensed)
- Add `clone/duplicate` action in list tables (`wallets`, `markets`, `strategies`) and make clones clearly named as cloned.
- Standardize table action buttons so repeated actions share one visual/system contract across modules; still allow dedicated module actions.
- Align action icon/color semantics in:
  - `markets list` (edit style)
  - `strategies list` (edit style)
  - `backtests list` (preview icon/color)
  - `bots list` (edit style + runtime action color)
- Dashboard:
  - move `Manual order` under wallet context and improve UX
  - select symbol from active bot runtime symbols
  - side as switch/pill with icon style
  - show quantity-derived value based on leverage and current symbol price
- Wallet KPI visual cleanup in dashboard sidebar:
  - portfolio in simple row style (without icon card look)
  - free funds / in positions without icons/background
  - optional border tint tied to percent tone
- Header/breadcrumb action button polish:
  - remove forced size (`btn-xs`, `h-*`, `min-h-*`) from page-title action base class
  - increase actions container gap from `gap-1` style usage to `gap-3` in target container
- Footer:
  - remove `(PT)` suffix from Portuguese label in language switcher
  - center mobile footer rows in both dashboard and public shell

## Default Decisions (locked for implementation)
1. Clone naming contract:
   - New name format: `<original name> (clone)`.
   - If collision occurs, append counter: `<original name> (clone 2)`, `<clone 3>`, etc.
2. Clone scope:
   - Clone only user-editable config fields for the same module entity.
   - Never copy runtime/execution history IDs.
3. Action system contract:
   - Shared action presets live in one place (`TableUi`) with semantic tones and canonical icons.
   - Same action type must always use same icon and tone across modules.
   - Dedicated actions (for example `runtime`, `preview`, `details`, `clone`) extend the same base style.
4. Manual order side UX:
   - UI shows direction pill-style switch with icon semantics.
   - Payload contract remains backend-safe (`BUY` / `SELL`) via explicit mapping.
5. Quantity valuation preview:
   - Show read-only estimates: notional (`qty * price`) and margin estimate (`notional / leverage`) when inputs are resolvable.
6. Footer locale label contract:
   - User-facing locale label is `Portuguese`/localized equivalent, without `(PT)` suffix.

## Execution Groups (commit batches)
1. `UXR-E-A (commits UXR-E-01..UXR-E-04): table action system + clone foundation`
2. `UXR-E-B (commits UXR-E-05..UXR-E-08): action rollout + dashboard manual-order/wallet UX`
3. `UXR-E-C (commits UXR-E-09..UXR-E-12): shell polish + regressions + closure`

## Tiny-Commit Queue

### UXR-E-01
`docs(contract): freeze table action semantics + clone naming rules`
- Scope:
  - Document canonical action tone/icon matrix (`edit/delete/clone/preview/runtime/details`).
  - Document clone naming and payload invariants for wallets/markets/strategies.
- Likely files:
  - `docs/planning/open-decisions.md`
  - `docs/modules/web-dashboard-home.md`
- Done when:
  - Implementation has one unambiguous style/behavior contract to follow.

### UXR-E-02
`refactor(web-table-actions-core): introduce system action presets in TableUi`
- Scope:
  - Add reusable action preset API (for example `variant` or helper wrappers) on top of current icon button/link actions.
  - Keep backward compatibility for existing callers during migration.
- Likely files:
  - `apps/web/src/ui/components/TableUi.tsx`
  - `apps/web/src/ui/components/DataTable.tsx` (only if needed for action slot consistency)
- Done when:
  - One shared action style source controls recurring action visuals.

### UXR-E-03
`feat(web-wallets-clone): add duplicate action and create-from-existing flow for wallets list`
- Scope:
  - Add clone button in wallets `Actions`.
  - Build clone payload from existing wallet data and create new wallet with clone naming rule.
  - Show deterministic success/error toasts.
- Likely files:
  - `apps/web/src/features/wallets/components/WalletsListTable.tsx`
  - `apps/web/src/features/wallets/services/wallets.service.ts`
  - `apps/web/src/features/wallets/components/WalletsListTable.test.tsx`
- Done when:
  - User can duplicate wallet row from list and sees cloned wallet with clone-marked name.

### UXR-E-04
`feat(web-markets-clone): add duplicate action and create-from-existing flow for markets list`
- Scope:
  - Add clone button in markets table actions.
  - Duplicate market universe config with clone naming rule.
- Likely files:
  - `apps/web/src/features/markets/components/MarketUniversesTable.tsx`
  - `apps/web/src/features/markets/services/markets.service.ts`
  - `apps/web/src/features/markets/components/MarketUniversesTable.test.tsx`
- Done when:
  - Market universe can be cloned from row action in one click path.

### UXR-E-05
`feat(web-strategies-clone): add duplicate action and create-from-existing flow for strategies list`
- Scope:
  - Add clone button in strategies table actions.
  - Duplicate strategy payload using existing create contract and clone naming.
- Likely files:
  - `apps/web/src/features/strategies/components/StrategiesList.tsx`
  - `apps/web/src/features/strategies/api/strategies.api.ts`
  - `apps/web/src/features/strategies/components/StrategiesList.test.tsx`
- Done when:
  - Strategy duplication works from actions column with clear clone naming.

### UXR-E-06
`refactor(web-table-actions-rollout): align actions icons/tones in markets/strategies/backtests/bots`
- Scope:
  - Markets/strategies: edit tone aligned with system edit style.
  - Backtests: preview icon/color distinct from edit; keep delete danger.
  - Bots: edit style aligned, runtime action uses dedicated stable tone.
- Likely files:
  - `apps/web/src/features/markets/components/MarketUniversesTable.tsx`
  - `apps/web/src/features/strategies/components/StrategiesList.tsx`
  - `apps/web/src/features/backtest/components/BacktestsRunsTable.tsx`
  - `apps/web/src/features/bots/components/BotsListTable.tsx`
- Done when:
  - Same action means same tone+icon; dedicated actions stay visually consistent with system base.

### UXR-E-07
`refactor(web-dashboard-manual-order-layout): move panel under wallet context and improve side/symbol UX`
- Scope:
  - Move manual order block to wallet-adjacent placement in dashboard runtime view.
  - Replace free-text symbol as primary control with select/list from active runtime symbols.
  - Replace side dropdown with icon switch/pill control.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
  - `apps/web/src/features/dashboard-home/components/home-live-widgets/RuntimeSidebarSection.tsx`
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
- Done when:
  - Manual order section is visually attached to wallet area and uses guided symbol/side controls.

### UXR-E-08
`feat(web-dashboard-manual-order-estimates): show qty valuation with leverage and live price context`
- Scope:
  - Add derived informational row(s): price, notional, margin estimate.
  - Keep values read-only and resilient when live price is unavailable.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
- Done when:
  - Operator sees immediate quantity impact before submitting manual order.

### UXR-E-09
`refactor(web-dashboard-wallet-kpi-style): simplify portfolio/free/in-positions cards to clean inline style`
- Scope:
  - Remove wallet icons/background blocks from wallet KPI trio.
  - Render portfolio as simple row style aligned with surrounding wallet summary rows.
  - Apply subtle border tone mapping for free/in-positions percentages.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/home-live-widgets/RuntimeSidebarSection.tsx`
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
- Done when:
  - Wallet KPI block matches requested minimal visual style and remains readable on mobile.

### UXR-E-10
`fix(web-page-title-actions): remove forced tiny-height action class and widen action spacing`
- Scope:
  - Update page title action base class to remove forced small-height constraints.
  - Increase action container spacing to requested `gap-3` in header actions zone.
- Likely files:
  - `apps/web/src/ui/layout/dashboard/PageTitle.tsx`
  - `apps/web/src/ui/layout/dashboard/PageTitle.a11y.test.tsx`
- Done when:
  - Page header actions no longer enforce compact height and spacing is visibly relaxed.

### UXR-E-11
`fix(web-footer-lang-mobile): remove (PT) suffix and center public+dashboard footer rows on mobile`
- Scope:
  - Update locale name labels to remove `(PT)` suffix in all relevant namespaces.
  - Ensure both dashboard and public footer wrappers are centered on mobile.
- Likely files:
  - `apps/web/src/i18n/namespaces/public.en.ts`
  - `apps/web/src/i18n/namespaces/public.pl.ts`
  - `apps/web/src/i18n/namespaces/public.pt.ts`
  - `apps/web/src/i18n/namespaces/dashboard-shell.en.ts`
  - `apps/web/src/i18n/namespaces/dashboard-shell.pl.ts`
  - `apps/web/src/i18n/namespaces/dashboard-shell.pt.ts`
  - `apps/web/src/ui/layout/public/Footer.tsx`
  - `apps/web/src/ui/layout/dashboard/LanguageSwitcher.test.tsx`
  - `apps/web/src/ui/layout/dashboard/Footer.layout.test.tsx`
- Done when:
  - Language switcher shows Portuguese label without suffix and both footers are centered on mobile.

### UXR-E-12
`qa(regression-pack): run focused table/dashboard/shell test pack and publish closure evidence`
- Mandatory checks:
  - wallets/markets/strategies clone actions and action-tone/icon consistency
  - backtests preview action icon/tone
  - bots runtime/edit/delete action visual contract
  - dashboard manual-order symbol+side+valuation UX
  - wallet KPI visual contract
  - page title action sizing/spacing
  - language label + public/dashboard footer mobile alignment
- Suggested commands:
  - `pnpm --filter web test -- src/features/wallets/components/WalletsListTable.test.tsx src/features/markets/components/MarketUniversesTable.test.tsx src/features/strategies/components/StrategiesList.test.tsx src/features/backtest/components/BacktestsRunsTable.test.tsx src/features/bots/components/BotsListTable.test.tsx src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/ui/layout/dashboard/PageTitle.a11y.test.tsx src/ui/layout/dashboard/Footer.layout.test.tsx src/ui/layout/dashboard/LanguageSwitcher.test.tsx`
  - `pnpm --filter web run typecheck`
  - `pnpm --filter web run build`
- Done when:
  - Focused pack is green and closure note is appended to canonical planning logs.

## Request-to-Task Mapping
- Clone action in wallets/markets/strategies: `UXR-E-03`, `UXR-E-04`, `UXR-E-05`
- System action styling + dedicated action consistency: `UXR-E-02`, `UXR-E-06`
- Manual order move + symbol list + side switch + qty valuation: `UXR-E-07`, `UXR-E-08`
- Wallet KPI visual simplification: `UXR-E-09`
- Page title button sizing/gap polish: `UXR-E-10`
- Footer PT label and mobile centering: `UXR-E-11`
- Final safety net: `UXR-E-12`
