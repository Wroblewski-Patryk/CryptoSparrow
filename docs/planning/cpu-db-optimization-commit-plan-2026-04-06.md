# CPU/DB Optimization Commit Plan (2026-04-06)

Status: ready for execution  
Owner: API + Web + Ops  
Scope: runtime CPU hot path, DB pressure, dashboard polling pressure, worker scalability.

## Execution protocol (for next AI executor)

1. Trigger phrase: user says `zrob nastepna grupe zadan`.
2. Pick first unchecked group from `## GROUPS`.
3. Execute commits from that group in order, one commit at a time (no mixed commits).
4. After each commit:
   - run targeted tests listed in commit item,
   - update this file (checkbox + short progress note),
   - keep changes tiny and reversible.
5. Stop after whole group is done and report:
   - files changed,
   - tests run,
   - risk notes,
   - next unchecked group.

## Guardrails

- No behavior drift in trading decisions, order lifecycle, or API contracts.
- Prefer feature flags for risky runtime-path changes.
- For cache-based optimizations: parity tests before and after optimization.
- No broad refactors outside listed files.

## Target outcomes (acceptance)

- Reduce DB reads on final-candle processing path by at least 40%.
- Reduce runtime telemetry writes (`touchSession` + stat upserts) by at least 60% during active sessions.
- Reduce dashboard/bots monitoring polling DB load by at least 35%.
- Keep decision parity (same OPEN/DCA/CLOSE outcomes on regression suite).

## GROUPS

### [x] Group 1 - Baseline and safety rails

- [x] `CPDB-01 docs(contract): freeze optimization contract + feature-flag matrix`
  - Files:
    - `docs/planning/open-decisions.md`
    - `docs/governance/working-agreements.md`
  - Deliverable:
    - Add explicit flags for runtime cache, telemetry throttle, adaptive polling.
  - Tests:
    - none (docs only)

- [x] `CPDB-02 feat(api-observability): add runtime hot-path timing/counter metrics`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
    - `apps/api/src/modules/engine/preTrade.service.ts`
    - `apps/api/src/modules/engine/runtimeTelemetry.service.ts`
    - `apps/api/src/modules/engine/runtimeMetrics.service.ts` (new)
  - Deliverable:
    - Metrics for `listActiveBots`, `eligibleGroupsCount`, `preTradeLatencyMs`, `touchSessionWrites`, `symbolStatsWrites`.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`
    - `pnpm --filter api test -- preTrade`

- [x] `CPDB-03 test(api-metrics): regression coverage for metrics emission without behavior drift`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.test.ts`
    - `apps/api/src/modules/engine/preTrade.service.test.ts`
    - `apps/api/src/modules/engine/runtimeTelemetry.service.test.ts` (new if missing)
  - Deliverable:
    - Assert metrics emitted and strategy decisions unchanged.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop preTrade runtimeTelemetry`

### [x] Group 2 - Runtime topology cache (biggest CPU/DB win)

- [x] `CPDB-04 feat(runtime-cache): add active bot topology cache with TTL + invalidation`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
    - `apps/api/src/modules/engine/runtimeTopologyCache.service.ts` (new)
  - Deliverable:
    - Cache output of active-bot topology query.
    - Invalidate on bot state/strategy/market-group changes.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`

- [x] `CPDB-05 refactor(runtime-signal): consume cache instead of per-candle DB topology query`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
  - Deliverable:
    - Replace direct `listActiveBots()` call in final-candle path with cache read.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`

- [x] `CPDB-06 test(runtime-parity): parity tests for cache hits/misses and invalidation flow`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.test.ts`
  - Deliverable:
    - Ensure identical OPEN/DCA/CLOSE for cache miss vs cache hit scenarios.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`

### [ ] Group 3 - Signal routing + pre-trade DB short-circuit

- [ ] `CPDB-07 feat(runtime-routing): build seriesKey -> eligible group index`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
  - Deliverable:
    - On topology refresh, precompute index for `(marketType|symbol|interval)`.
    - Final candle processes only relevant groups.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`

- [ ] `CPDB-08 feat(pretrade-cache): add open-position count cache with event invalidation`
  - Files:
    - `apps/api/src/modules/engine/preTrade.service.ts`
    - `apps/api/src/modules/engine/executionOrchestrator.service.ts`
  - Deliverable:
    - Cache `countOpenPositionsForBotAndSymbols` for short TTL.
    - Invalidate on OPEN/CLOSE execution outcome.
  - Tests:
    - `pnpm --filter api test -- preTrade executionOrchestrator`

