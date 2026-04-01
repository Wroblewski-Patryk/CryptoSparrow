# Bot Module Operator Runbook (PAPER/LIVE, Websocket-First)

Status: active operational runbook for current Bot V2 module.

## 1. Scope
This runbook covers:
- bot creation and lifecycle in `PAPER` and `LIVE`,
- websocket-first runtime behavior,
- monitoring without candlestick charts (sessions, symbol stats, trades),
- basic incident response and safe fallback.

Out of scope:
- backtest UX details (covered by backtest runbooks),
- exchange-key onboarding details (see Binance onboarding runbook).

## 2. Runtime Contract (Operator View)
- Allowed bot modes: `PAPER`, `LIVE`.
- Signal evaluation: only on final/closed candle events.
- Position lifecycle automation (open positions): ticker stream path.
- Scan loop: fallback watchdog only (non-primary path).
- Monitoring view: table/statistics focused, no heavy market chart payload.

## 3. Pre-Start Checklist
1. Infrastructure up:
```powershell
docker compose up -d
docker compose ps
```
2. API and WEB running:
```powershell
pnpm run backend/dev
pnpm run frontend/dev
```
3. DB schema current:
```powershell
pnpm --filter api exec prisma migrate deploy
```
4. Canonical bot migration preflight:
```powershell
pnpm --filter api run ops:bot:v2:preflight -- --stdout-only
```
Expected:
- `migrationReady: true`
- no unmapped legacy bindings.

## 4. Safe Bot Creation Flow
From `Dashboard -> Bots`:
1. Choose mode:
   - `PAPER` for simulation,
   - `LIVE` only with explicit operator consent and valid exchange setup.
2. Select:
   - Strategy,
   - Market group (not single symbol).
3. Verify derived settings preview:
   - interval/leverage/max-open derived from selected strategy.
4. `paperStartBalance`:
   - visible and used only for `PAPER`.
5. Save and confirm bot appears in list.

Safety notes:
- `positionMode` is intentionally removed from creator flow.
- bot-level `maxOpenPositions` is strategy-derived, not manual input.

## 5. Runtime Start/Stop Operations
1. Activate bot (`isActive=true`) from Bots UI.
2. Confirm runtime session appears in Monitoring tab.
3. To stop:
   - deactivate bot in UI,
   - verify session status changes from `RUNNING` to terminal status.

If emergency:
- disable bot immediately in UI,
- enable global kill-switch procedure from ops runbook if risk uncertain.

## 6. Monitoring Tab Interpretation
Monitoring is session-based:
- Session list/detail:
  - status (`RUNNING`, `COMPLETED`, `FAILED`, `CANCELED`),
  - duration,
  - events count.
- Symbol stats:
  - signals, entries/exits, DCA, closed trades,
  - realized PnL / gross profit / gross loss / fees.
- Trades:
  - session-window scoped list,
  - symbol filter and limit.

Live refresh:
- Auto-refresh runs on interval only for active (`RUNNING`) sessions.
- If no running sessions, refresh remains manual/on-demand.

## 7. Daily Ops Checklist
1. Verify no failed runtime sessions for active bots.
2. Verify per-symbol stats update for running sessions.
3. Check trades stream consistency:
   - recent session trades present,
   - totals align with visible symbols.
4. Spot check one bot:
   - strategy + market group linkage intact,
   - no unauthorized mode drift.
5. Capture anomalies in incident log.

## 8. Incident Response (Quick)
### A) Bot not creating
1. Verify required fields in creator:
   - mode, strategy, market group.
2. Check API logs for ownership/validation errors.
3. Re-run:
```powershell
pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts
```

### B) Session missing in monitoring
1. Confirm bot is active.
2. Confirm runtime worker path is running.
3. Check runtime telemetry writes:
   - `BotRuntimeSession`
   - `BotRuntimeSymbolStat`
   - `BotRuntimeEvent`
4. Use API monitoring endpoints directly to isolate UI issue.

### C) Stats/trades mismatch
1. Validate session window (`startedAt` -> `finishedAt/lastHeartbeatAt`).
2. Verify symbol filter and limit inputs.
3. Compare aggregate with raw trades in DB for same session window.

### D) Unexpected runtime behavior
1. Verify stream feed quality (final candle and ticker flow).
2. Confirm watchdog is not primary source.
3. If uncertain, deactivate bot and investigate with parity tests.

## 9. Regression Commands (Bot Module)
```powershell
pnpm --filter api test -- src/modules/bots/bots.e2e.test.ts
pnpm --filter api test -- src/modules/engine/runtimeSignalLoop.service.test.ts src/modules/engine/runtimeScanLoop.service.test.ts src/modules/engine/paperLiveDecisionEquivalence.test.ts
pnpm --filter web exec vitest run src/features/bots/components/BotsManagement.test.tsx
```

## 10. Escalation + Evidence
For every operator incident, record:
- bot id + mode,
- session id (if any),
- timeframe UTC,
- failing endpoint/view,
- exact error text,
- screenshots/log snippets,
- mitigation applied.

Attach evidence to current release checklist artifacts in `docs/operations`.
