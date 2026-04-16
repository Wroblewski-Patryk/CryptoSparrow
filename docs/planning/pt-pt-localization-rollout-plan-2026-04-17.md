# European Portuguese Localization Rollout Plan (2026-04-17)

Status: ready-for-implementation  
Execution mode: tiny-commit only (one task per commit)

## Goal
- Add a third application language: **Portuguese (Europe)**.
- Keep existing language behavior unchanged:
  - `en` remains default.
  - `pl` remains available.
- Expose Portuguese in language switchers, including footer controls.

## Locale Contract (Locked)
1. Supported app locales after rollout:
   - `en`
   - `pl`
   - `pt` (Portuguese, Europe)
2. Intl formatting locale for Portuguese:
   - `pt-PT`
3. Explicitly out of scope:
   - `pt-BR` and any Brazil-specific localization branch.
4. When `pt` is selected:
   - `document.documentElement.lang = "pt"`.
   - locale-specific formatting uses `pt-PT`.

## Why This Needs a Dedicated Wave
- Current localization contracts still contain many `en/pl` hardcoded branches.
- Scan snapshot (2026-04-17):
  - 45 matches in 40 non-test `apps/web/src` files for patterns like:
    - `locale === 'pl'`
    - `"en" | "pl"`
- This requires controlled migration, not a single monolithic commit.

## High-Risk Hotspots (from scan)
- i18n core:
  - `apps/web/src/i18n/translations.ts`
  - `apps/web/src/i18n/I18nProvider.tsx`
  - `apps/web/src/i18n/useLocaleFormatting.ts`
  - `apps/web/src/security/themeBootstrap.ts`
- language switcher + footer:
  - `apps/web/src/ui/layout/dashboard/LanguageSwitcher.tsx`
  - `apps/web/src/ui/layout/dashboard/languageOptions.json`
  - `apps/web/src/ui/components/FooterPreferencesSwitchers.tsx`
  - `apps/web/src/ui/layout/dashboard/Footer.tsx`
  - `apps/web/src/ui/layout/public/Footer.tsx`
- shared UI hardcoded copy:
  - `apps/web/src/ui/layout/public/Header.tsx`
  - `apps/web/src/ui/components/ProfileButton.tsx`
  - `apps/web/src/ui/components/ThemeSwitch.tsx`
  - `apps/web/src/ui/layout/dashboard/PageTitle.tsx`
- feature-level hardcoded copy clusters:
  - `apps/web/src/app/(public)/page.tsx`
  - `apps/web/src/app/dashboard/**/page.tsx` (markets/strategies/wallets/bots)
  - `apps/web/src/features/profile/**`
  - `apps/web/src/features/auth/pages/**`
  - `apps/web/src/features/strategies/**`
  - `apps/web/src/features/wallets/**`

## Tiny-Commit Task Queue

### L10NPT-01
`docs(contract): lock Portuguese locale variant policy as pt-PT only`
- Update canonical decision docs and execution references.
- Done when:
  - docs explicitly forbid `pt-BR` in this rollout.

### L10NPT-02
`feat(i18n-core): extend locale contract to en/pl/pt with pt-PT formatting`
- Scope:
  - widen `Locale` unions from `en|pl` to `en|pl|pt`.
  - update locale bootstrap/storage normalization.
  - add Intl mapping for `pt -> pt-PT`.
- Target files:
  - `apps/web/src/i18n/translations.ts`
  - `apps/web/src/i18n/I18nProvider.tsx`
  - `apps/web/src/i18n/useLocaleFormatting.ts`
  - `apps/web/src/security/themeBootstrap.ts`

### L10NPT-03
`feat(web-language-switcher): add Portuguese option in header/footer language controls`
- Scope:
  - add `pt` to language options dataset.
  - ensure switcher accepts and persists `pt`.
  - preserve existing footer language switch visibility and behavior.
- Target files:
  - `apps/web/src/ui/layout/dashboard/languageOptions.json`
  - `apps/web/src/ui/layout/dashboard/LanguageSwitcher.tsx`
  - related tests.

### L10NPT-04
`feat(i18n-namespaces): add Portuguese namespace files and wire translations map`
- Scope:
  - create PT namespace variants for dashboard shell/home/bots.
  - wire them into `translations`.
