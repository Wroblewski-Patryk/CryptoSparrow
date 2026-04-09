# Post-Remediation Architecture Delta and Residual Risk Summary (2026-04-09)

Scope: `SAR-10..SAR-14` and `ARM-01..ARM-17` delivery wave.

## 1. Architecture Delta (Before -> After)

### Runtime engine (`apps/api/src/modules/engine`)
- Before: `runtimeSignalLoop.service.ts` mixed market data ingestion, decision logic, risk gating, session lifecycle, watchdog, and execution orchestration.
- After: runtime orchestration is split across dedicated modules:
  - `runtimeSignalDecisionEngine.ts` (decision logic),
  - `runtimeSignalMarketDataGateway.ts` (market data and supplemental series),
  - narrowed `runtimeSignalLoop.service.ts` focused on stream/session/execution coordination.

### Backtest pipeline (`apps/api/src/modules/backtests`)
- Before: `backtests.service.ts` mixed IO, run scheduling, simulation orchestration, and reporting concerns.
- After:
  - `backtestDataGateway.ts` owns historical/supplemental fetch strategy,
  - `backtestRunJob.ts` owns progress + run execution lifecycle,
  - queue-backed kickoff path replaced ad-hoc `setTimeout` flow.

### Bots domain (`apps/api/src/modules/bots`)
- Before: one god-service (`bots.service.ts`) blended command writes and runtime read-model assembly.
- After:
  - command/read split (`botsCommand.service.ts`, `botsRuntimeRead.service.ts`),
  - runtime symbol enrichment/read-model composition extracted,
  - repository boundaries reduced orchestration-layer direct Prisma coupling.

### Web containers
- `BotsManagement`:
  - Before: data loading, command handlers, assistant orchestration, monitoring orchestration, and rendering in one file.
  - After: orchestration moved to feature hooks:
    - `useBotsListController`,
    - `useBotsAssistantController`,
    - `useBotsMonitoringController`.
- `HomeLiveWidgets`:
  - Before: one component handled runtime loading, refresh loops, stream handling, filters/sort/pagination state, and rendering.
  - After: controller/data lifecycle moved to:
    - `useHomeLiveWidgetsController`,
    with section components preserved as visual layer (`RuntimeDataSection`, `RuntimeSignalsSection`, `RuntimeSidebarSection`, `RuntimeOnboardingSection`).
- Dashboard route wrappers:
  - duplicated inline locale dictionaries removed from backtests wrappers (`list/create/details`) in favor of shared i18n keys.

### Guardrails
- Before: file-size policy relied on per-file architecture exceptions.
- After:
  - per-file exceptions removed,
  - app-level source budgets enforced in quality gate (`api: 90k`, `web: 105k`) via `scripts/repoGuardrails.mjs`.

## 2. Current Risk Posture

Overall posture improved from monolith hotspots to explicit responsibility boundaries in API and web runtime containers, with quality gate now exception-free at file path granularity.

## 3. Residual Risks (Open)

1. `apps/web/src/features/backtest/components/BacktestRunDetails.tsx` remains a large hotspot (~104k bytes).
2. `apps/web/src/i18n/translations.ts` remains large and central; future schema growth can slow iteration and review.
3. Dashboard runtime tests still emit noisy `AggregateError` logs under JSDOM despite green assertions; this reduces signal quality in CI logs.
4. Some dashboard route wrappers outside backtests still keep page-local locale branching patterns; partial consolidation remains.

## 4. Recommended Follow-up (V1.1+)

1. Continue Backtest details decomposition (`timeline`, `markets`, `report` controller hooks and view sections) to bring `BacktestRunDetails.tsx` under baseline budget.
2. Split translation bundle into feature namespaces loaded per route/module while preserving typed key contract.
3. Stabilize runtime UI tests by hardening/mock-isolating network/event-source surfaces to eliminate noisy JSDOM transport errors.
4. Finish wrapper i18n normalization for remaining dashboard route pages (markets/strategies/wallets) where shared keys already exist.

