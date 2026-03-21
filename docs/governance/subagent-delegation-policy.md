# Subagent Delegation Policy (Codex)

## Goal
Use subagents to speed up delivery without losing quality or ownership.

## When to Delegate
- independent side tasks that can run in parallel
- bounded implementation slices with clear file ownership
- specialized analysis that does not block the immediate next local step

## When Not to Delegate
- urgent blocking tasks needed for the very next step
- tasks that are tightly coupled and hard to split safely
- tasks with unclear ownership or acceptance criteria

## Delegation Rules
- assign explicit file/module ownership to each subagent
- avoid overlapping write scopes across parallel workers
- do not duplicate work between main agent and subagents
- integrate returned changes with fast review and follow-up verification

## Coordination Rules
- prefer parallel workers for independent subtasks
- avoid excessive waiting; continue non-overlapping work while workers run
- use one in-progress critical path at a time

## Output Contract
Every delegated task should report:
1. objective completed
2. files changed
3. validations run
4. residual risks
5. next suggested step
