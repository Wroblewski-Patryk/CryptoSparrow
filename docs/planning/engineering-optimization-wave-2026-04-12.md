# Engineering Optimization Wave (2026-04-12)

Goal: improve maintainability, reliability, and performance across API + Web after `NX-01..NX-05`.

Execution queue (tiny commits): `docs/planning/engineering-optimization-next-commits-2026-04-12.md`.

## Review Evidence (repo-wide)
1. API still has many local symbol/base-currency normalization variants (`trim().toUpperCase()`), for example:
   - `apps/api/src/modules/wallets/wallets.service.ts:21`
   - `apps/api/src/modules/wallets/wallets.service.ts:439`
   - `apps/api/src/modules/engine/runtimeTelemetry.service.ts:76`
   - `apps/api/src/modules/engine/executionOrchestrator.service.ts:90`
2. API error handling still relies on string-matched `Error.message` across controllers, for example:
   - `apps/api/src/modules/bots/bots.controller.ts:172`
   - `apps/api/src/modules/orders/orders.controller.ts:41`
   - `apps/api/src/modules/wallets/wallets.controller.ts:63`
3. Web has mixed error parsers (`handleError` vs `getAxiosMessage`) and repetitive async loading/submitting patterns:
   - `apps/web/src/lib/handleError.ts:1`
   - `apps/web/src/lib/getAxiosMessage.ts:1`
   - `apps/web/src/app/dashboard/markets/create/page.tsx:49`
   - `apps/web/src/app/dashboard/strategies/create/page.tsx:47`
   - `apps/web/src/app/dashboard/backtests/create/page.tsx:27`
