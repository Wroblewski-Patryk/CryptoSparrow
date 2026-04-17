# Dashboard + Modules UX/Runtime Fix Wave Plan (2026-04-15)

Status: ready-for-implementation
Execution mode: tiny-commit only (exactly one task per commit)
Primary audience: implementation agent

## Source Request (condensed)
- Dashboard wallet KPI row should be cleaner (first 3 values in one line, wallet icon consistency).
- Open exchange positions should appear deterministically in dashboard when bot takeover is enabled.
- Open positions tab needs action-column redesign, close-action bug fix, per-row loading state, and new position-edit modal.
- Open orders should work for LIVE and PAPER consistently (prefer parity, not hiding the tab).
- Dashboard should support manual order placement via the same backend path used by bot execution.
- Tabs should use shorter labels: `positions`, `orders`, `history`.
- Markets edit should compose `min-volume filter` + `whitelist` minus `blacklist`, with aligned UX/API behavior.
- Profile API form needs layout redesign + reliable sync action.
- Wallets list should use table component style like markets/strategies; wallet edit must be blocked when wallet is used by active bot.
- Wallets/Markets/Strategies/Backtests/Bots/Logs lists should support advanced table visibility/details controls similar to dashboard history.
- Logs module should be verified and completed so all bot runtime messages are visible.
- Bots list: remove assistant action for V1 (keep feature in code for V2).
- Bot runtime view needs better tabbed UX; keep auto-refresh, remove manual switch/button; optionally use global refresh setting in profile.
- Bot duplicate guard must include wallet+market+strategy uniqueness.
- `Live opt-in` needs helper text (or removal if obsolete).
- Bot form IA: one form section arranged in two rows; `basic` vs `context` fields clarified; i18n pass required.
- Backtests breadcrumb/header copy polish (`List`, `Create`) and title-link consistency.
- Dashboard footer items centered on mobile.

## Non-Functional Constraints
1. Reuse existing shared UI primitives (`DataTable`, `Tabs`, `PageTitle`, shared modal patterns) instead of duplicating widgets.
2. LIVE/PAPER behavior should be contract-aligned and test-covered.
3. No mixed commits; one task ID per commit.
4. Each task includes explicit regression tests or a documented reason when test automation is not feasible.

## Default Decisions (unless product owner overrides)
1. Position ownership model: keep `EXCHANGE_SYNC` source and use deterministic ownership (`botId`, `walletId`) when takeover is enabled; unresolved positions remain visible but non-actionable.
2. Open orders in PAPER: keep tab visible and adopt unified order lifecycle/read model (`LIVE_EXCHANGE` + `PAPER_SIMULATED`) instead of hiding tab.
3. Manual order placement: use existing order-command backend path with explicit `source = MANUAL_DASHBOARD` metadata for auditing.
4. Runtime refresh controls: remove local switch/button in runtime view, keep auto-refresh by default; add account-level refresh interval setting in profile if low-risk.
5. Assistant action in bots list: hide in V1 UI only (do not delete backend/service code).

## Execution Groups (Commit Batches)
1. `UXR-A` (commits `UXR-01..UXR-05`)
2. `UXR-B` (commits `UXR-06..UXR-15`)
3. `UXR-C` (commits `UXR-16..UXR-22`)
4. `UXR-D` (commits `UXR-23..UXR-30`)

Execution rule:
- run one task = one commit in sequence; do not mix IDs in a single commit.

## Tiny-Commit Queue

### Wave A - Contracts + Critical Runtime/Data Parity

#### UXR-01
`docs(contract): freeze dashboard positions/orders ownership and visibility matrix`
- Scope:
  - Define ownership rules for manual vs bot-managed positions across multiple active bots.
  - Define visibility/actionability states for dashboard tabs (`positions`, `orders`, `history`).
- Likely files:
  - `docs/planning/open-decisions.md`
  - `docs/modules/api-bots.md`
  - `docs/modules/web-dashboard-home.md`
