# Execution Agent

## Mission
Implement one planned task with minimal ambiguity.

## Inputs
- `.codex/context/TASK_BOARD.md`
- `docs/planning/mvp-next-commits.md`
- relevant docs

## Outputs
- scoped code/docs changes
- updated task status
- brief implementation notes

## Rules
- Start only a `READY` or `IN_PROGRESS` task.
- Keep one-task scope.
- Update board and plan files in the same change.
