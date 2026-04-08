# Indicator Implementation Runbook

Status: active
Purpose: safe, repeatable process for adding the next indicator/pattern end-to-end without breaking builder/runtime/backtest parity.

## 1) Preflight

Before coding, confirm all three contracts:

- Registry contract: `docs/architecture/indicator-registry-parity-contract.md`
- Strategy parity contract: `docs/architecture/strategy-evaluation-parity-contract.md`
- Active execution queue: `docs/planning/mvp-next-commits.md`

Also classify the new item:

- Group: `Trend | Momentum/Oscillator | Volatility | Volume | Price Action | Candle Patterns | Derivatives`
- Data dependency: `CLOSE | OHLC | OHLCV | DERIVATIVES`
- Output shape: `single value | multi-channel | boolean pattern`

## 2) Canonical Registry Update

### API catalog metadata

Update:

- `apps/api/src/modules/strategies/indicators/indicators.data.ts`

Add:

- `name`
- `group`
- `type`
- `params` (with safe defaults and min/max bounds)

Rule: do not expose placeholders in catalog unless evaluator/runtime/backtest support is implemented in the same delivery track.

### Web taxonomy mapping

Update (if needed):

- `apps/web/src/features/strategies/utils/indicatorTaxonomy.ts`

Ensure canonical group mapping and EN/PL labels are still correct.

## 3) Shared Evaluator/Compute Wiring

Primary files:

- `apps/api/src/modules/engine/sharedIndicatorSeries.ts`
- `apps/api/src/modules/engine/strategySignalEvaluator.ts`

Requirements:

- deterministic period/param normalization
- null-safe series behavior
- fail-closed rule evaluation for insufficient data
- cache key stability (`Map` keys include meaningful params/channels)

For patterns:

- use shared pattern engine:
  - `apps/api/src/modules/engine/sharedCandlePatternSeries.ts`

## 4) Runtime Signal Path

Update runtime path:

- `apps/api/src/modules/engine/runtimeSignalLoop.service.ts`

Checklist:

- final-candle decision path can resolve the new series
- signal summary shows meaningful values
- market-type restrictions are respected (`SPOT` vs `FUTURES`)
- derivatives sources use explicit fail-closed fallback when snapshots are missing

## 5) Backtest Replay + Timeline

Update:

- `apps/api/src/modules/backtests/backtests.service.ts`
- `apps/api/src/modules/backtests/backtestReplayCore.test.ts`
- `apps/api/src/modules/backtests/backtestIndicatorTimelineSeries.test.ts`

Checklist:

- parser recognizes indicator and channels
- timeline exposes deterministic series keys/panels/points
- replay evaluator uses same semantics as runtime evaluator
- multi-channel indicators render as coherent overlays in UI
- boolean patterns are available for marker rendering in timeline

## 6) Web Timeline Rendering (when needed)

Update:

- `apps/web/src/features/backtest/components/BacktestRunDetails.tsx`
- helper utilities under `apps/web/src/features/backtest/utils/`

Checklist:

- price overlays support multiple lines (for multi-channel indicators)
- oscillator overlays group sibling channels on one panel
- boolean pattern series render as markers on candles

## 7) Required Test Pack

Run targeted tests before commit:

```bash
pnpm --filter api test -- src/modules/engine/strategySignalEvaluator.test.ts
pnpm --filter api test -- src/modules/backtests/backtestReplayCore.test.ts
pnpm --filter api test -- src/modules/backtests/backtestIndicatorTimelineSeries.test.ts
pnpm --filter api test -- src/modules/backtests/backtestParity3Symbols.test.ts
pnpm --filter api typecheck
```

If web timeline/taxonomy changed:

```bash
pnpm --filter web test -- src/features/backtest/components/BacktestRunDetails.test.tsx
pnpm --filter web test -- src/features/strategies/components/StrategyFormSections/Indicators.test.tsx
pnpm --filter web typecheck
```

## 8) Parity Evidence (Mandatory)

Run and attach evidence for side-by-side 3-symbol parity:

```bash
pnpm --filter api test -- src/modules/backtests/backtestParity3Symbols.test.ts
```

Attach/update evidence doc under `docs/operations/` (timestamped file), for example:

- `docs/operations/indicator-3symbol-parity-evidence-YYYY-MM-DD.md`

Document:

- command used
- pass/fail summary
- families covered
- symbols used in the deterministic scenario set

## 9) Planning + Tiny-Commit Closure

After each task commit:

- update `docs/planning/mvp-next-commits.md`
- update checkbox + progress log in `docs/planning/mvp-execution-plan.md`
- update `docs/planning/indicator-expansion-implementation-plan-2026-04-07.md` (or current active plan)

Keep one logical change per commit. Do not mix feature/refactor/test/docs in one commit unless the task explicitly requires it.

## 10) Fast Rollback

If parity or runtime regressions appear:

1. Revert the latest indicator commit only.
2. Re-run the parity suite and typecheck.
3. Keep indicator hidden from API catalog until fixed.
4. Record root cause and follow-up in planning progress log.
