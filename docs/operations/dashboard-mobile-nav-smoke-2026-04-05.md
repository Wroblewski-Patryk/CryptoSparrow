# Dashboard Mobile Navigation Smoke (2026-04-05)

## Scope
- Task: `NAVM-05 qa(web-header): run manual mobile smoke across dashboard routes and record evidence`
- Environment: local (`http://localhost:3002`, API on `http://localhost:3001`)
- Viewport: `390x844` (mobile)
- Browser automation: Playwright CLI (real browser session)

## Operator session
- Test user (temporary): `smoke.nav.20260405140921@example.com`
- Login flow used: `/auth/register` -> auto-redirect to `/dashboard`

## Commands used
- `npx --yes @playwright/cli@latest open http://localhost:3002/auth/login`
- `npx --yes @playwright/cli@latest resize 390 844`
- Route smoke loop:
  - `goto` route
  - open mobile menu (`button[aria-label*="Menu"]`)
  - capture viewport screenshot

## Route coverage and evidence
All routes below were opened in mobile viewport, menu was opened, and screenshot was captured with visible overlay/menu content.

1. `/dashboard` -> `.playwright-cli/page-2026-04-05T12-13-52-649Z.png`
2. `/dashboard/orders` -> `.playwright-cli/page-2026-04-05T12-14-12-025Z.png`
3. `/dashboard/positions` -> `.playwright-cli/page-2026-04-05T12-14-28-080Z.png`
4. `/dashboard/markets/list` -> `.playwright-cli/page-2026-04-05T12-14-46-346Z.png`
5. `/dashboard/strategies/list` -> `.playwright-cli/page-2026-04-05T12-15-03-423Z.png`
6. `/dashboard/backtests/list` -> `.playwright-cli/page-2026-04-05T12-15-20-607Z.png`
7. `/dashboard/bots` -> `.playwright-cli/page-2026-04-05T12-15-36-524Z.png`
8. `/dashboard/reports` -> `.playwright-cli/page-2026-04-05T12-15-54-449Z.png`
9. `/dashboard/logs` -> `.playwright-cli/page-2026-04-05T12-16-10-508Z.png`
10. `/dashboard/profile#basic` -> `.playwright-cli/page-2026-04-05T12-16-36-915Z.png`

## Smoke result
- PASS: mobile menu opens on each tested dashboard route.
- PASS: menu links are present and route navigation remains functional.
- PASS: menu remains scrollable (`overflow-y-auto`) and body scroll lock is active while open.

## Non-blocking observation
- Profile route still logs CSP image warning for avatar host (`http://localhost:3001/avatars/default.png` blocked by `img-src 'self' data: blob: https:`).  
  This is unrelated to mobile nav overlay visibility/stability contract and should be tracked separately.
