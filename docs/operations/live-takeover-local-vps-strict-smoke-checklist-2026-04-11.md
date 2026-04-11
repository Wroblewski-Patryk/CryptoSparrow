# Live Takeover Strict Smoke Checklist (Local + VPS) - 2026-04-11

Purpose: enforce a fail-closed verification path for exchange takeover behavior before accepting LIVE runtime changes.

## Gate 1 - Local Code Confidence (must pass)
Run from repository root:

```bash
pnpm --filter api test -- src/modules/positions/livePositionReconciliation.service.test.ts src/modules/positions/positions.takeover-status.e2e.test.ts src/modules/orders/orders.service.test.ts src/modules/engine/runtimeSignalLoop.service.test.ts
pnpm --filter api run typecheck
pnpm --filter web test -- src/features/dashboard-home/components/HomeLiveWidgets.test.tsx
pnpm --filter web run build
```

Expected:
- all commands exit `0`.
- no regression in takeover classification (`OWNED/UNOWNED/AMBIGUOUS/MANUAL`) and no dashboard fallback to `-` when wallet/runtime values exist.

## Gate 2 - VPS Public Edge Smoke (must pass)
Run from any external network:

```bash
SMOKE_API_BASE_URL=https://api.soar.luckysparrow.ch \
SMOKE_WEB_BASE_URL=https://soar.luckysparrow.ch \
pnpm run ops:deploy:smoke -- --no-workers
```

Expected:
- `API /health = 200`
- `API /ready = 200`
- `WEB / = 200`

## Gate 3 - VPS Private OPS Smoke (must pass)
Run from VPS private path (Coolify terminal or SSH on host network):

```bash
pnpm run ops:deploy:smoke
pnpm run ops:deploy:runtime-freshness -- --base-url https://api.soar.luckysparrow.ch --auth-email <admin-email> --auth-password <admin-password>
pnpm run ops:deploy:rollback-guard -- --base-url https://api.soar.luckysparrow.ch --auth-email <admin-email> --auth-password <admin-password>
```

Expected:
- `/workers/health = 200`
- `/workers/runtime-freshness = 200` and payload `status=PASS`
- `/alerts = 200`
- rollback guard result: `"shouldRollback": false`

## Gate 4 - Takeover API Contract (must pass)
Run with authenticated user (same account that owns LIVE bots/wallet/API key):

```bash
GET /dashboard/positions/takeover-status
GET /dashboard/positions?status=OPEN&page=1&limit=50
```

Expected:
- `takeover-status` returns `200` (not `404`).
- open exchange-synced rows expose deterministic takeover state.
- imported rows intended for bot control are visible in runtime/dashboard with owner context.

## Gate 5 - Runtime Lifecycle on Exchange (must pass)
Controlled canary on one symbol:
- existing open symbol: verify no duplicate OPEN attempt (`open_position_on_symbol_exists` guard).
- managed symbol: verify `OPEN -> DCA -> CLOSE` produces real exchange side effects and local persistence.
- confirm no opposite-side flip while position open.

Evidence to collect:
- runtime session id(s),
- orders/trades ids,
- exchange fills,
- local Position/Order/Trade traces.

## Strict Pass Rule
Release gate is `PASS` only if all five gates pass in order. Any failed gate blocks rollout.

## Fail-Closed Notes
- Public-network `403` on `/workers/*` and `/alerts` is expected by security policy and does not replace Gate 3.
- If `takeover-status` is `404`, treat target API as not yet on required rollout revision.
