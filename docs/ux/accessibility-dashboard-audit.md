# Accessibility Audit - Dashboard Core

Scope: dashboard shell and high-traffic modules (`home`, `bots`, `markets`, `orders`, `positions`, `wallets`, `profile`).

## Baseline (MVP/V1)
- Keyboard-visible focus styles for links/buttons/inputs.
- Skip-link support to jump to main content.
- Landmark navigation for dashboard header/nav.
- `aria-current="page"` on active dashboard navigation item.
- Accessible labels for language/theme/account controls.
- Live-region announcements for heartbeat/connectivity status.

## Full-Pass Closure (2026-04-17)
- Added route-level automated accessibility smoke pack for:
  - `/dashboard`
  - `/dashboard/bots`
  - `/dashboard/wallets/list`
- Added `PageTitle` accessibility contract tests:
  - breadcrumb trail rendered inside labeled navigation landmark (`Breadcrumb navigation` / `Nawigacja okruszkowa`),
  - contextual screen-reader description for generic `Create` page actions.
- Validated no unnamed interactive controls in covered route smoke render paths.

## Validation Evidence
- Test command:
  - `pnpm --filter web test -- src/ui/layout/dashboard/PageTitle.a11y.test.tsx src/app/dashboard/dashboard.a11y.smoke.test.tsx src/ui/layout/dashboard/Header.responsive.test.tsx`
- Evidence artifacts:
  - `docs/operations/_artifacts-a11y-full-pass-2026-04-17T00-17-35-000Z.json`
  - `docs/operations/a11y-full-pass-closure-2026-04-17.md`

## Residual Follow-Ups
- Extend route-level a11y smoke from core routes to backtests/reports/logs deep views.
- Add denser SR-only contextual helpers for advanced runtime table actions where needed.
