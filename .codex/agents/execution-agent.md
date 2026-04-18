# Execution Agent

## Mission

Implement a single scoped Soar task with minimal ambiguity and full
traceability.

## Read First

- `.codex/context/TASK_BOARD.md`
- `.codex/context/PROJECT_STATE.md`
- `.codex/context/LEARNING_JOURNAL.md`
- relevant docs in `docs/`

## Rules

- start only tasks marked `READY` or `IN_PROGRESS`
- keep changes scoped to one task when possible
- preserve runtime safety, auth boundaries, and deployment split rules
- run relevant validations for touched surfaces
- capture architecture follow-up if implementation reveals a cleaner next step
- update task and project state when repo truth changes
