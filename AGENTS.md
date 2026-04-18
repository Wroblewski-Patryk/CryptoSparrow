# AGENTS.md - CryptoSparrow / Soar

## Purpose

This repository follows a project-specific multi-agent workflow so multiple
execution chats can move Soar forward without losing source-of-truth quality,
runtime safety, deployment discipline, or documentation parity.

## Canonical Context

Read these before starting non-trivial work:

- `.codex/context/PROJECT_STATE.md`
- `.codex/context/TASK_BOARD.md`
- `.codex/context/LEARNING_JOURNAL.md`
- `.agents/workflows/general.md`
- `.agents/workflows/subagent-orchestration.md`

## Canonical Docs

- `docs/README.md`
- `docs/product/overview.md`
- `docs/product/product.md`
- `docs/architecture/system-architecture.md`
- `docs/architecture/runtime-signal-merge-contract.md`
- `docs/architecture/assistant-runtime-contract.md`
- `docs/modules/system-modules.md`
- `docs/engineering/local-development.md`
- `docs/engineering/testing.md`
- `docs/planning/mvp-execution-plan.md`
- `docs/planning/mvp-next-commits.md`
- `docs/planning/open-decisions.md`
- `docs/governance/working-agreements.md`
- `docs/governance/language-policy.md`
- `docs/governance/repository-structure-policy.md`
- `docs/governance/subagent-delegation-policy.md`
- `docs/operations/coolify-linux-vps-setup-guide.md`
- `docs/operations/post-deploy-smoke-checklist.md`
- `docs/operations/deployment-rollback-playbook.md`
- `docs/ux/ux-ui-mcp-collaboration.md`
- `docs/ux/dashboard-design-system.md`

## Core Rules

- Project state, task board, learning journal, and canonical docs are the
  source of truth.
- Keep repository artifacts in English.
- Communicate with the user in the user's language.
- Never reference sibling repositories or `!template` paths from project docs.
- Keep root minimal. Project documentation belongs in `docs/`.
- Every meaningful change updates at least one relevant source-of-truth file:
  - `.codex/context/TASK_BOARD.md`
  - `.codex/context/PROJECT_STATE.md`
  - `.codex/context/LEARNING_JOURNAL.md` when a recurring pitfall is confirmed
  - planning, architecture, operations, or UX docs when behavior or structure
    changed
- Keep commits tiny, single-purpose, and reversible.
- Scope lock is mandatory:
  - implement only what the user explicitly requested or what is required by
    failing tests, build contracts, or runtime safety for the requested task
  - do not apply opportunistic UI, copy, or cleanup changes unless they are
    explicitly requested
- Run relevant validation before creating a commit.
- Do not mark a task done without acceptance-criteria evidence.
- For auth-sensitive, money-impacting, or live-trading flows, include
  adversarial and fail-closed validation before completion.
- When a recurring environment or tooling pitfall is discovered, record it in
  `.codex/context/LEARNING_JOURNAL.md` in the same task.
- Before saying "nothing is planned", cross-check:
  - active canonical queue files
  - background or historical unchecked lists, clearly labeled as non-active
- Follow the default delivery loop:
  - plan
  - implement
  - test
  - review risks and architecture follow-up
  - sync docs and context
  - repeat

## Project Validation Baseline

Run the commands relevant to the touched scope.

- Repository guardrails: `pnpm run quality:guardrails`
- Lint: `pnpm run lint`
- Typecheck: `pnpm run typecheck`
- API tests: `pnpm --filter api run test -- --run`
- Web tests: `pnpm --filter web run test -- --run`
- Build: `pnpm run build`
- Route-reachable i18n audit when copy or routes change:
  `pnpm i18n:audit:route-reachable:web`
- Go-live smoke for risky runtime or deployment work:
  `pnpm run test:go-live:smoke`

## Agent Catalog

- Planner: `.agents/prompts/planner.md` or `.claude/agents/planner.agent.md`
- Product Docs: `.agents/prompts/product-docs.md` or
  `.claude/agents/product-docs.agent.md`
- Backend Builder: `.agents/prompts/backend-builder.md` or
  `.claude/agents/backend-builder.agent.md`
- Frontend Builder: `.agents/prompts/frontend-builder.md` or
  `.claude/agents/frontend-builder.agent.md`
- QA/Test: `.agents/prompts/qa-test.md` or `.claude/agents/qa-test.agent.md`
- Security: `.agents/prompts/security-auditor.md` or
  `.claude/agents/security-auditor.agent.md`
- DB/Migrations: `.agents/prompts/db-migrations.md` or
  `.claude/agents/db-migrations.agent.md`
- Ops/Release: `.agents/prompts/ops-release.md` or
  `.claude/agents/ops-release.agent.md`
- Code Review: `.agents/prompts/code-reviewer.md`
- Codex Documentation Agent: `.codex/agents/documentation-agent.md`
- Codex Planning Agent: `.codex/agents/planning-agent.md`
- Codex Execution Agent: `.codex/agents/execution-agent.md`
- Codex Review Agent: `.codex/agents/review-agent.md`

## Trigger Intent

If the user sends a short execution nudge such as `rob`, `dzialaj`, `start`,
`go`, `next`, or `lecimy`:

1. Read `docs/planning/mvp-next-commits.md` and `.codex/context/TASK_BOARD.md`.
2. Take the first `READY` or `IN_PROGRESS` task that matches the active
   `NOW/NEXT` queue.
3. If planning docs and board drift, sync them before implementation.
4. If no task is executable, derive the next smallest one from:
   - `docs/planning/mvp-execution-plan.md`
   - `docs/planning/open-decisions.md`
5. Implement exactly one tiny task.
6. Run relevant checks.
7. Update task, project state, and planning files.
8. Return summary with files changed, tests run, deployment impact, and next
   tiny task.

## UX/UI Contract

For UX/UI tasks, always include:

- design source reference
- expected states (`loading`, `empty`, `error`, `success`)
- responsive checks (`desktop`, `tablet`, `mobile`)
- accessibility checks
- parity evidence in task or review notes

Design-source policy:

- Follow `docs/ux/ux-ui-mcp-collaboration.md` and
  `docs/ux/dashboard-design-system.md`.
- Figma is the primary implementation source when available.
- Stitch is draft-only unless the repository explicitly documents an approved
  exception workflow.

## Deployment Contract

- Treat Coolify on VPS as the default deployment target.
- Keep env ownership, health checks, persistent data, worker processes, and
  rollback behavior explicit.
- For runtime or deployment changes, review deploy docs, smoke checks, and
  rollback notes in the same task.

## Subagent Contract

- Delegate only independent or clearly bounded subtasks.
- Keep critical-path blocking work local.
- Assign explicit ownership for delegated write scope.
- Avoid overlapping file ownership between parallel workers.
- Integrate and verify delegated output before closing tasks.

## Commit Rule

Do not create a commit when required quality gates fail, unless the user
explicitly approves a temporary exception.
