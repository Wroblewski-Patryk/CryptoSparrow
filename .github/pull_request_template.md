## Summary
- Scope:
- Risk level: Low / Medium / High

## Automated Checks
- [ ] `pnpm run quality:guardrails`
- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm --filter api run test -- --run`
- [ ] `pnpm --filter web run test -- --run`
- [ ] `pnpm run build`
- Commands run:
  -
- Results:
  -

## Manual Smoke
- [ ] Authenticated dashboard path checked if UI or auth behavior changed
- [ ] Runtime or worker-sensitive path checked if execution behavior changed
- [ ] `pnpm i18n:audit:route-reachable:web` run if routes or copy changed
- [ ] deploy or rollback smoke reviewed if deployment behavior changed

Flows executed:
-

## Evidence Links
- Artifact folder or location:
- Screenshots:
- Logs:

## Context Updated
- [ ] `.codex/context/TASK_BOARD.md`
- [ ] `.codex/context/PROJECT_STATE.md`
- [ ] `.codex/context/LEARNING_JOURNAL.md` when needed
- [ ] `docs/` updated where relevant

## Rollback Plan
-
