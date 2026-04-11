# Binance Live Ops Verification (2026-04-10T17:27:06.817390Z)

Source artifact: `docs/operations/_artifacts-binance-live-ops-check-2026-04-10T17-26-48-038Z.json`
Execution path: VPS private ops route (`https://127.0.0.1` + `Host: api.soar.luckysparrow.ch`)

## Step Status
- Step 1 Connectivity and Permission Gate: PASS
- Step 2 Exchange Snapshot Trust Gate: BLOCKED
- Step 3 Management Mode Safety Gate: BLOCKED
- Step 4 Runtime Lifecycle Gate: BLOCKED
- Step 5 Runtime Health and Alert Gate: PASS
- Step 6 Backtest vs Runtime Alignment Spot Check: BLOCKED

## Evidence
- Step 1:
  - API keys found: `1`
  - Stored key test: `OK` (`Binance API key permissions validated.`)
  - Flags on key: `syncExternalPositions=false`, `manageExternalPositions=false`
- Step 2:
  - Exchange snapshot: `200`, `source=BINANCE`, `syncedAt=2026-04-10T17:27:16.604Z`, positions=`8`
  - App open positions (`/dashboard/positions?status=OPEN`): `6`
  - Snapshot symbols and app open symbols are not aligned (requires reconciliation enablement and verification pass).
  - Live reconciliation status: `running=false`, `lastRunAt=null`, `openPositionsSeen=0`
- Step 3:
  - Active bots: `2`
  - Runtime sessions on active bots: none (`no runtime sessions`)
  - Required precondition not met: no API key with both `syncExternalPositions=true` and `manageExternalPositions=true`
- Step 4:
  - Cannot verify controlled `OPEN -> DCA -> CLOSE` lifecycle on bot-managed runtime because no active runtime sessions were available for tested bots.
- Step 5:
  - `/health=200`
  - `/ready=200`
  - `/workers/health=200`
  - `/workers/ready=200`
  - `/workers/runtime-freshness=200` with `status=PASS`
  - `/alerts=200`, alerts count=`0`
- Step 6:
  - Not executable in current state because runtime lifecycle evidence (Step 4) is unavailable for compared symbols/session.

## Conclusion
Checklist is currently **BLOCKED** by unresolved operational preconditions and missing runtime lifecycle evidence (Step 2/3/4/6).