- Done when:
  - Ownership ambiguity rules and fail-closed behavior are documented and linked.

#### UXR-02
`test(api+web): add failing coverage for missing exchange positions and close-position action error`
- Scope:
  - Reproduce current bugs with tests first.
- Likely files:
  - `apps/api/src/modules/positions/positions-live-status.e2e.test.ts`
  - `apps/api/src/modules/orders/orders-positions.e2e.test.ts`
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
- Done when:
  - Tests fail on current behavior and prove the regression.

#### UXR-03
`fix(api-runtime): deterministic exchange-position takeover mapping for dashboard open positions`
- Scope:
  - Ensure positions imported from exchange become visible in dashboard for the owning bot context.
- Likely files:
  - `apps/api/src/modules/positions/livePositionReconciliation.service.ts`
  - `apps/api/src/modules/bots/botsRuntimeRead.service.ts`
  - `apps/api/src/modules/positions/positions.service.ts`
- Done when:
  - Exchange-open SOL position appears in dashboard positions when takeover conditions are met.

#### UXR-04
`feat(api-orders-sync): persist and reconcile LIVE open orders into unified read model/cache`
- Scope:
  - Pull exchange open orders, upsert to DB, expose in runtime/dashboard payload.
- Likely files:
  - `apps/api/src/modules/orders/orders.service.ts`
  - `apps/api/src/modules/positions/livePositionReconciliation.service.ts`
  - `apps/api/src/modules/orders/orders.types.ts`
- Done when:
  - LIVE orders are visible in orders tab without manual workaround.

#### UXR-05
`feat(api-paper-orders): align PAPER order lifecycle with unified orders read model`
- Scope:
  - Persist simulated orders so orders tab behaves consistently in PAPER mode.
- Likely files:
  - `apps/api/src/modules/orders/orders.service.ts`
  - `apps/api/src/modules/bots/runtimeTradeLifecycle.service.ts`
  - `apps/api/src/modules/orders/orders-positions.e2e.test.ts`
- Done when:
  - PAPER bots show coherent open/closed orders in same tab contract as LIVE.

### Wave B - Dashboard Positions/Orders UX

#### UXR-06
`feat(web-dashboard-wallet): redesign wallet KPI row + wallet icon consistency`
- Scope:
  - First 3 wallet values in one cleaner row; use wallet icon semantically.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
  - `apps/web/src/features/dashboard-home/components/home-live-widgets/RuntimeSidebarSection.tsx`
- Done when:
  - Wallet summary is compact, consistent, and readable on desktop/mobile.

#### UXR-07
`feat(web-dashboard-tabs): rename tab labels to positions/orders/history`
- Scope:
  - Replace long labels in dashboard tabs with short labels.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
  - `apps/web/src/i18n/translations.ts`
- Done when:
  - New naming visible in both PL/EN.

#### UXR-08
`fix(web-positions-table): move close column to last, rename to Action, use icon button`
- Scope:
  - Update columns order and action button visuals.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
- Done when:
  - Action column is last and uses icon-only close action.

#### UXR-09
`fix(web-actions): implement per-row pending state for concurrent close actions`
- Scope:
  - Replace single global loader with row-level pending map.
- Likely files:
  - `apps/web/src/features/dashboard-home/hooks/useHomeLiveWidgetsController.ts`
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
- Done when:
  - Each clicked row shows independent loading state.

#### UXR-10
`fix(api-close-position): align close-position button flow with backend close handler`
- Scope:
  - Repair backend/frontend contract causing close action errors.
- Likely files:
  - `apps/api/src/modules/orders/orders.controller.ts`
  - `apps/api/src/modules/orders/orders.service.ts`
  - `apps/web/src/features/dashboard-home/hooks/useHomeLiveWidgetsController.ts`
- Done when:
  - Close button executes successfully for valid open position.

