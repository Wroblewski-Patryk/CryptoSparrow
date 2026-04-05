# Dashboard Mobile Navigation Stability Plan (2026-04-05)

## Problem statement
- On desktop main navigation works correctly.
- On mobile, after clicking hamburger, navigation panel is not reliably visible/rendered.

## Code-level diagnosis (current state)
- Mobile panel in `apps/web/src/ui/layout/dashboard/Header.tsx` uses:
  - `fixed ... top-[4.5rem] ... z-40`
  - while header container itself is `sticky ... z-50`.
- Top offset is hardcoded (`4.5rem`) and no longer guaranteed to match real header height after style changes.
- There is no robust interactive regression test for "open mobile menu and verify visible nav container".

## Root causes
1. Hardcoded top offset creates fragile layout coupling with header spacing.
2. Stacking order is unsafe (`z-40` panel under `z-50` header and potentially under other layered content).
3. No dedicated test guarding mobile-open visibility contract.

## Target behavior
- Hamburger open on mobile always reveals full, scrollable, clickable menu panel.
- Panel starts directly under actual header height (no hidden zone, no clipped content).
- Layering is deterministic across themes/pages.

## Implementation tasks
1. `NAVM-01 docs(contract): lock mobile nav overlay contract (layering, offset, scroll, close behavior)`
2. `NAVM-02 fix(web-header): replace hardcoded offset with dynamic-safe mobile overlay layout`
3. `NAVM-03 fix(web-header): enforce deterministic stacking + body scroll lock while menu is open`
4. `NAVM-04 test(web-header): add interactive open/close visibility regression test for mobile menu`
5. `NAVM-05 qa(web-header): run manual mobile smoke across key dashboard routes`

## Suggested technical direction (no behavior redesign)
- Keep current information architecture and links.
- Use one of:
  - dynamic CSS variable for header height + `100dvh` based panel height, or
  - full-screen fixed drawer with top padding equal to measured header height.
- Raise overlay stacking above page content reliably (single source-of-truth z-index token).
- Add side effects for open state:
  - body scroll lock,
  - escape/close + route-click close preserved.

## Acceptance criteria
- Menu is visible immediately after click on mobile viewport.
- Menu remains fully scrollable and all links are clickable.
- No overlap/clipping issues at common device heights.
- New regression test fails before fix and passes after fix.