- [ ] `CPDB-09 test(pretrade-parity): preserve risk caps while reducing DB roundtrips`
  - Files:
    - `apps/api/src/modules/engine/preTrade.service.test.ts`
  - Deliverable:
    - Assert no over-open positions after cache introduction.
  - Tests:
    - `pnpm --filter api test -- preTrade`

### [ ] Group 4 - Telemetry write reduction + execution query cleanup

- [ ] `CPDB-10 refactor(telemetry): throttle touchSession + batch symbol stats writes`
  - Files:
    - `apps/api/src/modules/engine/runtimeTelemetry.service.ts`
  - Deliverable:
    - `touchSession` at most once per configurable window (default 15s/session).
    - Batch/debounce symbol stat upserts.
  - Tests:
    - `pnpm --filter api test -- runtimeTelemetry`

- [ ] `CPDB-11 refactor(execution): remove redundant strategy leverage query on OPEN`
  - Files:
    - `apps/api/src/modules/engine/executionOrchestrator.service.ts`
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
  - Deliverable:
    - Pass leverage from decision context; delete extra `strategy.findFirst` path.
  - Tests:
    - `pnpm --filter api test -- executionOrchestrator runtimeSignalLoop`

- [ ] `CPDB-12 test(engine-load): verify DB write/read count drop for telemetry+execution paths`
  - Files:
    - `apps/api/src/modules/engine/runtimeTelemetry.service.test.ts`
    - `apps/api/src/modules/engine/executionOrchestrator.service.test.ts`
  - Deliverable:
    - Query-count assertions in critical flow tests.
  - Tests:
    - `pnpm --filter api test -- runtimeTelemetry executionOrchestrator`

### [ ] Group 5 - Web polling pressure reduction

- [ ] `CPDB-13 feat(web-polling): adaptive refresh (active tab: 10s, hidden tab: 30s)`
  - Files:
    - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
    - `apps/web/src/features/bots/components/BotsManagement.tsx`
  - Deliverable:
    - Replace fixed 5s interval with visibility-aware polling strategy.
  - Tests:
    - `pnpm --filter web test -- HomeLiveWidgets BotsManagement`

