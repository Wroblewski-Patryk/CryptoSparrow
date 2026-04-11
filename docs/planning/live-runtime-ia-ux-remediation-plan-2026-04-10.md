# Live Runtime + IA/UX Remediation Plan (2026-04-10)

## Scope
This plan addresses seven production issues reported during LIVE validation:
1. Runtime/dashboard does not reliably reflect exchange-open positions after manage-consent.
2. Market create/edit form should be single-view (no tabs) and improved UX.
3. Orders/Positions Exchanges module should be removed from frontend IA after parity with bot runtime.
4. Shared table empty state needs horizontal padding (`px-3`).
5. Backtest details shows transient "cannot fetch" error right after create.
6. Wallet create/edit UX is weak and should include optional live wallet preview.
7. Dashboard wallet widget in LIVE shows missing values (`-`) too often.

## Root Cause Summary
- Exchange-synced positions are persisted but not fully represented in runtime read models used by dashboard/runtime views.
- Duplicate-open prevention is not strict enough when exchange exposure already exists but reconciliation/read path is stale or partial.
- Backtest details treats early post-create bootstrap as hard error instead of temporary processing state.
- Wallet runtime display depends on incomplete LIVE value sources.
- Market form IA is still step/tab-based and increases friction for small edits.
- Exchanges menu still exposes duplicate read surfaces (orders/positions) that should converge into bot runtime.

## Implementation Tracks

### Track A - LIVE Runtime correctness and safety
- `LIV-01`: Runtime read-model parity for exchange-synced positions.
- `LIV-02`: Fail-soft reconciliation per API key (one broken key does not break whole sync pass).
- `LIV-03`: Strict duplicate-open guard against existing exchange/live symbol exposure.
- `LIV-04`: API regression tests for sync visibility + duplicate-open safety.

### Track B - Backtest and dashboard reliability
- `LIV-05`: Replace transient post-create backtest hard error with bootstrap/pending state.
- `LIV-06`: Web regression coverage for create -> details bootstrap flow.
- `LIV-07`: Restore LIVE wallet metrics in dashboard runtime sidebar.

### Track C - Form and UI/UX cleanup
- `LIV-08`: Convert MarketUniverse form from tabs to single-view structure.
- `LIV-09`: Polish MarketUniverse UX (hierarchy, helper text, validation clarity).
- `LIV-10`: Add `px-3` to shared table empty-state rendering.
- `LIV-11`: Add authenticated API wallet balance preview endpoint.
- `LIV-12`: Redesign wallet create/edit form with preview panel and clearer guidance.

### Track D - IA simplification (remove duplicate Exchanges pages)
- `LIV-13`: Audit parity: confirm bot runtime covers required orders/positions use-cases.
- `LIV-14`: Remove Exchanges Orders/Positions from dashboard nav after parity check.
- `LIV-15`: Remove obsolete frontend routes/modules for removed pages.
- `LIV-16`: Add web regressions for nav/runtime/wallet rendering after IA cleanup.

## Delivery Order (tiny commits)
1. Track A (`LIV-01..LIV-04`)
2. Track B (`LIV-05..LIV-07`)
3. Track C (`LIV-08..LIV-12`)
4. Track D (`LIV-13..LIV-16`)

This order prioritizes runtime safety and live correctness before UI restructuring.

## Execution Status (2026-04-10)
- Track A: DONE (`LIV-01..LIV-04`)
- Track B: DONE (`LIV-05..LIV-07`)
- Track C: DONE (`LIV-08..LIV-12`)
- Track D: DONE (`LIV-13..LIV-16`)

## Verification Matrix
- API/unit: runtime reconciliation, duplicate-open guard, wallet preview endpoint.
- Web/unit: backtest bootstrap state, market single-view form interactions, dashboard wallet widget, nav removal.
- Manual prod smoke:
  - manage-consent ON -> exchange-open positions visible in runtime/dashboard,
  - no internal duplicate-open on already-open symbol,
  - backtest create no false hard-error,
  - wallet values visible in LIVE sidebar,
  - no orphan links to removed Exchanges routes.

## Rollback Strategy
- Every `LIV-*` change is isolated per tiny commit.
- If runtime correctness regresses:
  - rollback latest runtime commit only (`LIV-0x`),
  - keep UI-only commits in place.
- If IA cleanup breaks navigation:
  - rollback `LIV-14/15` while retaining parity audit and runtime fixes.
