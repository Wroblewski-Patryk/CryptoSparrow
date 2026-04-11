# Binance Live Ops Verification Checklist (2026-04-06)

Purpose: operational verification for V1 live bot control on Binance before final production sign-off.

Scope:
- API key onboarding and exchange connectivity trust.
- Position management behavior (`BOT_MANAGED` vs `MANUAL_MANAGED`).
- Runtime lifecycle behavior (`OPEN -> DCA -> CLOSE`) and no-flip safety.
- Backtest-to-runtime semantic alignment quick check.

## Prerequisites
- Operator has valid Binance credentials with required Spot/Futures permissions for selected bot market type.
- User profile has API key configured with:
  - `syncExternalPositions = true`
  - `manageExternalPositions = true` (if runtime should actively manage synced positions)
- Runtime worker is healthy and market stream is fresh.

## Step 1 - Connectivity and Permission Gate
1. Verify API key connection test from profile succeeds.
2. Confirm error mapping is human-readable for invalid key/secret, permission mismatch, or IP restriction.
3. Record result and UTC timestamp.

Evidence:
- Connection test result: PASS (`/dashboard/profile/apiKeys/:id/test` -> `{"ok":true,"code":"OK","message":"Binance API key permissions validated."}`)
- UTC timestamp: `2026-04-10T17:27:06.817390Z`
- Operator: `Patryk Wroblewski`

## Step 2 - Exchange Snapshot Trust Gate
1. Load exchange live positions snapshot from positions module.
2. Confirm open positions visible in app match Binance account for:
   - symbol
   - side
   - quantity
   - entry price
3. Confirm `lastSync` is present and recent.

Evidence:
- Snapshot command/view: `GET /dashboard/positions/exchange-snapshot` and `GET /dashboard/positions?status=OPEN` (executed from VPS private ops route)
- Symbols checked: snapshot (`1000PEPEUSDT, ADAUSDT, AVAXUSDT, BNBUSDT, DOGEUSDT, LINKUSDT, SOLUSDT, XRPUSDT`) vs app-open (`BTCUSDT, DOGEUSDT, ETHUSDT, SOLUSDT, XRPUSDT, ZECUSDT`)
- Sync timestamp observed: `2026-04-10T17:27:16.604Z`
- Operator: `Patryk Wroblewski` (status: BLOCKED - symbol/count mismatch, reconciliation loop not running)

## Step 3 - Management Mode Safety Gate
1. Mark at least one synced symbol as `MANUAL_MANAGED`.
2. Trigger runtime evaluation cycle.
3. Confirm runtime does not place new bot orders on this symbol.
4. Mark one symbol as `BOT_MANAGED` and confirm runtime is allowed to automate lifecycle.

Evidence:
- Manual-managed symbol: not validated (BLOCKED)
- Bot-managed symbol: not validated (BLOCKED)
- Orders blocked on manual-managed symbol: not validated (BLOCKED)
- UTC timestamp: `2026-04-10T17:27:06.817390Z` (blocked because `syncExternalPositions/manageExternalPositions` are currently false and active bots have no runtime sessions)

## Step 4 - Runtime Lifecycle Gate (`BOT_MANAGED`)
1. Run controlled scenario where bot opens a position.
2. Confirm lifecycle actions are coherent:
   - `OPEN` created once
   - `DCA` events follow configured ladder/rules
   - `CLOSE` action finalizes position
3. Confirm no duplicate execution side effects after retry/restart path.
4. Confirm no opposite-side flip action while position is open (`no-flip` guard).

Evidence:
- Session/bot id: not validated (BLOCKED)
- Symbols checked: not validated (BLOCKED)
- Lifecycle events observed: not validated (BLOCKED)
- No-flip behavior: not validated (BLOCKED)
- Operator: `Patryk Wroblewski` (blocked - no runtime sessions on active tested bots)

## Step 5 - Runtime Health and Alert Gate
1. Verify:
   - `GET /health` -> `200`
   - `GET /ready` -> `200`
   - `GET /workers/health` -> `200`
   - `GET /workers/ready` -> `200`
   - `GET /workers/runtime-freshness` -> `200` and `status=PASS`
2. Verify `/alerts` has no rollback-critical runtime alerts for current window.

Evidence:
- Endpoint check timestamp: `2026-04-10T17:27:16.699Z`
- Runtime freshness status: PASS (`GET /workers/runtime-freshness` -> `200`, payload `status=PASS`)
- Alert summary: PASS (`GET /alerts` -> `200`, `alerts=[]`)
- Operator: `Patryk Wroblewski`

## Step 6 - Backtest vs Runtime Alignment Spot Check
1. Use the same strategy + market group + symbol set used by live bot.
2. Run short-window backtest and compare lifecycle semantics with recent runtime behavior:
   - action chronology (`OPEN/DCA/CLOSE`)
   - trailing semantics (`TTP/TSL`) when enabled
   - planned vs executed DCA ladder interpretation
3. If mismatch is found, open incident and keep release gate blocked until triage.

Evidence:
- Backtest run id: not validated (BLOCKED)
- Runtime session id: not validated (BLOCKED)
- Symbols compared: not validated (BLOCKED)
- Alignment result: not validated (BLOCKED; Step 4 lifecycle evidence missing)
- Follow-up ticket (if mismatch): open required before RC if runtime/backtest mismatch is confirmed

## Update 2026-04-10 (Canary LIVE Window)

Reference:
- `docs/operations/_artifacts-binance-live-ops-check-2026-04-10T17-58-18-111Z.json`
- `docs/operations/binance-live-ops-verification-2026-04-10T17-58-18-111Z.md`

Observed progress:
- Step 1 remains PASS:
  - API key test OK.
  - Key flags now: `syncExternalPositions=true`, `manageExternalPositions=false`.
- Step 3 is PARTIAL:
  - Canary wallet created (`FIXED 2 USDT`) and one bot switched to LIVE:
    - Bot: `b38bfa7b-3d47-4134-9a04-601ee9d5cc34`
    - LIVE session: `f5757541-9b00-489d-9f5d-7ec85ca3bdf2` (`RUNNING`)
  - LIVE guard confirmed blocking entries on occupied symbols with reason `open_position_on_symbol_exists` (e.g. `BTCUSDT`, `SOLUSDT`, `XRPUSDT`, `ETHUSDT`).
- Step 5 remains PASS:
  - `/workers/runtime-freshness=200` with `status=PASS`
  - `/alerts=200` with empty alerts list.

Still blocked:
- Step 2 BLOCKED: exchange snapshot and app-open positions are still not aligned; `/dashboard/positions/live-status` reports `running=false`.
- Step 4 BLOCKED: LIVE session healthy, but no `OPEN -> DCA -> CLOSE` lifecycle events were produced in this observation window.
- Step 6 BLOCKED: parity spot-check cannot proceed before Step 4 lifecycle evidence exists.

## Exit Rule
- This checklist is considered pass only when all six steps have recorded evidence and no unresolved mismatch/critical runtime alert remains.
- Attach this checklist reference to:
  - `docs/operations/v1-release-candidate-checklist.md`
  - `docs/operations/v1-rc-signoff-record.md` notes section.
