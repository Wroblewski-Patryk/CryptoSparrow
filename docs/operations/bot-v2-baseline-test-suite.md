# Bot V2 Baseline Test Suite

Status: pinned baseline before Bot V2 contract/runtime refactor (`BMOD-04`).

## Canonical command

```bash
pnpm run test:bot:v2:baseline
```

## Included suites

API:
- `src/modules/bots/bots.e2e.test.ts`
- `src/modules/engine/runtime-flow.e2e.test.ts`
- `src/modules/engine/runtimeSignalLoop.service.test.ts`
- `src/modules/engine/runtimeScanLoop.service.test.ts`
- `src/modules/engine/paperLiveDecisionEquivalence.test.ts`

Web:
- `src/features/bots/components/BotsManagement.test.tsx`

## Purpose

- freeze a deterministic pre-refactor safety gate,
- protect bot API contracts and runtime behavior while removing legacy fields,
- detect regressions in bot creator payload handling before V2 rollout.

## Last run snapshot

- Date: 2026-03-30
- Command: `pnpm run test:bot:v2:baseline`
- Result: PASS
- API: `61` test files passed, `278` tests passed
- Web: `1` test file passed, `5` tests passed
