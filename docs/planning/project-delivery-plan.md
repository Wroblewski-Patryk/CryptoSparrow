# Project Delivery Plan (MVP -> V1.0)

This file connects execution across all planning documents.

## Source Documents
- Product scope: `docs/product/product.md`
- Architecture and modules: `docs/architecture/system-architecture.md`, `docs/modules/system-modules.md`
- Data model: `docs/architecture/database.md`
- Trading behavior: `docs/architecture/trading-logic.md`
- Safety and quality: `docs/security/security-and-risk.md`, `docs/engineering/testing.md`
- MVP execution: `docs/planning/mvp-execution-plan.md`
- V1.0 release: `docs/planning/v1-live-release-plan.md`
- Commit sequence: `docs/planning/full-commit-roadmap.md`

## Delivery Stages
1. Stage 0 - Stabilize baseline and lock MVP decisions.
2. Stage 1 - Build MVP foundation (data model + API ownership boundaries).
3. Stage 2 - Build backtest-first trading engine.
4. Stage 3 - Add paper and live futures modes with safety gates.
5. Stage 4 - Complete dashboard scope, i18n, responsive, and PWA baseline.
6. Stage 5 - Release MVP with runbook and risk communication.
7. Stage 6 - Harden, scale, and expand product to V1.0 scope.
8. Stage 7 - Execute V1.0 go-live program and post-launch review.
9. Stage 8 - Local replacement gate: prove new runtime can replace legacy local bot usage.
10. Stage 9 - Post-V1 expansion planning (admin/billing/multi-exchange/mobile).

## Workstream Matrix
- Backend/API: auth, ownership, modules, contracts, rate limits.
- Engine: market data, indicators, signals, simulation, live execution.
- Frontend: builder, bots, orders, positions, reports, logs, exchanges.
- Security: key handling, auth hardening, consent flow, audit trail.
- QA: unit/integration/e2e/load and regression packs.
- Ops: observability, worker split, deployment/rollback, incidents.
- Docs: product/tech sync, open decisions, operator and user docs.

## Current Focus (2026-03-21)
- Close local replacement gate with measurable evidence.
- Finish V1 exit evidence workpack.
- Keep queue commit-sized for continuous agent execution.

## Operating Rhythm
- Every run executes exactly one tiny planned task.
- Plan files are updated immediately after task completion.
- Scope changes are accepted only through docs updates first.

## Success Criteria
- MVP: end-to-end strategy -> backtest -> paper -> live opt-in works with security guardrails.
- V1.0: production reliability, scale confidence, and public-ready docs with proven operations.
- Local replacement: new app runs 24/7 locally and covers practical legacy bot workflow with rollback path.
