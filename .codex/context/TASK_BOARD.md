# TASK_BOARD

Last updated: 2026-04-18

## Agent Workflow Refresh (2026-04-18)

- This board is the canonical execution queue for CryptoSparrow / Soar.
- Active planning source remains `docs/planning/mvp-next-commits.md`.
- If planning docs and this board drift, sync them before implementation.
- Default delivery loop for every execution slice:
  - plan
  - implement
  - run relevant tests and validations
  - capture architecture follow-up if discovered
  - sync task state, project state, planning docs, and learning journal when
    needed

## READY

- [ ] UXR-F-05 Unify dashboard create/edit wrappers with shared shell and namespace-driven copy
  - Status: READY
  - Group: Dashboard Forms Unification (`UXR-F-B`)
  - Owner: Frontend Builder
  - Depends on: UXR-F-A
  - Priority: P1
  - Files:
    - `apps/web/src/app/dashboard/**/create/page.tsx`
    - `apps/web/src/app/dashboard/**/[id]/edit/page.tsx`
    - `apps/web/src/i18n/namespaces/dashboard-*.ts`
    - `docs/planning/mvp-next-commits.md`
  - Done when:
    - wrapper-level create/edit copy is namespace-driven
    - page wrappers align to shared form-shell contract
    - no inline locale maps remain in scoped wrappers
  - Validation:
    - `pnpm --filter web run test -- --run`
    - `pnpm --filter web run typecheck`

## BACKLOG

- [ ] UXR-F-06 Migrate wallet create/edit form to shared ui/forms primitives
  - Status: BACKLOG
  - Group: Dashboard Forms Unification (`UXR-F-B`)
  - Owner: Frontend Builder
  - Depends on: UXR-F-05
  - Priority: P1

- [ ] UXR-F-07 Migrate markets create/edit form to shared ui/forms primitives
  - Status: BACKLOG
  - Group: Dashboard Forms Unification (`UXR-F-B`)
  - Owner: Frontend Builder
  - Depends on: UXR-F-06
  - Priority: P1

- [ ] UXR-F-08 Migrate backtests create form to shared ui/forms primitives
  - Status: BACKLOG
  - Group: Dashboard Forms Unification (`UXR-F-B`)
  - Owner: Frontend Builder
  - Depends on: UXR-F-07
  - Priority: P2

## IN_PROGRESS

- [ ] (none)

## BLOCKED

- [ ] (none)

## REVIEW

- [ ] (none)

## DONE

- [x] SOAR-000 Establish Soar-specific agent workflow scaffolding refresh
- [x] L10NQ-D-06..10 Reports, markets, backtests, bots, and dashboard-home copy migration completed and reflected in `docs/planning/mvp-next-commits.md`
- [x] UXR-F-A closed: `UXR-F-01..UXR-F-04` (contract freeze + shared `ui/forms` core/fields + import-boundary guardrail enforcement)
