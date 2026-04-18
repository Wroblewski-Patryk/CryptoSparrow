# L10NQ-D Closure (2026-04-18)

## Scope
- Closed `L10NQ-D-11..L10NQ-D-18`.
- Final tranche in this run:
  - `L10NQ-D-15`: legacy backtests + strategy presets localization contract alignment.
  - `L10NQ-D-16`: expanded `en/pl/pt` parity assertions for newly introduced keys.
  - `L10NQ-D-17`: route-level locale smoke for highest-impact routes.
  - `L10NQ-D-18`: final regression/build/deploy-parity verification and closure sync.

## Verification Pack
1. `pnpm --filter web test -- src/i18n/translations.test.ts src/i18n/namespaceRegistry.test.ts src/i18n/guardrails.test.ts src/i18n/I18nProvider.test.tsx src/i18n/I18nProvider.route-loading.test.tsx src/i18n/routeLocaleSmoke.test.ts`
   - PASS (`16/16`)
2. `pnpm --filter web run typecheck`
   - PASS
3. `pnpm --filter web run build`
   - PASS
   - Non-blocking lint warnings remain in unrelated files.
4. `docker build -f apps/api/Dockerfile.worker.backtest .`
   - PASS

## Build-Gate Note
- `web build` initially failed on `@typescript-eslint/no-explicit-any` in `apps/web/src/ui/components/SkipToContentLink.tsx`.
- Applied a minimal typed lookup helper (no UX changes), then reran the full closure pack to green.

## Outcome
- `L10NQ-D` phase is closed with evidence.
- Route-critical localization coverage now includes key-resolution smoke checks for `auth`, `reports`, `markets`, `backtests`, `bots`, `offline`, and `admin`.
