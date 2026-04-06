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
- Connection test result:
- UTC timestamp:
- Operator:

## Step 2 - Exchange Snapshot Trust Gate
1. Load exchange live positions snapshot from positions module.
2. Confirm open positions visible in app match Binance account for:
   - symbol
   - side
   - quantity
   - entry price
3. Confirm `lastSync` is present and recent.

Evidence:
- Snapshot command/view:
- Symbols checked:
- Sync timestamp observed:
- Operator:

## Step 3 - Management Mode Safety Gate
1. Mark at least one synced symbol as `MANUAL_MANAGED`.
2. Trigger runtime evaluation cycle.
3. Confirm runtime does not place new bot orders on this symbol.
4. Mark one symbol as `BOT_MANAGED` and confirm runtime is allowed to automate lifecycle.

Evidence:
- Manual-managed symbol:
- Bot-managed symbol:
- Orders blocked on manual-managed symbol:
- UTC timestamp:

## Step 4 - Runtime Lifecycle Gate (`BOT_MANAGED`)
1. Run controlled scenario where bot opens a position.
2. Confirm lifecycle actions are coherent:
   - `OPEN` created once
   - `DCA` events follow configured ladder/rules
   - `CLOSE` action finalizes position
3. Confirm no duplicate execution side effects after retry/restart path.
4. Confirm no opposite-side flip action while position is open (`no-flip` guard).

Evidence:
- Session/bot id:
- Symbols checked:
- Lifecycle events observed:
- No-flip behavior:
- Operator:

## Step 5 - Runtime Health and Alert Gate
1. Verify:
   - `GET /health` -> `200`
   - `GET /ready` -> `200`
   - `GET /workers/health` -> `200`
   - `GET /workers/ready` -> `200`
   - `GET /workers/runtime-freshness` -> `200` and `status=PASS`
2. Verify `/alerts` has no rollback-critical runtime alerts for current window.

Evidence:
- Endpoint check timestamp:
- Runtime freshness status:
- Alert summary:
- Operator:

## Step 6 - Backtest vs Runtime Alignment Spot Check
1. Use the same strategy + market group + symbol set used by live bot.
2. Run short-window backtest and compare lifecycle semantics with recent runtime behavior:
   - action chronology (`OPEN/DCA/CLOSE`)
   - trailing semantics (`TTP/TSL`) when enabled
   - planned vs executed DCA ladder interpretation
3. If mismatch is found, open incident and keep release gate blocked until triage.

Evidence:
- Backtest run id:
- Runtime session id:
- Symbols compared:
- Alignment result:
- Follow-up ticket (if mismatch):

## Exit Rule
- This checklist is considered pass only when all six steps have recorded evidence and no unresolved mismatch/critical runtime alert remains.
- Attach this checklist reference to:
  - `docs/operations/v1-release-candidate-checklist.md`
  - `docs/operations/v1-rc-signoff-record.md` notes section.
