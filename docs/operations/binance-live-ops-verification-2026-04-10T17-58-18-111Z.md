# Binance Live Ops Verification (2026-04-10T17:58:18.111Z)

Source artifact: `docs/operations/_artifacts-binance-live-ops-check-2026-04-10T17-58-18-111Z.json`
Execution path: VPS private ops route (`https://127.0.0.1` + `Host: api.soar.luckysparrow.ch`)

## Step Status
- Step 1 Connectivity and Permission Gate: PASS
- Step 2 Exchange Snapshot Trust Gate: BLOCKED
- Step 3 Management Mode Safety Gate: PARTIAL
- Step 4 Runtime Lifecycle Gate: BLOCKED
- Step 5 Runtime Health and Alert Gate: PASS
- Step 6 Backtest vs Runtime Alignment Spot Check: BLOCKED

## Evidence
- Step 1:
  - API key test: PASS (`code=OK`)
  - Key flags: `syncExternalPositions=true`, `manageExternalPositions=false`
- Step 2:
  - Exchange snapshot: `200`, positions=`8`
  - App open positions: `6`
  - `GET /dashboard/positions/live-status`: `running=false`, `iterations=0`
  - Status: BLOCKED (reconciliation mismatch unresolved)
- Step 3:
  - Canary LIVE wallet created: `47046959-2da5-4fe5-9590-5f5c68d5b176` (`FIXED`, `2 USDT`)
  - Bot switched to LIVE + opt-in and activated:
    - bot: `b38bfa7b-3d47-4134-9a04-601ee9d5cc34`
    - session: `f5757541-9b00-489d-9f5d-7ec85ca3bdf2` (`RUNNING`)
  - LIVE pre-trade guard blocked entries for occupied symbols (`BTCUSDT`, `SOLUSDT`, `XRPUSDT`, `ETHUSDT`) with reason `open_position_on_symbol_exists`
  - Status: PARTIAL (guard behavior confirmed; explicit MANUAL_MANAGED/BOT_MANAGED toggle scenario still pending)
- Step 4:
  - LIVE session heartbeat is healthy, but no `OPEN/DCA/CLOSE` trade lifecycle events in this window (`tradeCount=0`)
  - Status: BLOCKED
- Step 5:
  - `/workers/health=200`
  - `/workers/ready=200`
  - `/workers/runtime-freshness=200` with `status=PASS`
  - `/alerts=200`, `alerts=[]`
- Step 6:
  - BLOCKED until Step 4 records LIVE lifecycle sequence (`OPEN -> DCA -> CLOSE`)

## Conclusion
Canary LIVE runtime is now active and healthy, and pre-trade safety guards are confirmed in LIVE mode. Full checklist remains blocked by unresolved snapshot reconciliation alignment and missing LIVE lifecycle trade evidence in this observation window.
