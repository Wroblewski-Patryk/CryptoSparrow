# Engineering Optimization Next Commits Queue (2026-04-12)

Operational tiny-commit queue for repo-wide engineering standards hardening.

## Scope
- Source analysis: `docs/planning/engineering-optimization-wave-2026-04-12.md`
- Focus: architecture, reliability, consistency, and maintainability across API + Web.

## NOW

## NEXT
- [ ] `OPTC-13 core(shared-contracts): extract shared exchange constants/capabilities/marketType contract`
- [ ] `OPTC-14 migrate(api-contracts): switch API zod schemas to shared exchange contract`
- [ ] `OPTC-15 migrate(web-contracts): switch Web exchange capability/types to shared contract`
- [ ] `OPTC-16 refactor(web-runtime-home): split HomeLiveWidgets into formatter/actions/sections hooks`
- [ ] `OPTC-17 refactor(web-runtime-bots): split BotsManagement orchestration into focused modules`
- [ ] `OPTC-18 i18n(web): split monolithic translations by domain namespaces`
- [ ] `OPTC-19 ux(web-guardrails): replace window.confirm/location.assign with app modal + navigation helper`
- [ ] `OPTC-20 perf(web-prefs): centralize profile preference cache/sync (DataTable + account prefs)`
- [ ] `OPTC-21 qa(repo): run full lint/typecheck/guardrails + targeted e2e confidence pack and publish evidence`

## BLOCKED
- none

## DONE
- [x] `OPTC-12 migrate(web-edit-list-pages): standardize async+error handling for edit/list dashboards`
  - 2026-04-16: Migrated dashboard edit/list pages (`markets/list`, `wallets/list`, `markets/[id]/edit`, `strategies/[id]/edit`) to shared async-state and error-resolution helpers (`runAsyncWithState`, `resolveUiErrorMessage`), aligned load/save fallback behavior, and added submit pending guards for edit actions; validated with `pnpm --filter web run typecheck` + targeted market/strategy/wallet form suites (PASS).
- [x] `OPTC-11 migrate(web-create-pages): standardize async+error handling on create pages (markets/strategies/backtests)`
  - 2026-04-16: Migrated dashboard create pages (`markets`, `strategies`, `backtests`) to shared async/error flow using `runAsyncWithState` + `resolveUiErrorMessage`, aligned fallback messaging, and added submit pending guard for strategy create action; validated with `pnpm --filter web run typecheck` + targeted market/backtest/strategy form tests (PASS).
- [x] `OPTC-10 core(web-errors): create single UI error resolver and deprecate handleError/getAxiosMessage split`
  - 2026-04-16: Added shared `resolveUiErrorMessage` in `apps/web/src/lib/errorResolver.ts` and switched `handleError`/`getAxiosMessage` to compatibility wrappers around that single resolver (deprecated split), updated forms helper to use the new resolver directly, and added focused contract tests (`errorResolver.test.ts`); validated with `pnpm --filter web run typecheck` + `pnpm --filter web test -- src/lib/errorResolver.test.ts` (PASS).
- [x] `OPTC-09 test(api-normalization): add regression contract tests for shared normalization invariants`
  - 2026-04-16: Extended `apps/api/src/lib/symbols.test.ts` with regression invariants for idempotent normalization, fallback hardening (`USDT` when input/fallback are blank), deterministic order-insensitive list normalization, and non-mutating universe resolution contracts; validated with `pnpm --filter api run typecheck` + `pnpm --filter api test -- src/lib/symbols.test.ts` (PASS).
- [x] `OPTC-08 migrate(api-wallets-markets-icons-stream): remove remaining production trim().toUpperCase variants`
  - 2026-04-16: Migrated remaining production symbol/base-currency uppercase normalization in `wallets`, `markets`, `icons`, `market-stream` and `workers/marketStream` paths to shared helpers from `lib/symbols`, removing local `trim().toUpperCase()` variants from those modules; validated with API typecheck + targeted wallets/markets/icons/market-stream suites (PASS).
