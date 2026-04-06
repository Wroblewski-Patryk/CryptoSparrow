# Venue Context Creator/Runtime Smoke (2026-04-06)

## Scope
- Backtest creator venue context visibility (`exchange`, `marketType`, `baseCurrency`).
- Bot creator venue context and LIVE API key compatibility hints.
- End-to-end venue consistency from backtest seed context to PAPER/LIVE bot path.

## Environment
- Date: 2026-04-06
- Workspace: `C:\Personal\Projekty\Aplikacje\CryptoSparrow`
- Branch: `main`

## Smoke Checklist
- [x] Backtest creator shows explicit bound venue context card and guidance copy.
- [x] Bot creator shows LIVE API key compatibility state for selected exchange.
- [x] Bot creator blocks active LIVE submit when no compatible key is configured.
- [x] Backtest run with `marketUniverseId` overrides conflicting request seed venue fields.
- [x] Venue context stays consistent in e2e flow: backtest -> paper bot -> live bot/order.

## Evidence (Commands)
- `pnpm --filter web exec vitest run src/features/backtest/components/BacktestCreateForm.test.tsx src/features/bots/components/BotCreateEditForm.test.tsx`
  - Result: PASS (`5 passed`).
- `pnpm --filter web run typecheck`
  - Result: PASS.
- `pnpm --filter api test -- src/modules/backtests/backtests.e2e.test.ts -t "3-symbol market-group" --testTimeout=30000`
  - Result: PASS (`1 passed`, filtered scenario).
- `pnpm --filter api test -- src/modules/backtests/backtests.e2e.test.ts -t "keeps venue context consistent across backtest -> paper bot -> live order path" --testTimeout=30000`
  - Result: PASS (`1 passed`, filtered scenario).
- `pnpm --filter api run typecheck`
  - Result: PASS.

## Notes
- Smoke was executed with targeted creator/runtime contract scenarios to keep tiny-commit scope.
- No venue-context contract regressions were observed in covered flows.
