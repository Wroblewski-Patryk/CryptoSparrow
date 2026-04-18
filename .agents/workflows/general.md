---
description: Workspace rules for CryptoSparrow / Soar
---

# General Workspace Rules

## Stack Snapshot
- Backend: Node.js 20+, Express API, Prisma, PostgreSQL, Redis
- Frontend: Next.js 15, React 19, TypeScript
- Mobile: none in current repository scope, responsive web and PWA-first
- Database: PostgreSQL
- Hosting target: Coolify on VPS by default
- Deployment shape: split web, api, worker, postgres, and redis services
- Runtime constraints:
  - 24/7 bot runtime matters more than cosmetic polish
  - backtest, paper, and live paths should converge toward shared logic
  - worker ownership must stay explicit in deployed environments
  - auth, exchange, and trading flows must fail closed

## Architecture Rules
- Keep project-specific conventions explicit.
- Document where state lives and why.
- Prefer existing patterns over introducing a new style per feature.
- Keep cross-module contracts explicit when shared code or shared schemas exist.
- Do not remove potentially shared code without checking remaining consumers.
- Preserve parity and safety contracts across backtest, paper, and live flows.

## Repository And Docs Rules
- Keep root minimal and intentional.
- Put project documentation under `docs/`.
- Update planning, architecture, operations, or UX docs when behavior or
  structure changes.
- Keep links repository-relative and avoid sibling-repository references.
- Treat docs parity as a real done-state requirement for module, route, and IA
  changes.

## UI/UX Rules
- Follow `docs/ux/dashboard-design-system.md` and
  `docs/ux/ux-ui-mcp-collaboration.md`.
- For UX-heavy work, require states, responsive checks, accessibility checks,
  and parity evidence.
- Figma is the primary implementation source when available.
- Stitch is draft-only unless the repository explicitly approves another rule.

## Deployment Rules
- Treat Coolify on VPS as the default deployment target unless the project
  declares otherwise.
- Keep env ownership, health checks, persistent data, and worker processes
  explicit.
- When runtime behavior changes, review deploy docs, smoke checks, and rollback
  notes in the same task.
- Record the real deployment artifacts and paths in
  `.codex/context/PROJECT_STATE.md`.

## Delivery Rules
- Keep changes scoped and reversible.
- Require acceptance evidence before completion.
- Keep planning docs and task board synchronized.
- Follow the default loop:
  `plan -> implement -> test -> architecture review -> sync context -> repeat`.
- Apply the validation commands from `.codex/context/PROJECT_STATE.md` before
  every commit.
- Use subagents only according to `.agents/workflows/subagent-orchestration.md`.
