# DBSEL-A Closure - Dashboard Mixed-Mode Selector Parity (2026-04-18)

## Scope Closed
- `DBSEL-01`: contract freeze for mixed-mode selector behavior.
- `DBSEL-02`: red regression for missing active `PAPER` option when `LIVE` exists.
- `DBSEL-03`: removed live-only scope clamp in `useHomeLiveWidgetsController`.
- `DBSEL-04`: selector-state regression for mixed-mode persistence + degraded `NO_SESSION` path.
- `DBSEL-05`: focused QA pack.

## Verification Pack
- `pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx`
  - Result: `PASS` (`15/15`)
- `pnpm --filter web run typecheck`
  - Result: `PASS`
- `pnpm --filter web run build`
  - Result: `PASS`

## Notes
- Test suite still emits known non-blocking stderr noise in this area:
  - React `act(...)` warnings in `I18nProvider` test flow.
  - intermittent jsdom `AggregateError` logs.
- Build reports pre-existing lint warnings outside DBSEL scope; they do not fail the build.

## Outcome
Dashboard runtime selector now preserves mixed active `LIVE + PAPER` visibility, keeps selection stable across mode switches, and correctly shows degraded/no-session state for active bots without runtime sessions.
