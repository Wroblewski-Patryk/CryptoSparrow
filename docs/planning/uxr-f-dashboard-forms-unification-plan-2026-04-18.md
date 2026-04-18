# UXR-F Dashboard Create/Edit Forms UX/UI Unification Plan (2026-04-18)

Status: queued-after-active-waves  
Execution mode: tiny-commit only (exactly one task per commit)  
Primary audience: implementation agent

## Start Gate
- Do not interrupt active `NOW` queue.
- Keep this wave queued behind currently active/queued waves (`L10NQ-D`, `DBSEL-A`, `UXR-E`).
- Promote `UXR-F-01..` to `NOW` only when earlier queue waves are closed or explicitly reprioritized.

## Goal
- Unify dashboard create/edit form UX/UI with one reusable form system.
- Preserve strengths of `strategies/create` (clear sectioning and flow).
- Remove form-control cross-feature coupling.
- Align i18n, breadcrumb, validation, and submission ergonomics across create/edit pages.

## Scope (target routes)
- `/dashboard/wallets/create` and `/dashboard/wallets/[id]/edit`
- `/dashboard/markets/create` and `/dashboard/markets/[id]/edit`
- `/dashboard/strategies/create` and `/dashboard/strategies/[id]/edit`
- `/dashboard/backtests/create`
- `/dashboard/bots/create` and `/dashboard/bots/[id]/edit`

## Current Baseline Findings (code inventory)
- Form controls are fragmented:
  - dedicated local controls in markets (`FieldControls`)
  - hand-rolled field markup in wallets/bots/backtests
  - strategy uses tabbed custom sections with local locale branching.
- Backtest form currently imports field controls from markets (`cross-feature coupling`).
- Multiple page wrappers still use local in-component locale maps or hardcoded copy instead of namespace keys.
- Form spacing and grid density differs strongly between modules (notably bots/wallets).

## Implementation Contract (locked)
1. Shared form primitives live under `apps/web/src/ui/forms/*` and become the only source for generic form field rendering.
2. Minimum required primitives:
   - `FormPageShell`
   - `FormSectionCard`
   - `FormGrid`
   - `FormField`
   - `TextField`, `NumberField`, `SelectField`, `TextareaField`, `ToggleField`, `RadioGroupField`, `RangeField`, `CompoundField`
   - `FormAlert`, `FormValidationSummary`
3. DaisyUI/Tailwind remain baseline styling system.
4. Route wrappers must use i18n namespace keys (no inline locale dictionaries for page copy).
5. Cross-feature imports of generic controls are forbidden (only `ui/forms` for shared field primitives).
6. Validation UX is standardized:
   - inline field errors
   - top summary block
   - scroll/focus first invalid field on submit.
7. Submission UX is standardized:
   - consistent disabled/loading/submitting behavior
   - no double-submit race.
8. Long forms support improved ergonomics:
   - sections/tabs where appropriate (especially markets)
   - mobile sticky action bar pattern when form length warrants it.

## Execution Groups
1. `UXR-F-A (UXR-F-01..UXR-F-04): shared form foundation + guardrails`
2. `UXR-F-B (UXR-F-05..UXR-F-08): i18n/page-shell alignment + wallets/markets/backtests migration`
3. `UXR-F-C (UXR-F-09..UXR-F-12): strategies/bots migration + mobile ergonomics`
4. `UXR-F-D (UXR-F-13..UXR-F-14): regression pack + closure evidence`

---

## Tiny-Commit Queue

### UXR-F-01
`docs(contract): freeze unified dashboard form UX/UI contract and migration boundaries`
- Scope:
  - Freeze canonical form-system contract in docs and link route scope.
  - Lock "no cross-feature field imports" rule for generic controls.
- Likely files:
  - `docs/planning/open-decisions.md`
  - `docs/planning/mvp-execution-plan.md`
- Done when:
  - Contract is explicit and unambiguous for implementation.

### UXR-F-02
`feat(web-ui-forms-core): add FormPageShell/FormSectionCard/FormGrid/FormField/FormAlert/FormValidationSummary`
- Scope:
  - Introduce base layout and feedback primitives in `ui/forms`.
  - Keep backward compatibility for existing pages during migration.
- Likely files:
  - `apps/web/src/ui/forms/*`
  - `apps/web/src/ui/forms/index.ts`
- Done when:
  - Shared shell/section/grid/summary components are available with tests.

### UXR-F-03
`feat(web-ui-forms-fields): add canonical field primitives (text/number/select/textarea/toggle/radio/range/compound)`
- Scope:
  - Build standardized field components with unified label/hint/error/help slots and size classes.
  - Keep API surface simple and composable.
