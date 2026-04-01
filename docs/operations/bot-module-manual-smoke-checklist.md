# Bot Module Manual Smoke Checklist (PAPER/LIVE)

Status: operator checklist for post-change manual validation of Bot V2.

## Prerequisites
- Docker running (`postgres`, `redis`).
- API + WEB env configured.
- App accessible at configured local URLs.
- At least one strategy and one market group available (or create during test).

## 1) Start Stack
From repo root:

Terminal A:
```powershell
pnpm run backend/dev
```

Terminal B:
```powershell
pnpm run frontend/dev
```

Expected:
- API starts without migration/runtime errors.
- WEB loads dashboard without crashes.

## 2) Canonical DB Preflight
```powershell
pnpm --filter api exec prisma migrate deploy
pnpm --filter api run ops:bot:v2:preflight -- --stdout-only
```

Expected:
- migrations applied,
- `migrationReady: true`.

## 3) Create PAPER Bot
1. Open `Dashboard -> Bots`.
2. Click add/create bot.
3. Fill:
   - mode: `PAPER`,
   - strategy: select existing,
   - market group: select existing.
4. Confirm `paperStartBalance` visible and editable.
5. Save.

Expected:
- success toast/response,
- bot visible on list,
- no `positionMode`/manual `maxOpenPositions` input required.

## 4) Verify Strategy-Derived Config
1. Reopen created bot.
2. Check strategy summary block.

Expected:
- interval/leverage/max-open displayed from strategy,
- values are not entered manually in creator.

## 5) Activate PAPER Bot + Monitoring
1. Set bot active.
2. Switch to Monitoring tab.
3. Select bot and newest session.

Expected:
- runtime session appears,
- status updates (`RUNNING` then terminal when stopped),
- summary cards populated,
- symbol stats table visible,
- trades table visible (or empty with valid state).

## 6) Monitoring Filters and Refresh
1. Use status filter on sessions.
2. Use symbol filter on symbol stats/trades.
3. Toggle auto-refresh for running session.

Expected:
- filters narrow results correctly,
- refresh updates data for running session,
- no UI freeze and no chart payload loading.

## 7) Stop Bot
1. Disable active bot.
2. Refresh monitoring.

Expected:
- session leaves `RUNNING`,
- terminal status visible,
- no new events/trades after stop window.

## 8) Create LIVE Bot (Contract Validation)
1. Create second bot in `LIVE` mode.
2. Keep same strategy + market group path.

Expected:
- bot can be created in LIVE mode via canonical form,
- mode displayed as `LIVE` in list/details/runtime graph endpoints.

## 9) API Contract Spot Checks
Run:
```powershell
pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts
```

Expected:
- suite passes,
- ownership + monitoring contracts green.

## 10) Pass/Fail Gate
Mark `PASS` when all hold:
- bot create/edit works for PAPER/LIVE,
- runtime monitoring session/stat/trade views are consistent,
- no LOCAL mode behavior remains in app/API surface,
- bot e2e test suite passes.

Mark `FAIL` if any item fails and capture:
- bot id,
- session id,
- exact failing screen/API,
- screenshot + error message,
- command output snippet.
