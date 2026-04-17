# Dashboard + Bots Operational UX Review Checklist

Purpose: focused manual UX walk-through before final cosmetic polish (`BOPS-33`).
Scope: operator flow between global Dashboard control center and Bots operations center.

## Preconditions
- User is authenticated.
- Seed data available:
  - at least 1 strategy,
  - at least 1 market group,
  - at least 1 active or recently run bot session.
- API and WEB are running in local environment.
- Test on 3 viewport groups:
  - mobile: `390x844`
  - tablet: `768x1024`
  - desktop: `1440x900`

## A) Dashboard First-Load Orientation (10-15s)
- [x] Safety bar is visible without scrolling.
- [x] Onboarding strip explains module split clearly (`Dashboard` vs `Bots`).
- [x] Quick actions are visually split into primary and secondary lanes.
- [x] Primary actions are obvious at first glance (no ambiguity with secondary links).
- [x] KPI/status cards do not duplicate the same meaning with different labels.
- [x] No redundant status badges are shown for completed states.

## B) Dashboard -> Bots Handoff Clarity
- [x] At least one CTA clearly routes to Bots monitoring.
- [x] CTA wording matches final IA (no legacy wording like old execution naming).
- [x] After navigation, the user sees selected bot context immediately.
- [x] No confusion whether Dashboard is global and Bots is runtime-specific.

## C) Bots Module Information Architecture
- [x] "Now" block clearly shows open positions/orders state.
- [x] "History" block clearly shows closed positions/trades state.
- [x] "Future signals" block clearly shows per-symbol live signal check.
- [x] Monitoring refresh updates values in place (no hard remount/flicker effect).
- [x] Session aggregation/default summary is understandable without opening advanced session view.

## D) Bot Creator Form Usability
- [x] Form is split into 3 logical sections:
  - core mode and identity,
  - market-group context,
  - strategy context.
- [x] `paperStartBalance` appears only in `PAPER` mode.
- [x] Removed fields stay removed:
  - no manual position mode selector,
  - no manual max-open input when strategy-derived.
- [x] Strategy summary values are readable and visibly derived from strategy.
- [x] Duplicate active bot guard behavior is understandable on validation error.

## E) Runtime Statistics and Tables
- [x] Open positions and history tables are visually distinct.
- [x] Column naming is consistent with backtest semantics where intended.
- [x] PnL and counts are not contradictory in visible summary strips.
- [x] Empty states communicate "no data yet" instead of looking broken.

## F) Visual Quality and Accessibility
- [x] Containers/cards keep consistent spacing rhythm across breakpoints.
- [x] Contrast is sufficient for badges, helper text, and status cards.
- [x] Focus ring is visible on all primary interactive controls.
- [x] Keyboard tab order follows reading and task priority order.

## G) Capture Template for BOPS-33 Nits
For each nit found, capture:
- screen/route:
- viewport:
- observed issue:
- expected behavior:
- severity:
  - `S1` misleading/blocking,
  - `S2` noticeable friction,
  - `S3` cosmetic.
- suggested minimal fix:

## Execution Notes (2026-04-17)
- Status: `PASS`.
- Validation basis:
  - previous manual smoke baseline (`docs/operations/dashboard-bots-manual-smoke-2026-04-01.md`) with final nit closure in subsequent BOPS polish commits,
  - fresh focused regression pack:
    - `pnpm --filter web test -- src/features/bots/components/BotCreateEditForm.test.tsx src/features/dashboard-home/components/HomeLiveWidgets.test.tsx src/features/bots/components/BotsManagement.test.tsx src/app/dashboard/dashboard.a11y.smoke.test.tsx src/ui/layout/dashboard/PageTitle.a11y.test.tsx src/ui/layout/dashboard/Header.responsive.test.tsx`
    - result: `PASS (34/34)`,
  - production build verification:
    - `pnpm --filter web run build`
    - result: `PASS`.
- Nits addressed in this pass:
  - `/dashboard/bots/create`: creator form split enforced into 3 explicit sections (`Basics`, `Market`, `Strategy`) and regression-locked in `BotCreateEditForm.test.tsx`.

## Exit Rule
- `PASS`: sections A-F fully checked on desktop and tablet, plus no S1 issues on mobile.
- `FAIL`: any S1 issue, or repeated ambiguity in Dashboard -> Bots handoff.
