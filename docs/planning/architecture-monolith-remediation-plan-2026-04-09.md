# Architecture Monolith Remediation Plan (2026-04-09)

Source: full-repository architecture audit (API + Web + worker boundaries)
Related queue: `docs/planning/mvp-next-commits.md`

## Objective
- Reduce architectural risk in oversized modules without behavior drift.
- Keep tiny, reversible commits with strict regression safety for trading-critical flows.
- Improve maintainability by separating orchestration, domain logic, and infrastructure access.

## Current Risk Snapshot
- Production files above `1000` lines: `8`.
- Production files above `500` lines: `19`.
- Largest hotspots:
  - `apps/web/src/features/backtest/components/BacktestRunDetails.tsx` (2457 lines)
  - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts` (2280 lines)
  - `apps/api/src/modules/backtests/backtests.service.ts` (2170 lines)
  - `apps/web/src/features/bots/components/BotsManagement.tsx` (1983 lines)
  - `apps/api/src/modules/bots/bots.service.ts` (1888 lines)
  - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx` (1484 lines)

## Top Findings
1. Runtime signal loop mixes stream lifecycle, market-data enrichment, signal evaluation, risk gates, and execution orchestration in one class.
2. Backtest service mixes data acquisition, simulation runtime, progress reporting, and report persistence in one module.
3. Bots service still behaves as a god-service for runtime read models and command paths.
4. Web feature containers (`BacktestRunDetails`, `BotsManagement`, `HomeLiveWidgets`) still combine data loading, state orchestration, calculations, and large JSX rendering blocks.
5. Guardrails still include budget exceptions for large files, so architectural debt can pass checks.

## Design Principles for Refactor
- Preserve public API contracts and UI behavior.
- Extract by responsibility, not by arbitrary line count.
- Keep domain logic pure where possible; keep IO behind dedicated gateway/repository modules.
- Add or keep regression tests for each extracted seam.
- Remove guardrail exceptions only after split completion.

## Delivery Waves (Tiny Commits)

### Wave A: Runtime Engine Decomposition
1. `ARM-01` create a dedicated decision engine module from `runtimeSignalLoop` signal evaluation paths.
2. `ARM-02` extract market-data gateway for warmup, funding, open-interest, and order-book fetch/merge logic.
3. `ARM-03` reduce `runtimeSignalLoop` to stream/session orchestration and execution coordination only.
4. `ARM-04` add/adjust runtime regression tests to lock behavior parity.

Exit criteria:
- Runtime tests pass for decision, watchdog, and stream-failure recovery paths.
- No execution parity drift in existing runtime regression suites.

### Wave B: Backtest Pipeline Decomposition
1. `ARM-05` extract `BacktestDataGateway` (`fetchKlines`, supplemental fetch, cache policy).
2. `ARM-06` extract `BacktestRunJob` for progress lifecycle and simulation orchestration.
3. `ARM-07` replace in-process `setTimeout` kickoff with queue-backed execution contract (worker-consumable path).
4. `ARM-08` keep report/trade parity tests green and extend where seams were moved.

Exit criteria:
- Backtest service becomes thin application facade.
- Backtest route behavior and result metrics stay stable.

### Wave C: Bots Runtime Read/Command Split
1. `ARM-09` split `bots.service.ts` into command service (`create/update/delete`) and runtime read service (`sessions/stats/trades/positions`).
2. `ARM-10` move runtime read composition and symbol-level enrichment behind dedicated read-model modules.
3. `ARM-11` reduce direct Prisma usage in orchestration services by pushing queries behind repository/read modules.

Exit criteria:
- `bots.service.ts` is no longer a mixed command/read god-service.
- Existing bots runtime e2e/tests remain green.

### Wave D: Web Container Decomposition
1. `ARM-12` decompose `BacktestRunDetails` into hooks (`useBacktestRunData`, `useBacktestTimeline`) and presentational sections.
2. `ARM-13` continue `BotsManagement` split by moving monitoring/assistant/bot-list orchestration to feature hooks.
3. `ARM-14` split `HomeLiveWidgets` into data/controller hooks and focused visual sections.
4. `ARM-15` remove duplicated inline locale dictionaries in route/page wrappers where shared i18n keys exist.

Exit criteria:
- Large feature containers drop below guardrail budget targets.
- UI behavior, loading states, and monitoring interactions remain unchanged.

### Wave E: Guardrail and Governance Closure
1. `ARM-16` remove file-size budget overrides in `scripts/repoGuardrails.mjs`.
2. `ARM-17` enforce updated size budget thresholds as a mandatory CI/local quality gate.
3. `ARM-18` capture final architecture delta and residual risks in planning/governance notes.

Exit criteria:
- `pnpm run quality:guardrails` passes without per-file size overrides for refactored hotspots.
- Planning queue reflects closure and follow-up risks.

## Validation Matrix (Per Commit)
- Impacted-unit tests for touched module.
- Relevant API/web integration tests for changed surfaces.
- `pnpm run quality:guardrails` for each wave boundary.
- Typecheck on impacted app(s).

## Rollback Policy
- If any runtime/backtest parity regression appears, rollback to previous commit and split the task further.
- Do not batch multiple extractions into one commit.
- Keep each commit focused on one seam extraction plus tests.

## Execution Notes
- Follow `docs/governance/working-agreements.md` (tiny commits, findings-first, evidence required).
- Keep `docs/planning/mvp-next-commits.md` `NOW` queue aligned with the next unresolved `ARM-*` task.