- [ ] `CPDB-14 feat(web-stream): move runtime stats refresh to SSE-first with polling fallback`
  - Files:
    - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.tsx`
    - `apps/web/src/features/bots/components/BotsManagement.tsx`
    - `apps/api/src/modules/dashboard/*` (only if endpoint extension needed)
  - Deliverable:
    - Runtime cards/stat tables use push updates where possible.
  - Tests:
    - `pnpm --filter web test -- HomeLiveWidgets BotsManagement`
    - `pnpm --filter api test -- dashboard`

- [ ] `CPDB-15 test(web-runtime-load): regression tests for refresh cadence + stale recovery`
  - Files:
    - `apps/web/src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
    - `apps/web/src/features/bots/components/BotsManagement.test.tsx`
  - Deliverable:
    - Assert cadence, tab visibility behavior, and fallback correctness.
  - Tests:
    - `pnpm --filter web test -- HomeLiveWidgets BotsManagement`

### [ ] Group 6 - DB indexing and query shaping

- [ ] `CPDB-16 feat(db-index): add hot-path indexes for positions/runtime queries`
  - Files:
    - `apps/api/prisma/schema.prisma`
    - `apps/api/prisma/migrations/*` (new migration)
  - Deliverable:
    - Add composite indexes for frequent filters:
      - `Position(userId, botId, status)`
      - `Position(userId, symbol, status)`
      - add only confirmed hot paths from Group 1 metrics.
  - Tests:
    - `pnpm --filter api prisma migrate dev`
    - `pnpm --filter api test -- bots runtime`

- [ ] `CPDB-17 refactor(api-query): slim topology read query to minimal selected fields`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
  - Deliverable:
    - Reduce selected nested fields to those required for signal/evaluation path.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`

- [ ] `CPDB-18 qa(explain): snapshot EXPLAIN ANALYZE before/after for top runtime queries`
  - Files:
    - `docs/planning/cpu-db-explain-baseline-2026-04-06.md` (new)
  - Deliverable:
    - Attach query plans and observed deltas for hot SQL paths.
  - Tests:
    - manual SQL verification on dev db

### [ ] Group 7 - Worker backpressure and horizontal scale safety

- [ ] `CPDB-19 feat(runtime-backpressure): per-series concurrency guard and bounded queue`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
  - Deliverable:
    - Prevent unbounded parallel signal evaluation under burst load.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop`

- [ ] `CPDB-20 feat(redis-lock): distributed warmup lock for multi-worker replicas`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`
    - `apps/api/src/modules/market-stream/*` (if integration needed)
  - Deliverable:
    - Ensure warmup/fetch-once semantics per `seriesKey` across replicas.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop marketStream`

- [ ] `CPDB-21 test(concurrency): stress regression for shared symbol/interval across many bots`
  - Files:
    - `apps/api/src/modules/engine/runtimeSignalLoop.service.test.ts`
    - `apps/api/src/modules/market-stream/marketStreamFanout.test.ts` (new/extend)
  - Deliverable:
    - Scenario: 5 users x 3 bots; same `BTCUSDT/5m`; assert no duplicate processing side effects.
  - Tests:
    - `pnpm --filter api test -- runtimeSignalLoop marketStreamFanout`

### [ ] Group 8 - Rollout, SLO, and handoff closure

- [ ] `CPDB-22 docs(runbook): staged rollout + feature-flag enable sequence + rollback`
  - Files:
    - `docs/planning/v1-live-release-plan.md`
    - `docs/governance/working-agreements.md`
  - Deliverable:
    - Canary order for flags and rollback matrix.
  - Tests:
    - none (docs only)

- [ ] `CPDB-23 feat(obs-alerts): define CPU/DB/runtime-lag alert thresholds and dashboards`
  - Files:
    - `docs/planning/open-decisions.md`
    - ops config files if present (`deploy`, `monitoring`, etc.)
  - Deliverable:
    - Alert thresholds for p95 latency, DB QPS, runtime event lag, restart bursts.
  - Tests:
    - manual ops validation

- [ ] `CPDB-24 qa(soak): 30-minute load soak + evidence note`
  - Files:
    - `docs/planning/mvp-execution-plan.md`
    - `docs/planning/mvp-next-commits.md`
  - Deliverable:
    - Record pre/post metrics and conclusion.
  - Tests:
    - scripted/manual soak report

## Progress log

- 2026-04-06: Plan created. No implementation started yet.
- 2026-04-16: Completed `CPDB-01` by locking runtime optimization feature-flag matrix and rollout/rollback guardrails in canonical governance docs (`open-decisions`, `working-agreements`).
- 2026-04-16: Completed `CPDB-02` by introducing runtime hot-path metrics instrumentation (`listActiveBots`, `eligibleGroupsCount`, `preTradeLatencyMs`, `touchSessionWrites`, `symbolStatsWrites`) across runtime signal loop, pre-trade path, telemetry writes, and `/metrics` snapshot contract.
- 2026-04-16: Completed `CPDB-03` by adding regression tests for hot-path metric emission in runtime signal loop, pre-trade analysis, telemetry writes, and metrics endpoint contract without changing decision behavior.
- 2026-04-16: Closed Group 1 (`CPDB-01..CPDB-03`). Next unchecked group is Group 2 (`CPDB-04..CPDB-06`).
- 2026-04-16: Completed `CPDB-04` by adding runtime topology cache service with TTL (`RUNTIME_TOPOLOGY_CACHE_TTL_MS`), feature-flag gate (`RUNTIME_TOPOLOGY_CACHE_ENABLED`), topology-version invalidation based on bot/group/strategy graph updates, and runtime loop invalidation hooks on stop/stall.
- 2026-04-16: Completed `CPDB-05` by switching final-candle topology reads to cache-backed path (`listActiveBotsFromTopologyCache`) with fail-safe fallback to direct query on cache read errors.
- 2026-04-16: Completed `CPDB-06` by adding parity regression coverage for topology cache hit path, cache-failure direct-query fallback path, and invalidation-driven topology refresh behavior in runtime final-candle flow.
- 2026-04-16: Closed Group 2 (`CPDB-04..CPDB-06`). Next unchecked group is Group 3 (`CPDB-07..CPDB-09`).
