# Dashboard Loading UX Contract

Status: accepted (2026-04-05)

## Purpose
- Define one consistent loading experience for dashboard modules.
- Reduce layout jumps and remove alert-like loading states from normal route loading.
- Keep error/degraded semantics explicit and unchanged.

## Scope
- Applies to routes under `/dashboard/*`.
- Covers list/detail/form modules, runtime widgets, and route transitions inside dashboard shell.
- Does not change data contracts or business logic.

## Canonical Rules
1. Loading visual language
- Primary loading state in dashboard must use DaisyUI skeleton patterns, not alert/info blocks.
- Skeletons should mirror final layout shape (table rows, card groups, form blocks, KPI strips) to minimize CLS.

2. Global route progress
- A thin, non-blocking progress bar is rendered directly under dashboard header/navigation.
- Progress behavior:
  - quick ramp at start,
  - slower mid-phase while pending,
  - complete to 100% only on settle.
- Progress bar must never stay stuck after navigation settle.

3. State boundary contract
- `loading` => skeleton + route progress bar.
- `error` => existing alert/error state (kept).
- `degraded` => existing degraded warning state (kept).
- `success` and `empty` => existing semantics (kept).

4. Accessibility
- Skeleton regions should expose loading context via surrounding semantics (section headings, labels).
- Global progress should be subtle and motion-safe:
  - respect reduced-motion preference,
  - avoid aggressive animation loops.

5. Rollout discipline
- Route-by-route migration in tiny commits.
- No mixed commits (visual loading migration only; no unrelated behavior changes).

## Non-goals
- No change to API payloads, polling cadence, or runtime decision logic.
- No redesign of error/degraded messaging in this stream.

## Acceptance Criteria
- Dashboard loading no longer uses alert-style components as default loading UI.
- Under-header progress bar appears during route loading and clears deterministically.
- Core dashboard views keep visual stability while loading.
