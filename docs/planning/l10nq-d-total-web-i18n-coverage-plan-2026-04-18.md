# L10NQ-D Total Web i18n Coverage Plan (2026-04-18)

## Objective
Close all remaining i18n contract gaps in web/gui so adding a new locale is deterministic and does not require manual string hunting.

## Scope Inputs
- `docs/operations/_artifacts-l10nq-d-coverage-audit-2026-04-18.json`
- `docs/operations/l10nq-d-coverage-audit-2026-04-18.md`
- `docs/operations/l10nq-d-route-coverage-matrix-2026-04-18.md`

## Delivery Contract
- No route-reachable UI file may contain local per-file `copy` dictionaries.
- No route-reachable UI file may fallback locale to `pl`.
- All user-visible strings (including aria/title/placeholder and toast copy) must use translation keys.
- Enum/system tokens may exist in code, but user-facing labels must map through i18n keys.
- Shared UI primitives must not embed hardcoded English/Polish labels.

## Single i18n Standard (Repository-Wide)
- Locale source of truth: `I18nProvider` + `DEFAULT_LOCALE` only.
- Translation source of truth: namespace files in `apps/web/src/i18n/namespaces/*`.
- Allowed string literals in UI files:
  - CSS classes, route paths, IDs, test IDs, icon names, machine enum values not directly shown to users.
- Disallowed string literals in UI files:
  - JSX copy, modal labels, tab labels, card titles, form labels/help text, placeholders, aria labels, toast messages.
- Required migration target pattern:
  - `const { t } = useI18n();`
  - `label={t("namespace.key")}`
  - `toast.error(t("namespace.key"), { description: ... })`

## Execution Wave (Tiny-Commit Sequence)

### L10NQ-D-01 docs(audit-freeze)
- Freeze actionable inventory and route coverage evidence in planning docs.
- Acceptance:
  - Artifacts linked from canonical planning.
  - Explicit scope split: module findings vs shared foundation findings.

### L10NQ-D-02 chore(tooling-i18n-audit)
- Add deterministic audit script (`pnpm` runnable) that scans route-reachable files and emits JSON summary.
- Acceptance:
  - Command exits non-zero on parser failure.
  - Output file contract documented and stable.

### L10NQ-D-03 test(guardrail-hard-fail)
- Extend guardrails to fail on:
  - route-reachable local `copy` objects,
  - route-reachable locale fallback `?? 'pl'`,
  - hardcoded UI text in monitored contexts.
- Acceptance:
  - Guardrail catches at least one seeded fixture regression.

### L10NQ-D-04 refactor(auth-localization)
- Migrate auth flow from local `copy` objects to `auth` namespace:
  - `features/auth/components/LoginForm.tsx`
  - `features/auth/components/RegisterForm.tsx`
  - `features/auth/hooks/useLoginForm.ts`
  - `features/auth/hooks/useRegisterForm.ts`
  - `features/auth/pages/LoginPage.tsx`
  - `features/auth/pages/RegisterPage.tsx`
- Remove `?? 'pl'` fallbacks in auth.
- Acceptance:
  - No local `copy` in auth flow.
  - Auth tests pass in en/pl/pt context.

### L10NQ-D-05 refactor(admin-localization)
- Migrate admin local dictionaries to `admin` namespace:
  - `features/admin/users/pages/AdminUsersPage.tsx`
  - `features/admin/subscriptions/pages/AdminSubscriptionsPage.tsx`
  - `app/admin/layout.tsx`
- Replace hardcoded modal backdrop button text `close`.
- Acceptance:
  - Admin pages contain only translation-key driven user copy.

### L10NQ-D-06 refactor(reports-localization)
- Migrate reports copy to `dashboard-reports` namespace:
  - `app/dashboard/reports/page.tsx`
  - `features/reports/components/PerformanceReportsView.tsx`
- Acceptance:
  - No hardcoded labels/titles/headings in reports route.

### L10NQ-D-07 refactor(markets-localization)
- Migrate markets form and select helper to namespace keys:
  - `features/markets/components/MarketUniverseForm.tsx`
  - `features/markets/components/SearchableMultiSelect.tsx`
- Remove `?? 'pl'` in markets form.
- Acceptance:
  - Placeholder/help/validation text fully key-based.