- Likely files:
  - `apps/web/src/ui/forms/*Field*.tsx`
  - `apps/web/src/ui/forms/index.ts`
- Done when:
  - Required field primitives exist and render consistent styles/states.

### UXR-F-04
`test(web-ui-forms-guardrail): add regression coverage + import-boundary guard for shared form controls`
- Scope:
  - Add unit tests for primitives.
  - Add guardrail test/lint rule to block cross-feature generic field imports.
- Likely files:
  - `apps/web/src/ui/forms/*.test.tsx`
  - `apps/web/src/i18n/guardrails.test.ts` (if extended)
  - eslint/guardrail config files as needed
- Done when:
  - Guardrail fails if modules import generic controls from other feature folders.

### UXR-F-05
`refactor(web-form-page-shell-i18n): unify create/edit page wrappers with FormPageShell + namespace keys`
- Scope:
  - Migrate wrapper-level titles/breadcrumbs/actions for wallets/markets/strategies/backtests/bots.
  - Remove local inline locale maps and hardcoded labels from wrappers.
- Likely files:
  - `apps/web/src/app/dashboard/**/create/page.tsx`
  - `apps/web/src/app/dashboard/**/[id]/edit/page.tsx`
  - `apps/web/src/i18n/namespaces/dashboard-*.{en,pl,pt}.ts`
- Done when:
  - Wrapper copy and breadcrumb/action labels are namespace-driven for all in-scope forms.

### UXR-F-06
`refactor(web-wallet-form): migrate wallet create/edit to ui/forms primitives and standardized validation UX`
- Scope:
  - Replace hand-rolled field wrappers with shared `ui/forms` controls.
  - Add validation summary + first-error focus behavior.
- Likely files:
  - `apps/web/src/features/wallets/components/WalletCreateEditForm.tsx`
  - `apps/web/src/features/wallets/components/WalletCreateEditForm.test.tsx`
- Done when:
  - Wallet form uses shared primitives and preserves business behavior.

### UXR-F-07
`refactor(web-markets-form): migrate markets create/edit to ui/forms and modernized section flow`
- Scope:
  - Replace `FieldControls` usage with `ui/forms`.
  - Keep market-composition behavior unchanged.
  - Improve section ergonomics for long market-selection flow (tabs or section blocks).
- Likely files:
  - `apps/web/src/features/markets/components/MarketUniverseForm.tsx`
  - `apps/web/src/features/markets/components/FieldControls.tsx` (remove/deprecate)
  - `apps/web/src/features/markets/components/MarketUniverseForm.test.tsx`
- Done when:
  - No generic field controls are sourced from feature-local helper controls.

### UXR-F-08
`refactor(web-backtests-form): migrate backtest create form to ui/forms and remove markets-control dependency`
- Scope:
  - Remove backtest dependency on markets field controls.
  - Keep run-name suggestion and seed-config validation behavior intact.
- Likely files:
  - `apps/web/src/features/backtest/components/BacktestCreateForm.tsx`
  - `apps/web/src/features/backtest/components/BacktestCreateForm.test.tsx`
- Done when:
  - Backtest form is fully decoupled from markets component controls.

### UXR-F-09
`refactor(web-strategy-form): align strategy create/edit shell and sections with ui/forms while preserving tab strengths`
- Scope:
  - Keep strategy tabs/section strengths.
  - Replace local locale branching with namespace keys where missing.
  - Move section internals toward shared field primitives where feasible without logic regression.
- Likely files:
  - `apps/web/src/features/strategies/components/StrategyForm.tsx`
  - `apps/web/src/features/strategies/components/StrategyFormSections/*`
  - `apps/web/src/features/strategies/components/*.test.tsx` (if present/added)
- Done when:
  - Strategy form keeps tab clarity but follows unified form styling and i18n contract.

### UXR-F-10
`refactor(web-bot-form): migrate bot create/edit fields to ui/forms and simplify dense grid ergonomics`
- Scope:
  - Keep existing bot domain validations and live/paper constraints.
  - Rework dense layout into clearer two-row/section flow with shared controls.
- Likely files:
  - `apps/web/src/features/bots/components/BotCreateEditForm.tsx`
  - `apps/web/src/features/bots/components/BotCreateEditForm.test.tsx`
- Done when:
  - Bot form is visually and behaviorally aligned with unified form system.

### UXR-F-11
`feat(web-form-ux): standardize submit/loading/disabled states and first-error scroll/focus across all scoped forms`
- Scope:
  - Apply common submit-state contract for all migrated forms.
  - Ensure summary and inline errors are synchronized.
