# Accessibility Audit - Dashboard Core (V1)

Scope: core dashboard shell and high-traffic modules (`home`, `bots`, `logs`, `markets`, `orders`, `positions`).

## Completed Baseline
- Keyboard-visible focus styles for links/buttons/inputs.
- Skip-link support to jump to main content.
- Landmark navigation for dashboard header/nav.
- `aria-current="page"` on active dashboard navigation item.
- Accessible labels for language/theme/account controls.
- Live-region announcements for heartbeat/connectivity status.

## Validation Checklist
1. Keyboard-only navigation:
   - top navigation,
   - page actions,
   - table controls/filter inputs.
2. Screen-reader announcements:
   - live operational status,
   - selected filters and action buttons,
   - current navigation page context.
3. State messaging:
   - loading/empty/error/success cards announce meaningful context.
4. Contrast and readability:
   - risk badges and status chips remain distinguishable in light/dark themes.

## Known Follow-Ups
- Replace remaining `<img>` usages with optimized `next/image` where possible.
- Reduce lint warnings unrelated to accessibility but affecting release hygiene.
- Add additional SR-only descriptions for dense table actions in advanced modules.
