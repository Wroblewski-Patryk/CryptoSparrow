# UI Dashboard Legacy Audit (CryptoBot Patterns)

## Scope
This audit maps current dashboard patterns and defines IA inputs for the next task:
- `feat(ui): post-login control-center dashboard with positions/orders snapshot widgets`

## Sources Reviewed
- `apps/client/src/app/dashboard/layout.tsx`
- `apps/client/src/app/dashboard/page.tsx`
- `apps/client/src/ui/layout/dashboard/Header.tsx`
- `apps/client/src/ui/layout/dashboard/PageTitle.tsx`
- `apps/client/src/features/strategies/components/StrategiesList.tsx`
- `apps/client/src/app/dashboard/backtest/page.tsx`
- `apps/client/src/features/profile/pages/ProfilePage.tsx`
- `docs/modules/system-modules.md`

## Current Dashboard Patterns
- Global shell pattern exists: sticky header + footer + content area.
- Dashboard home (`/dashboard`) is only a greeting page and has no control-center widgets.
- Header nav is top horizontal links with strategy/backtest focus.
- Data views use table-first pattern (`StrategiesList`) with row actions.
- Page heading pattern uses `PageTitle` with breadcrumb + optional "Add" CTA.
- Profile area uses tabbed sections with hash state (no nested sidebar layout).

## Gaps Relevant to Positions/Orders and Control Center IA
- No routes yet for `/dashboard/orders` or `/dashboard/positions`.
- Header links to `/dashboard/automation`, but no such route exists in `app/dashboard`.
- No shared dashboard widget primitives (status card, KPI card, activity feed item).
- Home screen lacks hierarchy for quick operational decision making (positions/orders first).
- Mixed language strings are present in UI text; this can slow IA consistency before i18n pass.

## IA Recommendation for Control Center
Use `/dashboard` as the control-center landing page after login with this priority:
1. Risk and exposure snapshot (open positions, unrealized PnL, margin usage).
2. Orders snapshot (open orders, recent fills, failed orders).
3. Bot status (running/stopped, mode: paper/live, last heartbeat).
4. Quick actions (open positions page, open orders page, start/stop bot, emergency stop).
5. Recent activity feed (latest critical actions and alerts).

## Navigation Recommendation (MVP Order)
Top-level dashboard sections should be ordered as:
1. Control Center (`/dashboard`)
2. Strategies (`/dashboard/strategies`)
3. Markets (`/dashboard/markets`)
4. Bots (`/dashboard/bots`)
5. Orders (`/dashboard/orders`)
6. Positions (`/dashboard/positions`)
7. Backtest (`/dashboard/backtest`)
8. Reports (`/dashboard/reports`)
9. Logs (`/dashboard/logs`)
10. Exchanges (`/dashboard/exchanges`)
11. Profile (`/dashboard/profile`)

## Delivery Notes for Next UI Task
- Reuse existing shell and `PageTitle` pattern to stay visually consistent.
- Add lightweight widget components first, then wire live data in later tasks.
- Replace broken `/dashboard/automation` link when bots section is introduced.
- Keep widget text keys ready for future EN/PL i18n extraction.