#### UXR-11
`feat(web-position-edit-modal): add reusable modal shell + initial position-edit form`
- Scope:
  - Add edit action in positions table.
  - Initial editable fields: TP, SL, optional notes/flags; include contextual read-only summary (trigger, DCA count, strategy snippets).
- Likely files:
  - `apps/web/src/ui/components/ConfirmModal.tsx` (or new shared modal form wrapper)
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
- Done when:
  - Edit action opens modal with structured form and context block.

#### UXR-12
`feat(api-position-edit): expose safe manual update endpoint for TP/SL and metadata`
- Scope:
  - Backend support for dashboard position edits with validations/audit.
- Likely files:
  - `apps/api/src/modules/positions/positions.controller.ts`
  - `apps/api/src/modules/positions/positions.service.ts`
  - `apps/api/src/modules/positions/positions.types.ts`
- Done when:
  - Modal form can save edits and refresh row state.

#### UXR-13
`feat(web-dashboard-manual-order): add manual order panel using existing bot order pipeline`
- Scope:
  - New dashboard section to place order manually through same backend command path as bot.
- Likely files:
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
  - `apps/web/src/features/dashboard-home/hooks/useHomeLiveWidgetsController.ts`
  - `apps/web/src/features/bots/services/bots.service.ts`
- Done when:
  - User can submit manual order without duplicating execution logic.

### Wave C - Markets/Profile/Wallet UX + Guardrails

#### UXR-14
`feat(web-markets-form): compose symbol universe from (min-volume U whitelist) - blacklist`
- Scope:
  - Clear UX toggles for combined filtering modes.
- Likely files:
  - `apps/web/src/features/markets/components/MarketUniverseForm.tsx`
  - `apps/web/src/features/markets/utils/marketUniverseHelpers.ts`
- Done when:
  - UI clearly indicates composed list behavior.

#### UXR-15
`fix(api-markets): enforce same universe composition contract on backend`
- Scope:
  - Ensure API evaluation matches frontend preview logic.
- Likely files:
  - `apps/api/src/modules/markets/markets.service.ts`
  - `apps/api/src/modules/markets/markets.e2e.test.ts`
- Done when:
  - No frontend/backend drift for combined filter outcomes.

#### UXR-16
`ux(web-profile-api): redesign API key form row layout and helper blocks`
- Scope:
  - Layout requested order:
    1) Key name + Exchange
    2) API key
    3) API secret
    4) Sync
    5) Allow
    6) Requirements + Permissions blocks
  - Keep action buttons in one row.
- Likely files:
  - `apps/web/src/features/profile/components/ApiKeyForm.tsx`
  - `apps/web/src/features/profile/components/ApiKeyForm.test.tsx`
- Done when:
  - Form matches target layout on desktop/mobile.

#### UXR-17
`fix(api-profile-sync): make API sync action deterministic and observable`
- Scope:
  - Stabilize sync endpoint behavior/error messages.
- Likely files:
  - `apps/api/src/modules/profile/apiKey/apiKey.service.ts`
  - `apps/api/src/modules/profile/apiKey/binanceApiKeyProbe.service.ts`
  - `apps/api/src/modules/profile/apiKey/apiKey.e2e.test.ts`
- Done when:
  - Sync works reliably and returns actionable status in UI.

#### UXR-18
`refactor(web-wallets-list): migrate wallets list to shared DataTable pattern`
- Scope:
  - Bring wallets list UX parity with markets/strategies style.
- Likely files:
  - `apps/web/src/features/wallets/components/WalletsListTable.tsx`
  - `apps/web/src/ui/components/DataTable.tsx`
- Done when:
  - Wallets list uses unified table controls and style.

#### UXR-19
`fix(api-wallet-guard): block wallet edits when wallet is used by active bot`
- Scope:
  - Prevent updates when active bot dependency exists (same policy as markets/strategies).
- Likely files:
  - `apps/api/src/modules/wallets/wallets.service.ts`
  - `apps/api/src/modules/wallets/wallets.e2e.test.ts`
