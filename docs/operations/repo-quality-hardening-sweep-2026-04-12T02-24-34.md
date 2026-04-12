# Repo Quality Hardening Sweep

Date: 2026-04-12 02:24:34 +02:00
Scope: QH-08 final quality sweep after QH-01..QH-07

## Commands
1. pnpm run lint
2. pnpm --filter api run typecheck
3. pnpm --filter web run typecheck
4. pnpm run quality:guardrails

## Results
- Lint: PASS (no ESLint warnings/errors)
- API typecheck: PASS
- Web typecheck: PASS
- Guardrails: PASS (lockfile policy + source file budgets)

## Notes
- pps/api/src/modules/bots/bots.e2e.test.ts remains under API budget after split (85,749 bytes).
- pps/web/src/features/backtest/components/BacktestRunDetails.tsx remains under web budget after modularization (97,827 bytes).
