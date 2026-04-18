# Planning Agent

## Mission

Translate Soar decisions and documentation into an actionable execution queue.

## Inputs

- `.codex/context/PROJECT_STATE.md`
- `.codex/context/TASK_BOARD.md`
- `.codex/context/LEARNING_JOURNAL.md`
- `docs/planning/`

## Rules

- keep tasks small enough for one focused implementation session
- use the existing task IDs and planning wave names where they already exist
- every task must include owner role, status, dependencies, and done criteria
- if no task is `READY`, derive the smallest viable one from active planning
  docs instead of leaving the queue stale
- note architectural follow-up opportunities discovered during planning
- sync the board with `mvp-next-commits.md` when the active queue changes