4. Runtime UI hotspots are still large/high-complexity and near long-term maintenance limits:
   - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx` (~53 KB)
   - `apps/web/src/features/bots/components/BotsManagement.tsx` (~54 KB)
5. Hard browser-side flows remain in multiple places (`window.confirm`, `window.location.assign`):
   - `apps/web/src/features/wallets/components/WalletsListTable.tsx:75`
   - `apps/web/src/features/bots/components/BotCreateEditForm.tsx:206`
   - `apps/web/src/features/auth/hooks/useLoginForm.ts:40`
   - `apps/web/src/features/auth/hooks/useRegisterForm.ts:37`
6. Exchange contracts are duplicated across API/Web schema layers:
   - `apps/web/src/features/exchanges/exchangeCapabilities.ts:1`
   - `apps/api/src/modules/wallets/wallets.types.ts:9`
   - `apps/api/src/modules/markets/markets.types.ts:19`
7. i18n bundle is still monolithic:
   - `apps/web/src/i18n/translations.ts` (~62 KB)

## Core 5 (implementation-first)
1. `OPT-01 error-taxonomy(api): replace string-code Error.message flow with typed domain errors + central mapper`
   - Scope:
     - add `AppError`/`DomainError` primitives in `apps/api/src/lib`
     - migrate bots/orders/wallets/markets/strategies/profile controllers + services
   - Outcome:
     - no `error.message === 'SOME_CODE'` branching in migrated modules
     - deterministic HTTP mapping by error code/class
   - Validation:
     - `pnpm --filter api run typecheck`
     - focused e2e for bots/orders/wallets/profile/markets/strategies

2. `OPT-02 normalization(api): unify symbol/baseCurrency normalization primitives and remove local uppercase variants`
   - Scope:
     - expand `apps/api/src/lib/symbols.ts` with `normalizeBaseCurrency`, `normalizeSymbolStrict`, list helpers
     - migrate runtime/engine/wallets/icons/market-stream/markets modules
   - Outcome:
     - no local `trim().toUpperCase()` for symbols/base-currency in production API paths
   - Validation:
     - `pnpm --filter api run typecheck`
     - targeted runtime/wallets/market-stream tests

3. `OPT-03 async-errors(web): standardize async action + error mapping across page-level create/edit/list flows`
   - Scope:
     - extend `apps/web/src/lib/async.ts` + `apps/web/src/lib/forms.ts` usage
     - migrate dashboard pages with repeated `setLoading/setSubmitting/try-catch/finally` patterns
   - Outcome:
     - unified retry/failure UX and fewer inconsistent toast descriptions
     - deprecate direct `handleError` usage in migrated paths
   - Validation:
     - `pnpm --filter web run typecheck`
     - affected page/component tests

4. `OPT-04 runtime-ui-split(web): decompose HomeLiveWidgets + BotsManagement into smaller domain modules`
   - Scope:
     - extract runtime formatting utilities (`age/duration/currency/symbol`) and section-specific hooks
     - keep presentation components focused (table/rail/sidebar/action handlers split)
   - Outcome:
     - reduced cognitive load and safer changes in runtime dashboard
     - file-size pressure lowered before hitting guardrails
   - Validation:
     - `pnpm --filter web run typecheck`
     - runtime dashboard regression tests
     - `pnpm run quality:guardrails`

5. `OPT-05 contracts(shared): create shared exchange enum/capability contracts for API + Web`
   - Scope:
     - introduce shared contract module/package for exchange constants (`BINANCE/BYBIT/...`, capabilities, market types)
     - replace duplicated literal enums in API zod schemas and web feature constants
   - Outcome:
     - single source of truth for exchange contract
     - reduced drift risk when adding new exchange/capability
   - Validation:
     - API + Web typecheck
     - wallet/markets/exchange capability tests

## Plus 3 (high-value follow-ups)
1. `OPT-06 i18n(web): split monolithic translations into domain namespaces + remove remaining hardcoded copy`
   - Scope:
     - split `translations.ts` by domain (auth/profile/bots/backtests/markets/common)
     - migrate hardcoded labels/messages in runtime/auth/create pages
   - Outcome:
     - lower merge conflicts, faster copy maintenance, cleaner localization coverage

2. `OPT-07 ux-guardrails(web): replace window.confirm/location.assign with app-level modal + navigation helpers`
   - Scope:
     - reusable confirm dialog hook/component
     - replace direct browser confirm/assign usages
   - Outcome:
     - non-blocking consistent UX and improved testability

3. `OPT-08 prefs-sync(web): cache/throttle profile preference sync (DataTable + account preferences)`
   - Scope:
     - deduplicate repeated `/dashboard/profile/basic` preference reads
     - central preference store/hook with TTL and optimistic update
   - Outcome:
     - fewer profile API calls and smoother table preference UX

## Suggested Execution Order
1. `OPT-01` (error taxonomy)
2. `OPT-02` (normalization)
3. `OPT-03` (web async+errors)
4. `OPT-05` (shared contracts)
5. `OPT-04` (runtime UI split)
6. `OPT-06` (i18n split)
7. `OPT-07` (confirm/navigation UX)
8. `OPT-08` (preference sync)

## Done Criteria for this wave
1. API controllers no longer depend on fragile `error.message` equality checks in migrated modules.
2. Symbol/baseCurrency normalization is centralized in both API and Web critical paths.
3. Web create/edit/list flows use shared async and error helpers.
4. Runtime dashboard hotspots are decomposed without behavior regressions.
5. Exchange contracts are shared (single-source) across API and Web.

## Progress Log (Engineering Optimization Wave)
- 2026-04-12: Published optimization wave plan and execution queue (`engineering-optimization-next-commits-2026-04-12.md`) after repo-wide standards audit.
- 2026-04-15: Activated execution flow in canonical `mvp-next-commits` by importing queue tasks (`NOW: OPTC-01..05`, `NEXT: OPTC-06..21`) under completion task `OPTC-00`.
- 2026-04-15: Completed `OPTC-01` by introducing typed API error primitives (`AppError`, `DomainError`) and centralized mapper wiring (`errorHandler` -> `httpErrorMapper`) with legacy compatibility retained for `status + toDetails()` error classes.
- 2026-04-15: Completed `OPTC-02` wallet migration by replacing string-error throws with typed wallet domain errors and switching wallet controller handling to error-code mapping (no `error.message` equality), while preserving existing API response messages for compatibility.
- 2026-04-15: Completed `OPTC-03` markets/strategies migration by replacing string-error checks with typed domain errors + code-based controller mapping, including active-bot protection and linked-record conflict handling in service-level contracts.
- 2026-04-15: Completed `OPTC-04` bots/orders migration by adding typed domain error contracts (`bots.errors.ts`, `orders.errors.ts`), replacing string-error throw sites in command/execution paths, and switching controller handling to code-based mapping via `mapErrorToHttpResponse` for both modules.
- 2026-04-15: Completed `OPTC-05` profile/subscriptions migration by introducing typed domain error contracts for security and subscription checkout/provider flows (`security.errors.ts`, `subscriptions.errors.ts`), replacing raw string error throws in services/payments, and switching profile controllers to code-based mapped error handling.
- 2026-04-15: Completed `OPTC-06` normalization-core slice by expanding shared API symbol/base-currency helpers (`normalizeBaseCurrency`, `normalizeSymbolStrict`, list helper widening) in `lib/symbols.ts` and adding dedicated helper tests to lock behavior before runtime/wallet/icons module migrations.
- 2026-04-16: Completed `OPTC-07` engine migration by replacing local runtime/engine symbol/base-currency uppercase normalization with shared helpers (`normalizeSymbol`, `normalizeBaseCurrency`, `normalizeSymbols`) across execution and runtime orchestration services while preserving indicator-name uppercase semantics.
- 2026-04-16: Completed `OPTC-08` wallets/markets/icons/stream migration by removing remaining production `trim().toUpperCase()` normalization variants in targeted modules and wiring them to shared `lib/symbols` helpers, including worker-side dynamic subscription symbol normalization.
- 2026-04-16: Completed `OPTC-09` by strengthening shared API normalization regression contracts in `apps/api/src/lib/symbols.test.ts` (idempotency, fallback hardening when both input and fallback are blank, deterministic order-insensitive list normalization, and non-mutating whitelist/blacklist behavior in `resolveUniverseSymbols`), validated with API typecheck and focused symbols test suite.
- 2026-04-16: Completed `OPTC-10` by introducing unified UI error resolution in `apps/web/src/lib/errorResolver.ts`, deprecating the `handleError/getAxiosMessage` split via compatibility wrappers, and wiring shared form error mapping to the new resolver with focused unit coverage.
- 2026-04-16: Completed `OPTC-11` by standardizing create-page async/error flow for markets/strategies/backtests using shared `runAsyncWithState` and `resolveUiErrorMessage` helpers with aligned fallback messaging and pending submit guard on strategy create action.
- 2026-04-16: Completed `OPTC-12` by migrating dashboard edit/list flows (`markets`, `strategies`, `wallets`) to shared async/error helpers, removing duplicated loading/finally/error parsing blocks and aligning save/load fallback handling with pending-submit guards on edit actions.
- 2026-04-16: Completed `OPTC-13` by introducing workspace shared exchange contract package (`@cryptosparrow/shared`) and migrating API exchange capability core to consume canonical shared constants/matrices for exchange options, capabilities, market types, and base-currency fallbacks.