- Done when:
  - Edit/save is rejected with clear reason for active dependencies.

### Wave D - Advanced Table Capabilities Across Modules

#### UXR-20
`feat(web-table-core): shared advanced table options (column visibility + expandable details)`
- Scope:
  - Shared behavior reusable by wallets/markets/strategies/backtests/bots/logs.
- Likely files:
  - `apps/web/src/ui/components/DataTable.tsx`
  - `apps/web/src/ui/components/TableUi.tsx`
- Done when:
  - Advanced controls available as opt-in config.

#### UXR-21
`feat(web-tables): apply advanced table mode to wallets/markets/strategies/backtests/bots`
- Scope:
  - Wire table-core into each list module.
- Likely files:
  - `apps/web/src/features/wallets/components/WalletsListTable.tsx`
  - `apps/web/src/features/markets/components/MarketUniversesTable.tsx`
  - `apps/web/src/features/strategies/components/StrategiesList.tsx`
  - `apps/web/src/features/backtest/components/BacktestsList.tsx`
  - `apps/web/src/features/bots/components/BotsListTable.tsx`
- Done when:
  - Each list has optional details/column personalization.

#### UXR-22
`feat(web+api-logs): migrate logs view to unified table UX and verify bot-message completeness`
- Scope:
  - Use shared table component in logs module.
  - Validate logs pipeline captures full bot communication (runtime, execution, sync events).
- Likely files:
  - `apps/web/src/features/logs/components/AuditTrailView.tsx`
  - `apps/api/src/modules/logs/logs.service.ts`
  - `apps/api/src/modules/logs/logs.e2e.test.ts`
- Done when:
  - Logs page is not placeholder-like and includes required bot events.

### Wave E - Bots IA/Runtime UX Cleanup

#### UXR-23
`feat(web-bots-list): hide assistant action in V1 list view`
- Scope:
  - Remove button from list actions without deleting feature internals.
- Likely files:
  - `apps/web/src/features/bots/components/BotsListTable.tsx`
- Done when:
  - Assistant action is not visible on bots list page.

#### UXR-24
`refactor(web-bots-runtime): tabbed runtime layout with dashboard-like readability`
- Scope:
  - Improve runtime navigation and readability using existing tabs/table components.
- Likely files:
  - `apps/web/src/features/bots/components/bots-management/BotsMonitoringTab.tsx`
  - `apps/web/src/features/bots/components/bots-management/BotsManagementTabs.tsx`
- Done when:
  - Runtime view is easier to scan and functionally complete.

#### UXR-25
`fix(web-runtime-refresh): remove local refresh controls and use automatic interval only`
- Scope:
  - Remove runtime switch/button while preserving auto refresh.
  - Optional: account-level refresh interval setting.
- Likely files:
  - `apps/web/src/features/bots/hooks/useBotsMonitoringController.ts`
  - `apps/web/src/features/profile/pages/ProfilePage.tsx` (if setting added)
- Done when:
  - Runtime refresh is automatic and consistent.

#### UXR-26
`fix(api-bots-duplicate-guard): enforce uniqueness by wallet+market+strategy tuple`
- Scope:
  - Extend create/update duplicate guard.
- Likely files:
  - `apps/api/src/modules/bots/botWriteValidation.service.ts`
  - `apps/api/src/modules/bots/bots.duplicate-guard.e2e.test.ts`
- Done when:
  - Duplicate tuple is blocked; allowed combinations still pass.

#### UXR-27
`ux(web-bot-form): simplify IA (one section, two rows), clarify live opt-in, complete i18n`
- Scope:
  - Basic fields: `name`, `active`, `opt-in` (if kept).
  - Context fields: `wallet`, `strategy`, `markets`.
  - Add helper text for `live opt-in` or remove field if contract obsolete.
- Likely files:
  - `apps/web/src/features/bots/components/BotCreateEditForm.tsx`
  - `apps/web/src/i18n/translations.ts`
