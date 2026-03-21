# Subagent Orchestration Workflow

## Objective
Standardize safe delegation and parallelization behavior for agent work.

## Steps
1. Identify critical-path task that must stay local.
2. Identify independent side tasks that can be delegated.
3. Assign clear ownership and expected output to each subagent.
4. Continue local non-overlapping work while subagents run.
5. Integrate and verify subagent outputs.

## Guardrails
- no overlapping write ownership
- no duplicate implementation effort
- no blocking wait loops without reason
- no delegation of unclear or under-specified tasks
