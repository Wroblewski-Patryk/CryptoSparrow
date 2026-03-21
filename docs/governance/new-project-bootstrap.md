# New Project Bootstrap

Use this checklist when initializing this repository.

## 1) Project Identity
- Rename the folder to the target project name.
- Set project name and goal in `.codex/context/PROJECT_STATE.md`.
- Update `docs/product/overview.md` with a plain-language summary.

## 2) Language Rules
- Keep all repository artifacts in English.
- Keep AI/user communication in the user's language.
- Confirm language policy in `docs/governance/language-policy.md`.
- Confirm subagent policy in `docs/governance/subagent-delegation-policy.md`.

## 3) Planning Initialization
- Create first real tasks in `.codex/context/TASK_BOARD.md`.
- Fill `docs/planning/mvp-execution-plan.md`.
- Fill `docs/planning/mvp-next-commits.md` (NOW max 3).

## 4) Product and Architecture Baseline
- Fill `docs/product/product.md`.
- Fill `docs/product/mvp_scope.md`.
- Fill `docs/architecture/system-architecture.md`.
- Fill `docs/architecture/tech-stack.md` with exact versions.

## 5) Agent Readiness
- Confirm `AGENTS.md` reflects project reality.
- Keep only needed role prompts in `.agents/prompts/`.
- Add project-specific workflow rules to `.agents/workflows/general.md`.
- Confirm `.agents/workflows/subagent-orchestration.md` matches delivery style.
- For UX-heavy projects, confirm `docs/ux/stitch-mcp-playbook.md` and `docs/ux/ux-ui-mcp-collaboration.md` are tailored.

## 6) First Execution Cycle
- Pick the first unchecked task in `docs/planning/mvp-next-commits.md` NOW.
- Implement one tiny task.
- Run relevant validation.
- Update task/plan/state files in the same cycle.

## Definition of Ready
Project is ready when:
- product + architecture baseline is documented,
- first NOW queue exists,
- at least one executable task is READY,
- language and workflow rules are explicit.