### L10NQ-D-08 refactor(backtests-fallback-removal)
- Remove locale fallback drift and consolidate backtests copy handling:
  - `features/backtest/components/BacktestCreateForm.tsx`
  - `features/backtest/components/BacktestsListView.tsx`
  - `features/backtest/components/BacktestsRunsTable.tsx`
  - `features/backtest/components/BacktestRunDetails.tsx`
- Replace `backtestRunDetails.copy.ts` fallback inheritance for PT with explicit per-locale parity.
- Acceptance:
  - No `?? 'pl'` in backtests UI.
  - PT keys are explicit (no EN spread fallback for UI copy).

### L10NQ-D-09 refactor(bots-page-copy)
- Migrate remaining hardcoded bot page title/breadcrumb labels and management leftovers:
  - `app/dashboard/bots/create/page.tsx`
  - `app/dashboard/bots/[id]/edit/page.tsx`
  - `app/dashboard/bots/[id]/assistant/page.tsx`
  - `app/dashboard/bots/[id]/preview/page.tsx`
  - `features/bots/components/BotsManagement.tsx`
  - `features/bots/hooks/useBotsListController.ts`
- Acceptance:
  - No hardcoded page-level bot labels.

### L10NQ-D-10 refactor(dashboard-home-copy)
- Migrate remaining mixed strings in runtime home widgets:
  - `features/dashboard-home/components/HomeLiveWidgets.tsx`
- Include TP/SL/Notes/manual-order placeholder strings.
- Acceptance:
  - Runtime modal/form labels are fully i18n-driven.

### L10NQ-D-11 refactor(global-offline-risk-copy)
- Localize:
  - `app/offline/page.tsx`
  - `ui/layout/dashboard/RiskNoticeFooter.tsx`
- Acceptance:
  - No mixed EN/PL literals in those surfaces.

### L10NQ-D-12 refactor(shared-foundation-aria)
- Localize shared aria/title strings used across routes:
  - `ui/components/ConfirmModal.tsx`
  - `ui/components/FormModal.tsx`
  - `ui/components/DataTable.tsx`
  - `ui/components/loading/Skeleton*.tsx`
  - `ui/components/FooterPreferencesSwitchers.tsx`
  - `app/layout.tsx` (`Skip to main content`)
  - `ui/layout/dashboard/Header.tsx` nav aria labels
- Acceptance:
  - Shared primitives consume translation keys for user-facing accessibility text.

### L10NQ-D-13 refactor(shared-footer-labels)
- Align footer/public-shell labels and copyrights to translation keys where user-facing.
- Acceptance:
  - Layout footers have no hardcoded locale text.

### L10NQ-D-14 refactor(low-score-module-cleanup)
- Clean remaining low-score route-reachable literals:
  - `features/profile/components/BasicForm.tsx`
  - `features/wallets/components/WalletCreateEditForm.tsx` (if user-facing literal remains)
- Acceptance:
  - Route-reachable module-level finding list reduced to zero.

### L10NQ-D-15 cleanup(non-route-legacy-copy)
- Align non-route legacy/stray surfaces to standard to prevent regression re-entry:
  - `features/backtest/components/BacktestsList.tsx` (legacy)
  - `features/strategies/presets/strategyPresets.ts` localized preset copy contract
- Acceptance:
  - Legacy surfaces do not reintroduce local dictionaries or mixed copy.

### L10NQ-D-16 test(namespace-parity-expanded)
- Expand en/pl/pt parity checks to newly added keys and namespaces.
- Acceptance:
  - Missing key in any locale fails CI.

### L10NQ-D-17 test(route-locale-smoke)
- Add route-level locale smoke assertions for top impacted routes:
  - auth login/register
  - reports
  - markets create/edit
  - backtests create/list/details
  - bots create/edit/assistant/preview
  - offline
  - admin users/subscriptions
- Acceptance:
  - No raw fallback keys in rendered output.

### L10NQ-D-18 qa(final-pack-and-closure)
- Run focused verification pack:
  - web i18n tests
  - typecheck
  - web build
  - docker worker build parity check
- Publish closure evidence and sync canonical queues.
- Acceptance:
  - Guardrails and regression pack pass.
  - Canonical planning reflects closed wave.

## Definition of Done
- Module findings list from audit artifact reduced to zero for route-reachable files.
- Shared-foundation findings list reduced to approved explicit exceptions only (if any), documented with rationale.
- New locale onboarding requires only namespace file updates and parity tests, without searching feature files manually.
