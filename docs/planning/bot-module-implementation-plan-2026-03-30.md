# Bot Module Implementation Plan (BMOD) - 2026-03-30

Status: active implementation plan, tiny-commit mode.

## Objective
Deliver a production-safe bot module that reuses shared backtest/runtime logic while simplifying bot creation and runtime monitoring.

## Hard Constraints (locked)
- Only two bot modes are allowed: `PAPER` and `LIVE`.
- Bot creator uses `Strategy` + `Market Group` selection.
- `paperStartBalance` is visible only in `PAPER` mode.
- `positionMode` is removed from bot-creator flow for now.
- `maxOpenPositions` is not user-entered in bot creator; value is derived from strategy risk config.
- Runtime should be websocket-first.
- Bot monitoring view is table/statistics driven without heavy candlestick charts.
- No unrelated feature/UX changes outside bot module scope.

## Runtime Semantics (locked)
- Strategy decision trigger: closed/final candle stream events.
- Position management trigger: ticker stream events (for open position lifecycle automation).
- Scan loop is fallback watchdog only and disabled by default in normal operation.
- Shared logic sources remain mandatory:
  - shared execution decision core,
  - shared strategy evaluator,
  - shared position lifecycle manager.

## Commit Sequence (one task = one commit)

## Phase A - Contract and Preflight
- [x] `BMOD-01 docs(contract): freeze Bot V2 create/update payload and migration invariants`
- [x] `BMOD-02 docs(decisions): lock websocket-first bot signal policy and no-chart monitoring scope`
- [x] `BMOD-03 chore(audit): add preflight report script for LOCAL bots and legacy bot-strategy bindings`
- [x] `BMOD-04 test(baseline): pin current bot api/ui/runtime baseline tests before refactor`
## Phase B - API and Domain Contract Refactor
- [x] `BMOD-05 refactor(api-types): remove LOCAL from bot mode zod/types contract`
- [x] `BMOD-06 feat(api-compat): add temporary LOCAL->PAPER read-compat adapter for transition window`
- [x] `BMOD-07 refactor(api-create): switch bot create contract to Strategy + MarketGroup payload`
- [x] `BMOD-08 feat(api-create): create bot + botMarketGroup + strategyLink in one transaction`
- [x] `BMOD-09 refactor(api-derive): derive bot marketType from selected market-group universe`
- [x] `BMOD-10 refactor(api-write): remove positionMode from bot write payload contract`
- [x] `BMOD-11 refactor(api-write): remove bot-level maxOpenPositions input contract`
- [x] `BMOD-12 test(api): extend bots e2e coverage for new create/edit payload and ownership checks`

## Phase C - Web Bot Creator Refactor
- [x] `BMOD-13 refactor(web-types): remove LOCAL and legacy creator-only fields from bot types`
- [x] `BMOD-14 feat(web-data): load market groups into bot creator`
- [x] `BMOD-15 feat(web-creator): create V2 form with Strategy + MarketGroup selectors`
- [x] `BMOD-16 feat(web-creator): make paperStartBalance visible only for PAPER mode`
- [x] `BMOD-17 feat(web-creator): remove positionMode and maxOpenPositions inputs from UI`
- [x] `BMOD-18 feat(web-creator): add derived strategy summary (interval/leverage/max-open)`
- [x] `BMOD-19 test(web): update BotsManagement tests for new payload and mode-conditional behavior`

## Phase D - Runtime Parity and Stream-First Execution
- [x] `BMOD-20 refactor(runtime-signal): evaluate entry/exit strategy decisions only on final candle events`
- [x] `BMOD-21 refactor(runtime-lifecycle): keep ticker path for open-position automation only`
- [x] `BMOD-22 feat(runtime-idempotency): add deterministic dedupe key per bot/group/symbol/candle window`
- [x] `BMOD-23 feat(runtime-risk): compute group max-open cap from active strategy risk settings`
- [x] `BMOD-24 refactor(runtime-model): remove runtime dependency on legacy bot-strategy fallback graph`
- [x] `BMOD-25 feat(runtime-watchdog): keep scan loop as disabled-by-default fallback watchdog`
- [x] `BMOD-26 test(runtime): extend signal-loop and watchdog tests for websocket-first semantics`
- [x] `BMOD-27 test(parity): add bot-paper vs backtest decision parity regression suite`