- New files:
  - `apps/web/src/i18n/namespaces/dashboard-shell.pt.ts`
  - `apps/web/src/i18n/namespaces/dashboard-home.pt.ts`
  - `apps/web/src/i18n/namespaces/dashboard-bots.pt.ts`

### L10NPT-05
`refactor(web-shared-copy): remove en/pl-only branches in shared layout/components`
- Scope:
  - migrate shared UI copy to translation keys or locale maps that include `pt`.
  - focus on globally visible controls first.
- Candidate files:
  - `ui/layout/public/Header.tsx`
  - `ui/components/ProfileButton.tsx`
  - `ui/components/ThemeSwitch.tsx`
  - `ui/layout/dashboard/PageTitle.tsx`

### L10NPT-06
`refactor(web-page-copy): migrate page-level inline copy to include pt`
- Scope:
  - dashboard markets/strategies/wallets/bots page copy.
  - auth pages + public landing copy.
- Candidate files:
  - `app/(public)/page.tsx`
  - `app/dashboard/**/page.tsx`
  - `features/auth/pages/LoginPage.tsx`
  - `features/auth/pages/RegisterPage.tsx`

### L10NPT-07
`refactor(strategies-localizers): widen strategy helper locale maps to include pt`
- Scope:
  - indicator labels/param labels/group labels/condition labels.
  - strategy presets presentation localization.
- Candidate files:
  - `features/strategies/components/StrategyFormSections/Indicators.tsx`
  - `features/strategies/utils/indicatorPresentation.ts`
  - `features/strategies/utils/indicatorTaxonomy.ts`
  - `features/strategies/presets/strategyPresets.ts`

### L10NPT-08
`refactor(profile-wallet-markets): remove remaining en/pl-only branches in feature forms`
- Scope:
  - profile, wallets, markets feature-level copy branches.
- Candidate files:
  - `features/profile/**`
  - `features/wallets/**`
  - `features/markets/**`

### L10NPT-09
`test(i18n-contract): update locale tests to en/pl/pt parity`
- Scope:
  - translation key sync tests must validate 3-locale parity.
  - switcher and provider tests must verify pt selection and persistence.
  - formatting test should assert Portuguese decimal/date conventions.
- Candidate files:
  - `apps/web/src/i18n/translations.test.ts`
  - `apps/web/src/i18n/I18nProvider.test.tsx`
  - `apps/web/src/i18n/useLocaleFormatting.test.tsx`
  - `apps/web/src/ui/layout/dashboard/LanguageSwitcher.test.tsx`

### L10NPT-10
`qa(i18n-hardcoded-scan): run hardcoded-string scan and close remaining en/pl-only hotspots`
- Scope:
  - rerun deterministic scan for `locale === 'pl'` and `"en" | "pl"` in non-test files.
  - either fix or explicitly document accepted exceptions.

### L10NPT-11
`qa(web-smoke): manual language smoke for dashboard/public/profile/auth with pt locale`
- Scope:
  - verify switch to Portuguese in footer and header.
  - verify persistence after refresh.
  - verify key pages do not regress to mixed PL/EN copy.

### L10NPT-12
`docs(closure): publish rollout evidence and sync canonical queues/plans`
- Scope:
  - add closure note and evidence artifacts.
  - update `mvp-next-commits` + `mvp-execution-plan` statuses.

## Validation Commands (Agent Checklist)
- Typecheck:
  - `pnpm --filter web run typecheck`
- i18n tests:
  - `pnpm --filter web test -- src/i18n/translations.test.ts src/i18n/I18nProvider.test.tsx src/i18n/useLocaleFormatting.test.tsx src/ui/layout/dashboard/LanguageSwitcher.test.tsx`
- build:
  - `pnpm --filter web run build`
- hardcoded scan (PowerShell fallback-safe):
  - `Get-ChildItem -Recurse -File apps\\web\\src -Include *.ts,*.tsx | Where-Object { $_.Name -notlike '*.test.ts' -and $_.Name -notlike '*.test.tsx' } | Select-String -Pattern @('locale === ''pl''','\"en\" \\| \"pl\"')`

## Acceptance Criteria
1. App supports 3 languages: EN (default), PL, PT (European Portuguese).
2. Footer language switcher includes Portuguese and persists locale correctly.
3. PT language path uses `pt-PT` formatting conventions.
4. No regressions in EN/PL behavior.
5. Most user-facing `en/pl-only` branches are removed or explicitly tracked with follow-up IDs.
