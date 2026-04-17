# Backtest Multi-Market Parity Remediation Plan (2026-04-17)

Status: planned  
Execution mode: tiny-commit only (one task per commit)

## Goal
- Restore deterministic backtest behavior so symbol-level outcomes are stable and understandable for 1, 3, or 50 markets.
- Remove timeline/report inconsistencies caused by window drift and stale progress anchors.
- Lock explicit contracts for chart-window semantics versus run totals semantics.

## Verified Findings (From Audit + Code Pointers)
- Double adaptive `maxCandles` reduction (applied twice):
  - `apps/api/src/modules/backtests/backtests.service.ts` (around lines `1163`, `1192`)
  - `apps/api/src/modules/backtests/backtestRunJob.ts` (around line `207`)
- Timeline end anchor derived from `liveProgress.currentCandleTime` in completed runs:
  - `apps/api/src/modules/backtests/backtests.service.ts` (around lines `1253`, `1260`)
  - `apps/api/src/modules/backtests/backtestRunJob.ts` (around line `337`)
- Pair timeline replay depends on portfolio context (all symbols) instead of symbol-isolated context:
  - `apps/api/src/modules/backtests/backtests.service.ts` (around lines `296`, `404`, `1252`, `1326`)
- DB cache candle path validates only count, not interval continuity:
  - `apps/api/src/modules/backtests/backtestDataGateway.ts` (around line `169`)
- UI pair stats can diverge from persisted run totals due to timeline-events fallback:
  - `apps/web/src/features/backtest/components/BacktestRunDetails.tsx` (around line `1960`)
  - `apps/web/src/features/backtest/hooks/useBacktestRunCoreData.ts` (around line `88`)

## Product/Contract Direction (For This Wave)
1. One effective candle window per run (`effectiveMaxCandles`) must be computed exactly once and reused everywhere (job, timeline, report).
2. Timeline anchor for terminal statuses (`COMPLETED/FAILED/CANCELED`) must not rely on single-symbol `liveProgress.currentCandleTime`.
3. Symbol chart/timeline endpoint must support deterministic symbol-isolated replay context; UI default should be isolated for pair diagnostics.
4. Run totals remain run-level portfolio truth from persisted trades; chart window metrics are presented separately to avoid ambiguity.

## Execution Groups (Commit Batches)
- `BTMM-A` (`BTMM-01..BTMM-05`): contract freeze + P0/P1 core engine fixes.
- `BTMM-B` (`BTMM-06..BTMM-10`): cache continuity + UI/source-of-truth alignment + regression suite.
- `BTMM-C` (`BTMM-11..BTMM-12`): confidence pack + closure evidence.

## Tiny-Commit Task Queue

### BTMM-01
`docs(contract): freeze multi-market parity semantics (isolated symbol timeline vs run totals)`
- Update canonical decision docs for:
  - `effectiveMaxCandles` single-adaptation rule,
  - terminal timeline anchor contract,
  - default symbol timeline context (`isolated`),
  - run totals vs chart-window metrics separation.

### BTMM-02
`test(api-backtest-red): add failing reproducible contract for 1-symbol vs 50-symbol parity on same target symbol`
- Add deterministic fixture proving current divergence.
- Cover open/manage/close event sequence and symbol-level pnl deltas.

### BTMM-03
`fix(api-backtest-window): remove double adaptive maxCandles and persist one effective window`
- Compute adaptation once.
- Persist `effectiveMaxCandles` on run snapshot/metadata.
- Reuse same value in job execution and timeline/report reads.

### BTMM-04
`fix(api-backtest-timeline-anchor): use deterministic terminal run end anchor instead of stale liveProgress`
- For terminal runs, anchor timeline end by stable run-level terminal boundary (not last-progress symbol).
- Keep in-progress behavior unchanged where needed.

### BTMM-05
`fix(api-backtest-replay-context): add symbol-isolated replay mode and make pair timeline deterministic by default`
- Add explicit replay context parameter (`isolated|portfolio`).
- Default pair timeline endpoint to `isolated` mode for diagnostics stability.
- Keep optional portfolio mode for advanced comparisons.

### BTMM-06
`fix(api-backtest-cache): validate candle interval continuity in DB cache and fallback on gaps`
- Add interval continuity check for fetched cache candles.
- Trigger API/backfill path when gaps are detected.

### BTMM-07
`refactor(web-backtest-stats): separate run totals from chart-window stats in core data hooks`
- Ensure run totals use persisted run/report trades.
- Keep chart-window metrics explicitly scoped to chart range source.

### BTMM-08
`feat(web-backtest-ui): expose run totals vs chart-window source labels in BacktestRunDetails`
- Add explicit UX labels so users see which numbers are global run totals and which are chart-scope.

### BTMM-09
`test(api-backtest-window): add regression for single adaptation of effectiveMaxCandles`
- Lock against reintroduction of second adaptation stage.

### BTMM-10
`test(api-backtest-anchor-cache): add regressions for stale currentCandleTime and cache-gap fallback`
- Tests:
  - stale `currentCandleTime` must not truncate completed timeline,
  - cache gaps must force backfill path.

### BTMM-11
`qa(confidence-pack): execute focused backtest parity pack (1 vs 3 vs 50 markets)`
- Run deterministic suites and capture evidence artifacts.
- Include API + web timeline/details checks.

### BTMM-12
`docs(closure): publish remediation evidence and sync canonical queues/plans`
- Publish closure note and evidence paths.
- Update `mvp-next-commits` + `mvp-execution-plan`.

## Validation Commands (Agent Checklist)
- API targeted suites:
  - `pnpm --filter api test -- src/modules/backtests/backtestReplayCore.test.ts src/modules/backtests/backtests.e2e.test.ts`
  - `pnpm --filter api test -- src/modules/backtests/backtestParity3Symbols.test.ts`
- Web targeted suites:
  - `pnpm --filter web test -- src/features/backtest/components/BacktestRunDetails.test.tsx`
- Typecheck/build:
  - `pnpm --filter api run typecheck`
  - `pnpm --filter web run typecheck`
  - `pnpm --filter api build`
  - `pnpm --filter web run build`

## Acceptance Criteria
1. Same symbol timeline diagnostics are deterministic regardless of market-group size (1/3/50) in isolated replay mode.
2. `effectiveMaxCandles` is computed once and reused consistently across run job, report, and timeline.
3. Completed/failed/canceled timeline ranges are not truncated by stale single-symbol progress markers.
4. Cache gap detection prevents non-continuous candle windows from silently driving replay.
5. UI clearly distinguishes run totals from chart-window scoped metrics.

