# Exchange Positions/Orders Retirement Plan (2026-04-11)

## Goal
- Remove legacy `Exchange -> Positions/Orders` surface from frontend and rely on two canonical runtime views only:
- `Dashboard -> Open Positions` (runtime summary).
- `Bots -> Monitoring -> Positions/Orders` (bot-scoped runtime details).

## Current State Audit
- Dashboard open positions source:
- `GET /dashboard/bots/:id/runtime-sessions/:sessionId/positions` (bot runtime read model).
- Bot monitoring positions source:
- `GET /dashboard/bots/:id/runtime-sessions/:sessionId/positions` (same source as dashboard).
- Bot monitoring orders source:
- `openOrders` embedded in the same runtime positions response.
- Exchange module UI state:
- `/dashboard/exchanges` currently redirects to `/dashboard/profile#api` and does not expose separate positions/orders tables.
- Legacy API still exists:
- `/dashboard/positions` and `/dashboard/orders` remain available and can be consumed by external/legacy clients.

## Target Contract
- Runtime positions/orders are read only from bot-runtime endpoints.
- PAPER and LIVE must remain strictly isolated by runtime scope:
- PAPER: bot-scoped data.
- LIVE: wallet-scoped data for bot wallet + owned exchange takeover context.
- No dedicated frontend route/tab/table for standalone exchange positions/orders.

## Execution Steps
1. Lock mode-switch safety.
- Keep/extend guard that blocks `PAPER -> LIVE` switch when open paper positions exist for that bot.
- Preserve explicit API error contract for UI messaging.

2. Remove legacy frontend leftovers.
- Remove any remaining menu entries/components/tests referring to `dashboard/orders` and `dashboard/positions`.
- Keep temporary redirects only if needed for backward links; otherwise delete middleware legacy branch.

3. Add migration telemetry for legacy API usage.
- Add audit log/metric counters on `/dashboard/orders` and `/dashboard/positions` to detect active consumers.
- Set deprecation window and confirm zero production usage.

4. Decommission legacy API read routes.
- Remove `ordersRouter` and `positionsRouter` mounting from dashboard router after deprecation window.
- Keep required write/command flows used by runtime/bot control in dedicated bot-runtime endpoints.

5. QA and release gate.
- E2E: verify dashboard and bot monitoring show identical open positions set for selected bot/session scope.
- E2E: verify LIVE wallet scope never includes paper-only positions.
- E2E: verify switching bot to LIVE with open paper positions is blocked with `409`.

## Acceptance Criteria
- No user-facing Exchange Positions/Orders module in frontend.
- Dashboard and Bot Monitoring positions are sourced from the same runtime endpoint contract.
- PAPER/LIVE mixing is prevented by API scope and regression tests.
- Legacy `/dashboard/orders` and `/dashboard/positions` removed or explicitly sunset with zero active clients.