- Likely files:
  - `apps/web/src/ui/forms/*`
  - migrated form files (wallets/markets/strategies/backtests/bots)
- Done when:
  - Submission ergonomics and validation behavior match contract across all scoped forms.

### UXR-F-12
`feat(web-form-mobile): add reusable sticky mobile action bar for long dashboard forms`
- Scope:
  - Introduce reusable sticky action bar pattern in `ui/forms`.
  - Apply to long forms where action controls can leave viewport (markets, wallets, bots as needed).
- Likely files:
  - `apps/web/src/ui/forms/FormPageShell.tsx` (or dedicated `FormActionBar`)
  - scoped page wrappers/forms
- Done when:
  - Mobile save action remains accessible without harming desktop layout.

### UXR-F-13
`test(web-form-regression): run/extend focused form migration tests and i18n parity checks`
- Scope:
  - Update all touched tests for new shared controls and i18n keys.
  - Ensure route wrappers and feature forms remain covered.
- Suggested command pack:
  - `pnpm --filter web test -- src/features/wallets/components/WalletCreateEditForm.test.tsx src/features/markets/components/MarketUniverseForm.test.tsx src/features/backtest/components/BacktestCreateForm.test.tsx src/features/bots/components/BotCreateEditForm.test.tsx src/app/dashboard/wallets/create/page.test.tsx src/app/dashboard/wallets/[id]/edit/page.test.tsx src/app/dashboard/bots/create/page.test.tsx src/app/dashboard/bots/[id]/edit/page.test.tsx src/i18n/translations.test.ts src/i18n/namespaceRegistry.test.ts`
- Done when:
  - Focused suite is green and reflects new contracts.

### UXR-F-14
`qa(web-form-closure): run typecheck/build + smoke evidence and sync queue closure`
- Scope:
  - Run final technical checks.
  - Publish closure note in planning logs and move queue states.
- Suggested command pack:
  - `pnpm --filter web run typecheck`
  - `pnpm --filter web run build`
- Done when:
  - Execution evidence is recorded and queue can be safely advanced.

---

## Stage Definition of Done (DoD)

### Stage A DoD (`UXR-F-A`)
- `ui/forms` base primitives exist and are tested.
- Guardrail prevents new cross-feature generic field imports.
- No runtime behavior change in feature flows yet.

### Stage B DoD (`UXR-F-B`)
- Wrappers for scoped routes use namespace keys and unified shell.
- Wallets/markets/backtests forms use `ui/forms` controls.
- Backtest no longer imports form controls from markets.

### Stage C DoD (`UXR-F-C`)
- Strategies and bots forms aligned visually/structurally to shared system.
- Validation summary + first-error focus and submit-state contract applied across scoped forms.
- Mobile sticky action pattern active for long forms where needed.

### Stage D DoD (`UXR-F-D`)
- Focused tests, typecheck, and build pass.
- Queue/planning logs updated with closure evidence.

## Stage Risks and Rollback Plan

### Stage A Risk / Rollback
- Risk:
  - Over-designed primitives may create migration friction.
- Rollback:
  - Keep primitives additive; do not remove old controls until Stage B migration commits succeed.

### Stage B Risk / Rollback
- Risk:
  - i18n key drift in wrappers or accidental validation regressions while migrating fields.
- Rollback:
  - Revert per-form migration commit independently; wrapper/i18n commit remains isolated.

### Stage C Risk / Rollback
- Risk:
  - Strategy/bot complex forms may regress layout density or toggle behavior.
  - Sticky action bar may overlap content on specific breakpoints.
- Rollback:
  - Revert only the affected form commit (strategies or bots) and keep previous migrated forms intact.
  - Keep sticky bar behind opt-in prop to disable quickly per form.

### Stage D Risk / Rollback
- Risk:
  - Late regression discovered in integrated smoke path.
- Rollback:
  - Use tiny-commit granularity to revert only failing final migration commit(s), not whole wave.

## Request-to-Task Mapping
- Shared `ui/forms/*` system: `UXR-F-02`, `UXR-F-03`, `UXR-F-04`
- Unified wrappers + i18n + breadcrumbs: `UXR-F-05`
- Wallets create/edit: `UXR-F-06`
- Markets create/edit: `UXR-F-07`
- Backtests create: `UXR-F-08`
- Strategies create/edit: `UXR-F-09`
- Bots create/edit: `UXR-F-10`
- Validation summary + first error focus + loading consistency: `UXR-F-11`
- Mobile sticky save/action bar: `UXR-F-12`
- Regression + closure evidence: `UXR-F-13`, `UXR-F-14`