- Done when:
  - Form structure and wording are clear in PL/EN.

### Wave F - Breadcrumb + Footer Polish

#### UXR-28
`fix(web-backtests-breadcrumb): normalize labels to List/Create and make module header linkable`
- Scope:
  - Backtests list breadcrumb `Backtests list -> List`.
  - Create button label `Create backtest -> Create`.
  - Header link behavior aligned with dashboard module headers.
- Likely files:
  - `apps/web/src/app/dashboard/backtests/list/page.tsx`
  - `apps/web/src/app/dashboard/backtests/create/page.tsx`
  - `apps/web/src/ui/layout/dashboard/PageTitle.tsx`
  - `apps/web/src/i18n/translations.ts`
- Done when:
  - Breadcrumb/header naming and link behavior are consistent.

#### UXR-29
`fix(web-footer-mobile): center both dashboard footer rows on mobile`
- Scope:
  - Adjust mobile alignment for both footer lines.
- Likely files:
  - `apps/web/src/ui/layout/dashboard/*` (footer component location)
- Done when:
  - Footer content is centered on small screens.

### Wave G - Final Hardening

#### UXR-30
`qa(regression-pack): run focused API+WEB tests and manual smoke for live/paper parity`
- Mandatory checks:
  - Dashboard: positions/orders/history tabs.
  - Position close/edit actions.
  - Manual order placement.
  - Markets composed filters.
  - Profile API sync.
  - Wallet edit guard.
  - Bots duplicate guard.
  - Runtime auto-refresh behavior.
  - Logs completeness.

## Suggested Test Commands per wave
- API:
  - `pnpm --filter api run typecheck`
  - `pnpm --filter api test -- src/modules/positions/*.test.ts src/modules/orders/*.test.ts src/modules/bots/*.test.ts src/modules/markets/*.test.ts src/modules/wallets/*.test.ts src/modules/logs/*.test.ts src/modules/profile/apiKey/*.test.ts`
- WEB:
  - `pnpm --filter web run typecheck`
  - `pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/features/bots/components/BotCreateEditForm.test.tsx src/features/profile/components/ApiKeyForm.test.tsx`
  - `pnpm --filter web run build`

## Acceptance Criteria (global)
1. Exchange positions/orders become visible and actionable in dashboard/runtime under deterministic ownership rules.
2. LIVE and PAPER tabs (`positions`, `orders`, `history`) follow one coherent UX and data contract.
3. Close/edit/manual-order actions are backend-supported and test-covered.
4. Markets/Profile/Wallet/Bots UX updates are implemented without backend drift.
5. List modules share modern advanced table behavior and logs module is operationally complete.
6. Backtests breadcrumb/footer polish is complete on desktop and mobile.

## Request-to-Task Mapping
- Dashboard wallet row + icon: `UXR-06`
- Missing open exchange positions: `UXR-02`, `UXR-03`
- Multi-bot ownership design: `UXR-01`, `UXR-03`
- Open positions action column + close errors + per-row loading: `UXR-08`, `UXR-09`, `UXR-10`
- Position edit modal/backend: `UXR-11`, `UXR-12`
- Open orders live/paper parity: `UXR-04`, `UXR-05`, `UXR-07`
- Manual order from dashboard: `UXR-13`
- Markets filter composition + UX/API parity: `UXR-14`, `UXR-15`
- Profile API form + sync: `UXR-16`, `UXR-17`
- Wallets table + edit guard: `UXR-18`, `UXR-19`
- Advanced tables in all listed modules: `UXR-20`, `UXR-21`, `UXR-22`
- Bots list assistant remove: `UXR-23`
- Bots runtime UX + refresh rules: `UXR-24`, `UXR-25`
- Bot uniqueness + live opt-in helper + form IA/i18n: `UXR-26`, `UXR-27`
- Backtests breadcrumb/header polish: `UXR-28`
- Dashboard footer mobile center: `UXR-29`
- Final verification pass: `UXR-30`