- [x] `OPTC-07 migrate(api-engine): remove local uppercase normalization variants in runtime/engine modules`
  - 2026-04-16: Replaced local runtime/engine symbol/base-currency uppercase normalization with shared helpers (`normalizeSymbol`, `normalizeBaseCurrency`, `normalizeSymbols`) across execution/runtime dataflow services (`executionOrchestrator`, `runtimeScanLoop`, `runtimeSignalLoop`, `runtimeTelemetry`, `runtimeCapitalContext`, `runtimeExecutionDedupe`, `runtimeSignalLoopDefaults`, `runtimeSignalMarketDataGateway`, `runtimeTickerStore`, `paperRuntime`); validated with API typecheck + targeted engine unit suites (PASS).
- [x] `OPTC-06 core(api-normalization): extend shared symbol/base-currency normalization helpers`
  - 2026-04-15: Expanded shared API normalization helpers in `lib/symbols.ts` by adding `normalizeBaseCurrency`, `normalizeSymbolStrict`, and list-level normalization utilities, then added dedicated helper tests (`src/lib/symbols.test.ts`) as baseline contract coverage for upcoming runtime/wallets/icons migrations; validated with API typecheck + targeted symbols/wallets/market-stream suites (PASS).
- [x] `OPTC-05 migrate(api-profile-subscriptions): typed domain errors for profile/security/subscription flows`
  - 2026-04-15: Added typed domain errors for profile/security + subscriptions (`security.errors.ts`, `subscriptions.errors.ts`), migrated service/payment throw-sites to `DomainError`, and switched profile security/subscription controllers to code-based mapped error handling (`mapErrorToHttpResponse`) without message equality checks; validated with API typecheck and targeted security/subscription entitlements suites (PASS).
- [x] `OPTC-04 migrate(api-bots-orders): typed domain errors for high-change command/execution paths`
  - 2026-04-15: Added typed domain errors for bots/orders (`bots.errors.ts`, `orders.errors.ts`), migrated throw-sites in bot command/runtime and order execution/pretrade flows, and replaced bots/orders controller message-equality checks with code-based mapped handling via `mapErrorToHttpResponse`; validated with API typecheck + targeted bots/orders tests (PASS).
- [x] `OPTC-03 migrate(api-markets-strategies): typed domain errors + controller mapping without message equality`
  - 2026-04-15: Added typed domain error contracts for markets/strategies (`markets.errors.ts`, `strategies.errors.ts`), migrated service throws from string-errors to typed domain errors, and replaced controller message-equality branches with code-based mapping via `mapErrorToHttpResponse`; validated with `pnpm --filter api run typecheck` + targeted markets/strategies e2e suites (PASS).
- [x] `OPTC-02 migrate(api-wallets): replace wallet error-string flow with typed domain errors`
  - 2026-04-15: Added typed wallet domain errors (`wallets.errors.ts`), migrated wallet service throws to `DomainError`, and switched wallet controller error handling to code-based mapping via central mapper (`mapErrorToHttpResponse`) without `error.message` equality checks; validated with `pnpm --filter api run typecheck` and `pnpm --filter api test -- src/modules/wallets/wallets.e2e.test.ts` (PASS).
- [x] `OPTC-01 core(api-errors): introduce typed AppError/DomainError primitives + central http mapper`
  - 2026-04-15: Added core primitives (`apps/api/src/lib/errors.ts`) and centralized mapper (`apps/api/src/lib/httpErrorMapper.ts`), wired global `errorHandler` to mapped responses, migrated `ExchangeNotImplementedError` to `DomainError`, and validated with `pnpm --filter api run typecheck` + `pnpm --filter api test -- src/lib/errors.test.ts src/lib/httpErrorMapper.test.ts` (PASS).

## Queue Rules
- Keep `NOW` at max 5 tasks.
- One logical change per task.
- If a task grows, split before coding.
- Update:
  - `docs/planning/mvp-next-commits.md`
  - `docs/planning/mvp-execution-plan.md`
  - progress log in `docs/planning/engineering-optimization-wave-2026-04-12.md`
