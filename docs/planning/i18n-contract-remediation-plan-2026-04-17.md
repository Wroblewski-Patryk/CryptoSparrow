# i18n Contract Remediation Plan (2026-04-17)

Status: planned  
Execution mode: tiny-commit only (one task per commit)

## Goal
- Restore real 3-locale behavior (`en`, `pl`, `pt`) across app surfaces.
- Remove `en/pl` locale clamps and hardcoded copy hotspots that block full Portuguese UX.
- Keep Portuguese variant policy fixed to `pt-PT` only (no `pt-BR` branch).
- Normalize localization documentation language to English-only (default repository documentation language).

## Problem Snapshot (Validated)
- Core locale contract is already `en/pl/pt` in i18n core (`translations`, `I18nProvider`, `useLocaleFormatting`).
- Dashboard PT namespaces currently contain EN fallback copy (functional but not localized quality).
- Backtest module still clamps locale to EN/PL:
  - `apps/web/src/features/backtest/components/BacktestCreateForm.tsx`
  - `apps/web/src/features/backtest/components/BacktestsListView.tsx`
  - `apps/web/src/features/backtest/components/BacktestsRunsTable.tsx`
  - `apps/web/src/features/backtest/components/BacktestRunDetails.tsx`
- Language switcher uses static labels dataset (`languageOptions.json`) instead of translation keys.
- Existing docs still state EN/PL-only localization scope:
  - `docs/product/localization.md`
  - `docs/ux/localization-qa.md`

## Non-Goals
- No `pt-BR` support in this wave.
- No translation-management platform migration in this wave.
- No large UI redesign work outside i18n contract fixes.

## Execution Groups (Commit Batches)
- `L10NQ-A` (`L10NQ-01..L10NQ-05`): P0 blockers and hard regressions.
- `L10NQ-B` (`L10NQ-06..L10NQ-11`): modular namespace architecture and parity guardrails.
- `L10NQ-C` (`L10NQ-12..L10NQ-15`): route-level loading + documentation normalization.

## Tiny-Commit Task Queue

### L10NQ-01
`docs(contract): freeze remediation scope and English-only documentation baseline`
- Lock canonical plan references and explicit acceptance criteria for this wave.
- State that localization docs must be authored in English by default.

### L10NQ-02
`qa(scan): capture baseline inventory of locale clamps and hardcoded-copy hotspots`
- Generate deterministic artifact listing:
  - `locale === 'en' ? 'en' : 'pl'`
  - `Locale` unions limited to `en|pl`
  - hardcoded page/module user copy in non-test files.

### L10NQ-03
`fix(web-backtest-locale): remove EN/PL clamp in backtest module`
- Replace backtest locale coercion with full locale pass-through (`en/pl/pt`).
- Apply to create/list/run tables/details and related copy helpers.

### L10NQ-04
`test(web-backtest-i18n): add regression coverage for Portuguese backtest locale path`
- Add tests that fail on reintroduced EN/PL clamp.
- Assert translated labels and formatters resolve for `pt`.

### L10NQ-05
`refactor(web-hardcoded-wrapper-copy): migrate page-wrapper/module hardcoded strings to i18n keys`
- Priority surfaces:
  - dashboard wrapper pages (`app/dashboard/**/page.tsx`)
  - auth forms/pages
  - admin users/subscriptions pages
  - reports and markets form wrappers.

### L10NQ-06
`feat(i18n-namespaces): split translations by module/route domain`
- Add/expand namespaces for:
  - `public`
  - `auth`
  - `dashboard/backtests`
  - `dashboard/markets`
  - `dashboard/strategies`
  - `dashboard/wallets`
  - `dashboard/reports`
  - `admin`.

### L10NQ-07
`refactor(i18n-registry): add explicit namespace registry and route-domain mapping`
- Keep deterministic key ownership per module.
- Preserve fallback to EN where key missing, with logged diagnostics in development.

### L10NQ-08
`refactor(web-language-switcher): localize language labels via translation keys`
- Keep locale codes stable (`en/pl/pt`) and switch logic unchanged.
- Remove static-label coupling from JSON dataset.

### L10NQ-09
`test(i18n-parity): enforce key parity across en/pl/pt for every namespace`
- Add parity test and fail build on missing keys by namespace.
- Include explicit report output for missing keys.

### L10NQ-10
`test(i18n-guardrails): detect locale clamps and hardcoded-copy regressions`
- Add automated scan test for clamp patterns and selected hardcoded-copy hotspots.
- Exclude tests/mocks/fixtures intentionally.

### L10NQ-11
`l10n(pt-content): replace placeholder EN copy in PT namespaces with real pt-PT content`
- Start with dashboard shell/home/bots, then backtests/admin/auth as new namespaces land.
- Ensure copy quality review before closure.

### L10NQ-12
`feat(i18n-route-loading): introduce route-level namespace loading`
- Load only required namespaces per route/module.
- Keep SSR/client hydration stable with fallback loading states.

### L10NQ-13
`test(i18n-route-loading): verify no missing-key flicker and stable locale persistence`
- Add regression checks for route transitions + refresh persistence.

### L10NQ-14
`docs(localization): rewrite localization policy/qa docs to English-only and en/pl/pt contract`
- Update:
  - `docs/product/localization.md`
  - `docs/ux/localization-qa.md`
- Explicitly include `pt-PT` policy and remove EN/PL-only wording.

### L10NQ-15
`docs(governance): add docs-language guardrail and backlog for remaining non-English docs`
- Add checklist/process note in governance docs so new canonical docs default to English.
- Add backlog list for legacy non-English docs requiring normalization.

## Validation Commands (Agent Checklist)
- Web typecheck:
  - `pnpm --filter web run typecheck`
- Targeted i18n regression tests:
  - `pnpm --filter web test -- src/i18n/translations.test.ts src/i18n/I18nProvider.test.tsx src/i18n/useLocaleFormatting.test.tsx src/ui/layout/dashboard/LanguageSwitcher.test.tsx`
- Backtest i18n regression pack:
  - `pnpm --filter web test -- src/features/backtest/components/*.test.tsx`
- Production build:
  - `pnpm --filter web run build`
- Clamp/hardcoded scan (PowerShell fallback-safe):
  - `Get-ChildItem -Recurse -File apps\web\src -Include *.ts,*.tsx | Where-Object { $_.Name -notlike '*.test.ts' -and $_.Name -notlike '*.test.tsx' } | Select-String -Pattern @("locale === 'en' ? 'en' : 'pl'","'en' | 'pl'")`

## Acceptance Criteria
1. No EN/PL clamp remains in production i18n flow for backtests and related module branches.
2. `en/pl/pt` key parity is enforced per namespace in tests.
3. Language switcher labels are sourced from i18n keys, not static hardcoded labels.
4. PT (`pt-PT`) path contains real Portuguese copy for core dashboard/backtest surfaces.
5. Localization policy and QA docs are updated to English-only with explicit `pt-PT` contract.

