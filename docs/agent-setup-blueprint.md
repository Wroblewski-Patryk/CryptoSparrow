# Agent Setup Blueprint

This repo can use role-based agents (or separate chats with role prompts) to speed up delivery.

## Recommended Agent Roles

### 1) Planner Agent
- Purpose: maintain `mvp-execution-plan.md` and `v1-live-release-plan.md`.
- Trigger: whenever any file in `docs/` changes.
- Output: updated tasks, sequencing, risk notes, and next 3 commits.

### 2) Product Docs Agent
- Purpose: discuss assumptions and convert decisions into docs.
- Trigger: requirement conversation or scope decision.
- Output: updates to `product.md`, `trading-logic.md`, `security-and-risk.md`, `roadmap.md`.

### 3) Build Agent (Backend)
- Purpose: implement server/db/engine tasks from plan.
- Trigger: approved plan item.
- Output: tiny commit + tests + short implementation note.

### 4) Build Agent (Frontend/UX)
- Purpose: implement dashboard/flows/responsive/i18n.
- Trigger: approved UI task from plan.
- Output: tiny commit + UI test + changelog note.

### 5) Design Agent (Figma/Stitch)
- Purpose: convert UX requirements to design specs/components.
- Trigger: new UX module or redesign task.
- Output: design tokens, component spec, handoff checklist.

## Practical Workflow (Simple and Effective)
1. Docs change -> Planner Agent updates both plans.
2. Product Docs Agent validates requirement text.
3. Build Agent takes first `NOW` task.
4. After merge, Planner Agent marks progress and refreshes `NOW`.

## Automation Idea: Plan Sync on docs/* changes
- Add a CI workflow that triggers on `docs/**`.
- Run a script that:
  - reads changed docs,
  - checks plan consistency,
  - opens a PR comment with suggested plan updates.

## Minimal Governance Rules
- No coding without an existing plan item.
- No large commits.
- Every merged task updates progress log.
- Security-sensitive changes require explicit checklist confirmation.
