# Localization Reference

## Scope and Contract
Localization contract for CryptoSparrow is:
- `en` (default locale)
- `pl`
- `pt` (`pt-PT` policy only)

No `pt-BR` branch is supported in this wave.

## Canonical Sources
- `apps/web/src/i18n/translations.ts`
- `apps/web/src/i18n/namespaceRegistry.ts`
- `apps/web/src/i18n/I18nProvider.tsx`
- `docs/ux/localization-qa.md`

## Namespace and Route Loading Policy
- Translations are organized by explicit namespaces (public/auth/admin/dashboard modules).
- Runtime dictionary resolution is route-scoped via `resolveNamespacesForRoute(...)`.
- Provider resolves locale text from route-scoped dictionary first, then route-scoped EN fallback.
- Missing key diagnostics are logged in development only and include route + expected namespaces.

## UI and Content Rules
- User-facing strings must be sourced from i18n keys (no hardcoded copy in production components).
- Language switcher labels must come from translation keys.
- Portuguese content must use `pt-PT` copy, not English placeholders, for core dashboard surfaces.

## Documentation Language Rule
Canonical repository documentation is written in English by default.
If a legacy non-English document is touched, normalize it to English in the same task or add it to governance backlog.

## Current Coverage Baseline (2026-04-17)
- Dashboard shell, home, bots, backtests wrappers, and language switcher are on `en/pl/pt` path.
- Namespace parity and i18n guardrail tests are required in CI/local validation before release tasks are closed.
