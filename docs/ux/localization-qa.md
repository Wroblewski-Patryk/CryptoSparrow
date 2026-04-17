# Localization QA Checklist (EN/PL/PT)

Use this checklist before release candidates and after any i18n or copy refactor.

## 1. Translation Key Integrity
1. Run namespace parity tests (`en` vs `pl` vs `pt`) and verify zero missing keys.
2. Verify route-scoped dictionary ownership is deterministic for key module paths.
3. Verify no hardcoded user-facing strings in guarded hotspots (backtests wrappers, bots wrapper, language switcher).

## 2. Locale Formatting Verification
1. Date and date-time formatting:
   - EN -> `en-US`
   - PL -> `pl-PL`
   - PT -> `pt-PT`
2. Number, currency, and percent formatting:
   - separators and symbols follow locale conventions.
3. Null/invalid values render safe placeholders (`-`, `--:--`) without crashes.

## 3. Route-Level Loading Regression Checks
1. Transition between dashboard modules (for example backtests -> markets) does not show missing-key placeholders.
2. Locale remains stable after route changes and refresh-style remount.
3. Development diagnostics report missing keys only when key is truly absent from active route namespaces.

## 4. Manual UI Sweep (EN, PL, PT)
1. Dashboard shell (header, footer, navigation, language switcher).
2. Bots, backtests, markets, strategies, wallets, reports, logs.
3. Auth and admin entry routes.
4. Error/empty/loading/degraded states.

## 5. Release Gates
- `pnpm --filter web run typecheck` -> PASS
- i18n focused tests -> PASS
- `pnpm --filter web run build` -> PASS
- if API worker Dockerfile changed in the wave: `docker build -f apps/api/Dockerfile.worker.backtest .` -> PASS
