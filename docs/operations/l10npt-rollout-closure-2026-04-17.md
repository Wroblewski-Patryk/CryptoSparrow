# European Portuguese Localization Closure (2026-04-17)

Source artifact:
- `docs/operations/_artifacts-l10npt-rollout-2026-04-16T22-59-22-697Z.json`

Scope:
- `L10NPT-01..L10NPT-12` (`L10NPT-A`)

## Closure Summary
- Added third locale in web app contract: `pt` (European Portuguese, `pt-PT` formatting).
- Added Portuguese option in language switcher and persisted locale flow.
- Added Portuguese dashboard namespace payloads (`dashboard-shell`, `dashboard-home`, `dashboard-bots`).
- Removed remaining `en/pl-only` locale branch hotspots tracked in rollout plan scans.
- Extended strategy localization helpers/preset presentation to support `pt`.
- Extended i18n contract tests and locale formatting tests for EN/PL/PT parity.

## Validation Pack
1. `pnpm --filter web run typecheck` -> PASS
2. `pnpm --filter web test -- src/i18n/translations.test.ts src/i18n/I18nProvider.test.tsx src/i18n/useLocaleFormatting.test.tsx src/ui/layout/dashboard/LanguageSwitcher.test.tsx` -> PASS (`8/8`)
3. `pnpm --filter web test -- src/features/strategies/components/StrategyFormSections/Indicators.test.tsx src/features/strategies/components/StrategyPresetPicker.test.tsx src/features/wallets/components/WalletCreateEditForm.test.tsx` -> PASS (`14/14`)
4. `pnpm --filter web test -- src/ui/components/ThemeSwitch.test.tsx src/ui/layout/public/Header.test.tsx src/ui/layout/dashboard/PageTitle.a11y.test.tsx src/app/dashboard/wallets/list/page.test.tsx src/app/dashboard/dashboard.a11y.smoke.test.tsx` -> PASS (`10/10`)
5. `pnpm --filter web test -- src/features/auth/components/LoginForm.test.tsx src/features/auth/components/RegisterForm.test.tsx src/features/profile/components/ApiKeyForm.test.tsx src/features/profile/components/ApiKeysList.test.tsx src/features/profile/components/Security.test.tsx src/features/profile/components/Subscription.test.tsx` -> PASS (`20/20`)
6. `pnpm --filter web run build` -> PASS (with pre-existing unrelated lint warnings)
7. Hardcoded locale scan (`locale === 'pl'`, `"en" | "pl"`) on non-test web files -> PASS (`0` matches)

## Notes
- `pt-BR` remains explicitly out of scope for this rollout.
- Existing unrelated lint warnings reported by `next build` were not introduced by this wave.
