# Backtest Parity Mismatch Runbook

Date: `2026-03-28`
Scope: operator protocol for interpreting backtest parity mismatch diagnostics and applying safe corrective actions.

## Inputs
- Backtest report: `metrics.parityDiagnostics[]`
- Timeline payload per symbol: `parityDiagnostics`
- Strategy config used for the run
- Market-group config used for the run

## Canonical Mismatch Reasons
- `no_open_position`
- `already_open_same_side`
- `no_flip_with_open_position`
- `manual_managed_symbol`

Any other value is treated as contract violation and must be escalated.

## Triage Flow
1. Confirm run context is frozen:
   - strategy id/version
   - market group id
   - market type (`SPOT`/`FUTURES`)
   - interval and date window
2. For each symbol, record:
   - `mismatchCount`
   - first `mismatchSamples` (`timestamp`, `side`, `trigger`, `mismatchReason`)
3. Validate trigger consistency:
   - for strategy-based runs, `trigger=THRESHOLD` is unexpected and should be treated as parity regression.
4. Classify mismatch profile:
   - expected behavior profile
   - likely config issue
   - likely implementation regression

## Interpretation Guide
### `no_open_position`
- Meaning: exit-type decision appeared with no open position.
- Usually expected when signal stream emits exits during flat state.
- Action:
  - `PASS` if frequency is low/moderate and no contradictory open/close anomalies exist.
  - `REVIEW` if frequent bursts happen near the same timestamps.

### `already_open_same_side`
- Meaning: repeated same-side signal while position already exists.
- Usually expected in trend continuation periods.
- Action:
  - `PASS` when no-flip policy is active and trade count remains coherent.
  - `REVIEW` if combined with unusual over-trading in report.

### `no_flip_with_open_position`
- Meaning: opposite signal ignored due to no-flip policy while position is still open.
- Expected under current policy.
- Action:
  - `PASS` if this aligns with policy and risk profile.
  - `TUNE` strategy if opposite-signal pressure is persistently high (consider close logic tuning, not flip enable).

### `manual_managed_symbol`
- Meaning: symbol is excluded from bot management.
- Expected only when manual-management mode is enabled for that symbol.
- Action:
  - `PASS` if intentional.
  - `CONFIG FIX` if symbol should be bot-managed.

## Safe Corrective Actions
- Strategy tuning (preferred first):
  - refine entry/exit thresholds
  - adjust indicator periods
  - tighten close logic
- Market-group cleanup:
  - remove unstable symbols
  - split groups by volatility profile
- Risk tuning:
  - reduce leverage
  - narrow allowed risk for problematic groups

Do not bypass no-flip policy as first response.

## Escalation Rules
Escalate to engineering when at least one condition is true:
- unknown `mismatchReason`
- strategy-run timelines show `trigger=THRESHOLD`
- mismatch spikes with no corresponding config change
- report/timeline mismatch schema is incomplete or malformed

## Evidence to Attach
- run id
- strategy id
- market group id
- report parity diagnostics snippet
- timeline parity diagnostics snippet for affected symbol
- decision: `PASS` / `TUNE` / `CONFIG FIX` / `ESCALATE`
- one-line rationale

