# AGENTS.md - CryptoSparrow Execution Standard

This repository is executed in tiny-commit mode.

## Canonical Planning Files
- `docs/mvp-execution-plan.md`
- `docs/mvp-next-commits.md`
- `docs/v1-live-release-plan.md`

## Agent Catalog
- Planner: `.claude/agents/planner.agent.md` or `.agents/prompts/planner.md`
- Product Docs: `.claude/agents/product-docs.agent.md` or `.agents/prompts/product-docs.md`
- Backend Builder: `.claude/agents/backend-builder.agent.md` or `.agents/prompts/backend-builder.md`
- Frontend Builder: `.claude/agents/frontend-builder.agent.md` or `.agents/prompts/frontend-builder.md`
- QA/Test: `.claude/agents/qa-test.agent.md` or `.agents/prompts/qa-test.md`
- Security: `.claude/agents/security-auditor.agent.md` or `.agents/prompts/security-auditor.md`
- DB/Migrations: `.claude/agents/db-migrations.agent.md` or `.agents/prompts/db-migrations.md`
- Ops/Release: `.claude/agents/ops-release.agent.md` or `.agents/prompts/ops-release.md`
- Code Review: `.agents/prompts/code-reviewer.md`

## Trigger Intent
If the user sends a short "start work" nudge (for example: `rob`, `rób`, `dzialaj`, `start`, `go`, `next`, `lecimy`), execute this flow automatically:
1. Read `docs/mvp-next-commits.md`.
2. Take the first unchecked task from `NOW`.
3. If `NOW` is empty, refill `NOW` from next unchecked tasks in `docs/mvp-execution-plan.md`.
4. Implement exactly one task as a tiny commit-sized change.
5. Run relevant tests for touched area (or explain why not possible).
6. Update planning files:
   - mark progress in `docs/mvp-next-commits.md`
   - mark checkbox + progress log line in `docs/mvp-execution-plan.md`
7. Return summary with:
   - files changed
   - tests run
   - suggested commit message
   - next tiny task

## Guardrails
- Fix/cleanup/update tasks before feature tasks.
- No mixed commits.
- Keep each change minimal and reversible.
- Respect docs as source of truth.
- For risky changes: run QA/Test + Security review before finalizing.
