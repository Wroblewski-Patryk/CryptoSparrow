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
- [ ] Safety bar is visible without scrolling.
- [ ] Onboarding strip explains module split clearly (`Dashboard` vs `Bots`).
- [ ] Quick actions are visually split into primary and secondary lanes.
- [ ] Primary actions are obvious at first glance (no ambiguity with secondary links).
- [ ] KPI/status cards do not duplicate the same meaning with different labels.
- [ ] No redundant status badges are shown for completed states.

## B) Dashboard -> Bots Handoff Clarity
- [ ] At least one CTA clearly routes to Bots monitoring.
- [ ] CTA wording matches final IA (no legacy wording like old execution naming).
- [ ] After navigation, the user sees selected bot context immediately.
- [ ] No confusion whether Dashboard is global and Bots is runtime-specific.

## C) Bots Module Information Architecture
- [ ] "Now" block clearly shows open positions/orders state.
- [ ] "History" block clearly shows closed positions/trades state.
- [ ] "Future signals" block clearly shows per-symbol live signal check.
- [ ] Monitoring refresh updates values in place (no hard remount/flicker effect).
- [ ] Session aggregation/default summary is understandable without opening advanced session view.

## D) Bot Creator Form Usability
- [ ] Form is split into 3 logical sections:
  - core mode and identity,
  - market-group context,
  - strategy context.
- [ ] `paperStartBalance` appears only in `PAPER` mode.
- [ ] Removed fields stay removed:
  - no manual position mode selector,
  - no manual max-open input when strategy-derived.
- [ ] Strategy summary values are readable and visibly derived from strategy.
- [ ] Duplicate active bot guard behavior is understandable on validation error.

## E) Runtime Statistics and Tables
- [ ] Open positions and history tables are visually distinct.
- [ ] Column naming is consistent with backtest semantics where intended.
- [ ] PnL and counts are not contradictory in visible summary strips.
- [ ] Empty states communicate "no data yet" instead of looking broken.

## F) Visual Quality and Accessibility
- [ ] Containers/cards keep consistent spacing rhythm across breakpoints.
- [ ] Contrast is sufficient for badges, helper text, and status cards.
- [ ] Focus ring is visible on all primary interactive controls.
- [ ] Keyboard tab order follows reading and task priority order.

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

## Exit Rule
- `PASS`: sections A-F fully checked on desktop and tablet, plus no S1 issues on mobile.
- `FAIL`: any S1 issue, or repeated ambiguity in Dashboard -> Bots handoff.
