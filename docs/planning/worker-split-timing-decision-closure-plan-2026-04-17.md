# Worker Split Timing Decision Closure Plan (2026-04-17)

Status: closed-2026-04-17  
Execution mode: tiny-commit (single-task commit)

## Problem
- `docs/planning/open-decisions.md` still contained unresolved section `Worker Split Timing`.
- Canonical topology docs already prefer API/worker process split for production, but threshold contract was not explicitly finalized.

## Goal
- Resolve `Worker Split Timing` as an explicit, operationally actionable decision.
- Keep decision consistent with existing deployment topology, SLO, and runtime alert contracts.

## Scope
1. `docs/planning/open-decisions.md`
2. `docs/planning/mvp-next-commits.md`
3. `docs/planning/mvp-execution-plan.md`
4. `docs/planning/v1-live-release-plan.md`

## Out of Scope
- Runtime implementation changes in API/worker code.
- Deployment topology refactor.
- Alert threshold code changes.

## Tiny Commit Task

### WSPLIT-01
`docs(decision): close Worker Split Timing with explicit split policy and thresholds`
- Required changes:
  - resolve open decision in `open-decisions.md`;
  - lock production policy (API/worker split mandatory);
  - define stage/dev trigger thresholds and escalation behavior;
  - sync canonical queue/plan files.
- Done when:
  - `Worker Split Timing` is marked resolved with concrete threshold contract;
  - queue/execution plan reflects closed task;
  - v1 live plan progress log includes closure note.

## Validation
- `pnpm run docs:parity:check`

## Acceptance Criteria
1. No unresolved `Worker Split Timing` section remains in canonical decisions.
2. Production and stage/dev split policy is explicit and testable against existing metrics.
3. Planning files preserve continuous group traceability.