## Phase E - Bot Monitoring (No Candlestick Charts)
- [x] `BMOD-28 feat(db): add bot runtime session model for run-like monitoring windows`
- [x] `BMOD-29 feat(db): add bot runtime event model for lifecycle trace storage`
- [x] `BMOD-30 feat(db): add bot runtime per-symbol stats snapshot model`
- [x] `BMOD-31 feat(runtime-telemetry): persist session/event/stat snapshots from runtime orchestrator`
- [x] `BMOD-32 feat(api-monitor): add endpoints for bot sessions list/detail`
- [x] `BMOD-33 feat(api-monitor): add endpoints for per-symbol stats and trades list (no chart payload)`
- [x] `BMOD-34 feat(web-monitor): add bot monitoring view with summary + pair stats + trades table`
- [x] `BMOD-35 feat(web-live-refresh): add lightweight auto-refresh for active bot sessions`
- [x] `BMOD-36 test(e2e): add end-to-end monitoring contract coverage for session/stat/trade data`

## Phase F - Migration Cleanup and Hardening
- [x] `BMOD-37 chore(data-migration): migrate legacy LOCAL modes and legacy botStrategy bindings to canonical model`
- [x] `BMOD-38 refactor(db): remove LOCAL enum from Prisma after successful migration verification`
- [x] `BMOD-39 docs(runbook): publish bot module operator runbook and manual smoke checklist`
- [x] `BMOD-40 release(gate): run full regression gate for bot/backtest/runtime and record evidence`

## Phase G - Operations UX Cleanup (Dashboard vs Bots)
- [x] `BOPS-01 docs(plan): lock IA split (Dashboard as global control center, Bots as runtime operations center)`
- [x] `BOPS-02 feat(web-monitor): restructure monitoring view into three operator blocks (Now / History / Future signals)`
- [x] `BOPS-03 feat(web-monitor): keep live refresh in-place without visual remount/flicker`
- [x] `BOPS-04 feat(web-bots-dashboard): expose active bots as operational cards with quick context switching`
- [x] `BOPS-05 feat(web-monitor): redesign activity stream into dense operational table (backtest-like readability)`
- [x] `BOPS-06 feat(web-creator): split bot creation form into three logical UX sections`
- [x] `BOPS-07 feat(api+web-guard): prevent duplicate active bot for same strategy + market-group`
- [x] `BOPS-08 feat(api+web-guard): prevent strategy edit while used by active bots`
- [x] `BOPS-09 feat(web-monitor): default to aggregated monitoring across sessions with optional advanced drilldown`
- [ ] `BOPS-10 feat(web-monitor): strengthen operational IA in Bots module (history/open/live-signals split) without runtime-behavior changes`
- [ ] `BOPS-11 feat(web-monitor): reduce controls clutter and optimize human operator workflow in runtime dashboard`

## Test Command Map (per phase)
- Phase A/B:
  - `pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts`
- Phase C:
  - `pnpm --filter web exec vitest run src/features/bots/components/BotsManagement.test.tsx`
- Phase D:
  - `pnpm --filter api test -- src/modules/engine/runtimeSignalLoop.service.test.ts src/modules/engine/runtimeScanLoop.service.test.ts src/modules/engine/paperLiveDecisionEquivalence.test.ts src/modules/backtests/backtestParity3Symbols.test.ts`
- Phase E/F:
  - `pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts src/modules/engine/runtime-flow.e2e.test.ts`
  - `pnpm --filter web exec vitest run src/features/bots/components/BotsManagement.test.tsx`
- Final gate:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

## Done Criteria
- Bot creator is reduced to required controls and produces canonical V2 payload.
- Runtime behavior is stream-first and parity-safe with shared decision contracts.
- Bot monitoring is available without heavy chart rendering and remains responsive for multi-pair bots.
- Legacy fallback paths are either removed or explicitly scoped to transition-only behavior.
- Full tests pass and operational docs are updated.
