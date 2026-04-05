# Dashboard Loading Skeleton + Progress Bar Plan (2026-04-05)

Status: PLANNED

## Goal
- Modernize dashboard loading UX by replacing alert-like loading blocks with DaisyUI skeleton placeholders.
- Replace page-level loading alerts with a global progress bar rendered under dashboard menu/header.
- Keep changes tiny, reversible, and compatible with current i18n/contracts.

## Current State (diagnosis)
- Shared loading UI is currently centered around `LoadingState` in `apps/web/src/ui/components/ViewState.tsx`, which renders a DaisyUI `alert alert-info`.
- Many dashboard modules still show loading as alert/text blocks (`markets`, `strategies`, `bots`, `dashboard home`, `logs`, parts of `backtests`).
- Dashboard shell is centralized in `apps/web/src/app/dashboard/layout.tsx`, which is the right integration point for one global loading progress bar under `Header`.
- Existing error/degraded/success states are useful and should stay alert-based; only loading presentation should move to skeleton/progress pattern.

## UX Contract (target)
1. Loading states:
- Page and section loading in dashboard should default to skeleton placeholders that mimic final layout shape (table rows, cards, forms, KPI strips).
- Loading alerts should no longer be used as default in dashboard routes.

2. Global progress:
- A thin progress bar appears directly under dashboard header/menu during route-level loading.
- Progress fills from left to right with perceived-progress behavior (fast start, slower middle, complete on ready).
- Progress bar must be subtle, non-blocking, and accessible (`aria-hidden` visual layer + reduced motion safe behavior).

3. State boundaries:
- `Loading` -> skeleton/progress.
- `Error`, `Degraded`, `Success` -> existing alert semantics remain.
- Empty states remain unchanged.

## Technical Direction

### A) Shared loading primitives
- Add reusable skeleton components in UI shared layer (for example `apps/web/src/ui/components/loading/*`):
  - `SkeletonCardBlock`
  - `SkeletonTableRows`
  - `SkeletonFormBlock`
  - `SkeletonKpiRow`
- Add compact composition wrappers for common dashboard screens (list/detail/form).

### B) Global dashboard progress bar
- Add dashboard-scoped progress controller rendered in `apps/web/src/app/dashboard/layout.tsx` directly below `Header`.
- Start progress on route intent/navigation start.
- Auto-complete and reset on route settle.
- Use timer-based staged increments for percentage display (for example 0 -> 25 -> 55 -> 80 -> 92 while pending, then 100 and fade out on settle).

### C) Incremental route rollout
- Replace `LoadingState` usage route-by-route with new skeleton blocks.
- Keep behavior and data contracts identical; visual loading only.

## Tiny Commit Queue (proposed)
- `LDUX-01 docs(contract): lock dashboard loading UX contract (skeleton-first + global progress bar under header)`
- `LDUX-02 feat(web-ui): add shared DaisyUI skeleton primitives for table/card/form/kpi dashboard patterns`
- `LDUX-03 feat(web-shell): add dashboard header-underbar navigation progress component with staged percent animation`
- `LDUX-04 refactor(web-viewstate): make dashboard loading path skeleton-first while keeping alert states for error/degraded/success`
- `LDUX-05 feat(web-dashboard-home+bots): replace loading alerts with section/page skeleton compositions`
- `LDUX-06 feat(web-markets+strategies+logs): migrate loading views to skeleton compositions`
- `LDUX-07 feat(web-backtests): migrate list/details loading states to skeletons and preserve timeline phase messaging`
- `LDUX-08 test(web-loading-ux): add regression coverage for progress bar lifecycle and key skeleton rendering states`
- `LDUX-09 qa(web-dashboard): run manual desktop/mobile smoke and capture evidence`

## Acceptance Criteria
- No dashboard route uses alert-style loading as primary loading UI.
- Progress bar is visible under header during route loading and completes cleanly without getting stuck.
- Skeleton shapes match final content structure closely enough to reduce layout shift.
- Existing error/degraded/success states still render correctly.
- Key dashboard module tests pass after migration.

## Risks and Mitigations
- Risk: perceived progress can desync from real loading time.
  - Mitigation: cap fake progress below completion (for example max 92%) until actual settle event.
- Risk: visual regressions across breakpoints.
  - Mitigation: keep skeleton dimensions tied to existing container/table/card classes and run responsive smoke.
- Risk: too large change-surface if migrated in one pass.
  - Mitigation: enforce route-by-route tiny commits (`LDUX-05..07`).

