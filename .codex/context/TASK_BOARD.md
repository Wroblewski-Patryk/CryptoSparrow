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

- [ ] L10NQ-D-11 Localize global offline page and risk notice footer
  - Status: READY
  - Group: Total Web I18n Coverage
  - Owner: Frontend Builder
  - Depends on: none
  - Priority: P1
  - Files:
    - `apps/web/src/`
    - `docs/planning/mvp-next-commits.md`
  - Done when:
    - offline page and risk notice footer copy are fully localized
    - `en`, `pl`, and `pt` remain aligned for touched keys
    - route-reachable audit and targeted web validation pass
  - Validation:
    - `pnpm --filter web run test -- --run`
    - `pnpm --filter web run typecheck`
    - `pnpm i18n:audit:route-reachable:web`

## BACKLOG

- [ ] L10NQ-D-12 Localize shared aria, title, and foundation strings
  - Status: BACKLOG
  - Group: Total Web I18n Coverage
  - Owner: Frontend Builder
  - Depends on: L10NQ-D-11
  - Priority: P1

- [ ] L10NQ-D-13 Align footer and public-shell labels to translation keys
  - Status: BACKLOG
  - Group: Total Web I18n Coverage
  - Owner: Frontend Builder
  - Depends on: L10NQ-D-12
  - Priority: P1

- [ ] L10NQ-D-14 Clear residual low-score literals in profile and wallet areas
  - Status: BACKLOG
  - Group: Total Web I18n Coverage
  - Owner: Frontend Builder
  - Depends on: L10NQ-D-13
  - Priority: P2

- [ ] L10NQ-D-15 Align residual legacy backtests and strategy-preset copy
  - Status: BACKLOG
  - Group: Total Web I18n Coverage
  - Owner: Frontend Builder
  - Depends on: L10NQ-D-14
  - Priority: P2

- [ ] DBSEL-01 Restore mixed runtime selector parity for concurrent LIVE and PAPER contexts
  - Status: BACKLOG
  - Group: Dashboard Runtime Selector Parity
  - Owner: Backend Builder
  - Depends on: L10NQ-D-15
  - Priority: P2

- [ ] UXR-F-01 Lock shared dashboard form-system scope and first migration slice
  - Status: BACKLOG
  - Group: Dashboard Forms Unification
  - Owner: Planning Agent
  - Depends on: L10NQ-D-15
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
