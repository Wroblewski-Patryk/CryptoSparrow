# Documentation Index

This folder contains canonical project documentation grouped by domain.

## Structure
- `architecture/` system architecture, data model, technical stack, runtime logic.
- `engineering/` development workflow and testing practices.
- `planning/` execution plans, roadmap, delivery sequencing, open decisions.
- `product/` vision, scope, glossary, known limits, AI direction.
- `operations/` runbooks, checklists, release operations, user/operator guides.
- `security/` risk model, key lifecycle, ownership and consent controls.
- `ux/` UX foundation, design system, accessibility and localization QA.
- `governance/` team rules, repository policies, agent coordination.
- `adr/` architecture decision records.
- `modules/` module map and module deep dives.

## Recommended Reading Order
1. `product/autonomous-agent-vision.md`
2. `product/overview.md`
3. `product/product.md`
4. `architecture/system-architecture.md`
5. `architecture/database.md`
6. `architecture/runtime-signal-merge-contract.md`
7. `architecture/assistant-runtime-contract.md`
8. `modules/system-modules.md`
9. `planning/mvp-execution-plan.md`
10. `planning/mvp-next-commits.md`
11. `planning/v1-live-release-plan.md`
12. `planning/full-commit-roadmap.md`
13. `planning/repo-migration-plan.md`
14. `planning/mobile-parity-contract.md`

## Governance and Source of Truth
- Repository structure policy: `governance/repository-structure-policy.md`
- Working agreements: `governance/working-agreements.md`
- Agent setup: `governance/agent-setup-blueprint.md`

## Notes
- Root directory stays minimal. Domain documentation belongs under `docs/` categories.
- Historical assumptions and decisions are preserved in migrated files and planning artifacts.
